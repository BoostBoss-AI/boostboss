-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — PUBLISHER BALANCE ACCRUAL RPCs   (migration 13)
-- Apply with: paste into Supabase → SQL Editor.
--
-- Phase E Day 2 (2026-05-11). Adds the atomic credit/debit primitives
-- api/track.js uses to update publisher_balance on every paid event.
--
-- Why RPCs and not inline UPDATE statements:
--   Concurrent events on the same publisher_balance row would race if we
--   read-then-write. A single Postgres function does the increment atomically
--   under one row lock per call, so 100 simultaneous impressions for the
--   same publisher all land cleanly.
--
-- Three RPCs:
--   1. bbx_credit_publisher_balance(developer_id, amount)
--        Atomic increment of balance + lifetime_earned. Returns final
--        balance for read-after-write convenience.
--   2. bbx_decrement_publisher_balance(developer_id, amount)
--        Atomic decrement (used by clawback path). Floors at 0; returns
--        the amount actually deducted (so clawback caller can mark
--        remaining_usd correctly).
--   3. bbx_satisfy_pending_clawbacks(developer_id, incoming_amount)
--        Walks pending clawbacks oldest-first. Each one is fully or
--        partially satisfied by the incoming amount. Returns the leftover
--        incoming_amount that should land in spendable balance after all
--        clawbacks are settled. Per Decision 7 of the design doc.
--
-- All RPCs use SECURITY DEFINER so the anon/service-role key the API uses
-- can call them without explicit table-level grants on every column.
--
-- All statements idempotent (CREATE OR REPLACE FUNCTION).
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Credit RPC ──────────────────────────────────────────────────────
create or replace function public.bbx_credit_publisher_balance(
  p_developer_id uuid,
  p_amount_usd   numeric
) returns numeric
language plpgsql
security definer
as $$
declare
  new_balance numeric;
begin
  -- No-op for non-positive amounts so callers don't accidentally zero things.
  if p_amount_usd is null or p_amount_usd <= 0 then
    return null;
  end if;

  -- INSERT … ON CONFLICT … RETURNING — handles the case where the
  -- publisher_balance row doesn't exist yet (e.g. developer was created
  -- after migration 12's bootstrap insert). Single statement, atomic.
  insert into public.publisher_balance (developer_id, balance, lifetime_earned, updated_at)
  values (p_developer_id, p_amount_usd, p_amount_usd, now())
  on conflict (developer_id) do update
    set balance         = publisher_balance.balance + excluded.balance,
        lifetime_earned = publisher_balance.lifetime_earned + excluded.lifetime_earned,
        updated_at      = now()
  returning balance into new_balance;

  return new_balance;
end;
$$;

-- ── 2. Decrement RPC ───────────────────────────────────────────────────
-- Returns the amount actually deducted so callers (clawback path) can
-- record partial-deduction state correctly.
create or replace function public.bbx_decrement_publisher_balance(
  p_developer_id uuid,
  p_amount_usd   numeric
) returns numeric
language plpgsql
security definer
as $$
declare
  current_balance numeric;
  deducted        numeric;
begin
  if p_amount_usd is null or p_amount_usd <= 0 then
    return 0;
  end if;

  -- SELECT FOR UPDATE locks the row for the duration of this transaction.
  select balance into current_balance
    from public.publisher_balance
   where developer_id = p_developer_id
     for update;

  if current_balance is null then
    -- No balance row at all → nothing to deduct.
    return 0;
  end if;

  deducted := least(current_balance, p_amount_usd);

  update public.publisher_balance
     set balance    = balance - deducted,
         updated_at = now()
   where developer_id = p_developer_id;

  return deducted;
end;
$$;

-- ── 3. Clawback satisfaction RPC ───────────────────────────────────────
-- Walks pending clawbacks oldest-first. Eats the incoming amount until
-- either it's exhausted or all clawbacks are settled. Returns the
-- LEFTOVER incoming amount that should land in spendable balance.
--
-- Per Decision 7: pending clawbacks are debt the publisher owes Boost
-- Boss. Future earnings settle that debt before adding to spendable
-- balance. No operator action required; no negative-balance scenarios.
create or replace function public.bbx_satisfy_pending_clawbacks(
  p_developer_id    uuid,
  p_incoming_amount numeric
) returns numeric
language plpgsql
security definer
as $$
declare
  cb            record;
  consumed      numeric;
  remaining_in  numeric := p_incoming_amount;
begin
  if p_incoming_amount is null or p_incoming_amount <= 0 then
    return 0;
  end if;

  for cb in
    select id, remaining_usd
      from public.payout_clawbacks
     where developer_id = p_developer_id
       and status = 'pending'
       and remaining_usd > 0
     order by created_at asc
     for update
  loop
    exit when remaining_in <= 0;

    consumed     := least(remaining_in, cb.remaining_usd);
    remaining_in := remaining_in - consumed;

    update public.payout_clawbacks
       set remaining_usd = remaining_usd - consumed,
           status        = case when remaining_usd - consumed <= 0 then 'applied' else status end,
           applied_at    = case when remaining_usd - consumed <= 0 then now()    else applied_at end
     where id = cb.id;
  end loop;

  return remaining_in;
end;
$$;

-- ── 4. Record this migration ───────────────────────────────────────────
insert into public.bbx_schema_migrations (name, applied_by, notes)
values ('13_publisher_balance_accrual.sql', 'andy',
        'Phase E Day 2: atomic credit/decrement/clawback-satisfaction RPCs for publisher_balance')
on conflict (name) do update
  set applied_by = excluded.applied_by,
      notes      = excluded.notes;

-- ═══════════════════════════════════════════════════════════════════════
-- Sanity checks (run after applying):
--
--   select proname from pg_proc
--    where proname in ('bbx_credit_publisher_balance',
--                      'bbx_decrement_publisher_balance',
--                      'bbx_satisfy_pending_clawbacks');
--   -- expect 3 rows
--
--   -- End-to-end: credit a real developer 1 cent, then deduct 1 cent.
--   -- (substitute your developer_id)
--   select public.bbx_credit_publisher_balance(
--     '231d338f-a1a0-4f36-82be-2c6f7b8f3680'::uuid, 0.01);
--   -- returns new balance (e.g. 0.01)
--   select public.bbx_decrement_publisher_balance(
--     '231d338f-a1a0-4f36-82be-2c6f7b8f3680'::uuid, 0.01);
--   -- returns 0.01 (amount actually deducted)
-- ═══════════════════════════════════════════════════════════════════════
