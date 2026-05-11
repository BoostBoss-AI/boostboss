-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — STRIPE CONNECT PAYOUTS SCHEMA  (migration 12)
-- Apply with: paste into Supabase → SQL Editor.
--
-- Phase E Day 1 (2026-05-11). Sets up the schema autonomy weekly payouts
-- need:
--   1. developers.payouts_enabled / payout_blocked / payout_blocked_reason
--      / payout_blocked_at / instant_payouts_enabled
--   2. publisher_balance table (per-publisher balance + lifetime totals)
--   3. EXTEND existing payouts table (defined in supabase-schema.sql) with
--      Phase E columns. NOT created from scratch — the table already exists.
--   4. payout_clawbacks table (refund-driven balance reclaims, per
--      Decision 7 of the design doc)
--
-- NAMING CONVENTION: the project uses `developer_id` for what would be
-- "publisher_id" in industry terms. We keep that convention here for
-- schema consistency (existing payouts table, events.developer_id,
-- daily_stats.developer_id, etc.). Table NAMES can use either word —
-- publisher_balance reads more clearly than "developer_balance" — but
-- FK COLUMNS are uniformly developer_id.
--
-- All statements idempotent. See launch-kit/phase-e-payouts-design.md
-- for the design rationale behind every column.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Extend developers (= publishers in this schema) ─────────────────
do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'developers' and column_name = 'payouts_enabled') then
    alter table public.developers add column payouts_enabled boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'developers' and column_name = 'payout_blocked') then
    alter table public.developers add column payout_blocked boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'developers' and column_name = 'payout_blocked_reason') then
    alter table public.developers add column payout_blocked_reason text;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'developers' and column_name = 'payout_blocked_at') then
    alter table public.developers add column payout_blocked_at timestamptz;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'developers' and column_name = 'instant_payouts_enabled') then
    -- Set by Stripe webhook account.updated when publisher opts in via the
    -- Stripe Express dashboard. Defaults to false (standard ACH).
    alter table public.developers add column instant_payouts_enabled boolean default false;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'developers' and column_name = 'stripe_requirements_due') then
    -- Latest snapshot of stripe.requirements.currently_due so the dashboard
    -- can render specific resolution steps without an extra Stripe API call.
    alter table public.developers add column stripe_requirements_due text[] default array[]::text[];
  end if;
end $$;

create index if not exists developers_payouts_enabled_idx
  on public.developers(id) where payouts_enabled = true and payout_blocked = false;

-- ── 2. publisher_balance table ─────────────────────────────────────────
-- Per Decision 9 (per-event accrual). Every events row with developer_payout
-- > 0 increments balance + lifetime_earned via api/track.js inline writes.
-- Cron payouts decrement balance + increment lifetime_paid on success.
create table if not exists public.publisher_balance (
  developer_id    uuid primary key references public.developers(id) on delete cascade,
  balance         numeric(12,2) not null default 0.00,
  lifetime_earned numeric(12,2) not null default 0.00,
  lifetime_paid   numeric(12,2) not null default 0.00,
  updated_at      timestamptz not null default now()
);

-- Bootstrap a balance row for every existing developer (idempotent).
insert into public.publisher_balance (developer_id)
select id from public.developers
on conflict (developer_id) do nothing;

create index if not exists publisher_balance_eligible_idx
  on public.publisher_balance(developer_id) where balance >= 25.00;

-- ── 3. Extend the EXISTING payouts table ───────────────────────────────
-- The base payouts table is defined in supabase-schema.sql with:
--   id, developer_id, amount, period_start, period_end, status,
--   stripe_transfer_id, created_at
-- Phase E needs the following additions; all idempotent.
do $$ begin
  if not exists (select 1 from information_schema.columns
                  where table_name = 'payouts' and column_name = 'fee_usd') then
    alter table public.payouts add column fee_usd numeric(10,2) not null default 0.00;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'payouts' and column_name = 'failure_reason') then
    alter table public.payouts add column failure_reason text;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'payouts' and column_name = 'failure_tier') then
    alter table public.payouts add column failure_tier int check (failure_tier in (1,2,3));
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'payouts' and column_name = 'retry_count') then
    alter table public.payouts add column retry_count int not null default 0;
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'payouts' and column_name = 'method') then
    alter table public.payouts add column method text not null default 'standard'
      check (method in ('standard','instant'));
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'payouts' and column_name = 'completed_at') then
    alter table public.payouts add column completed_at timestamptz;
  end if;
end $$;

-- Extend status CHECK to allow Phase E values without breaking legacy rows.
-- Legacy values: pending, processing, paid, failed. Phase E adds: held.
-- We keep 'paid' as the success state (don't introduce 'succeeded') so
-- existing rows remain valid.
do $$ declare conname text;
begin
  select c.conname
    into conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
   where t.relname = 'payouts'
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) ilike '%status%';
  if conname is not null then
    execute format('alter table public.payouts drop constraint %I', conname);
  end if;
end $$;

alter table public.payouts
  add constraint payouts_status_check
  check (status in ('pending','processing','paid','failed','held'));

create index if not exists payouts_developer_idx
  on public.payouts(developer_id, created_at desc);
create index if not exists payouts_status_idx
  on public.payouts(status, created_at) where status in ('pending','held');
create index if not exists payouts_tier_idx
  on public.payouts(failure_tier, created_at) where failure_tier is not null;

-- ── 4. payout_clawbacks table ──────────────────────────────────────────
-- Per Decision 7 — when an advertiser refund webhook fires, we attribute
-- the publisher's share back. If their balance covers it we deduct
-- immediately (status='applied'). If not, the row stays 'pending' and
-- future events.developer_payout amounts satisfy it before reaching
-- spendable balance.
create table if not exists public.payout_clawbacks (
  id                  uuid primary key default gen_random_uuid(),
  developer_id        uuid not null references public.developers(id) on delete cascade,
  amount_usd          numeric(10,2) not null,
  remaining_usd       numeric(10,2) not null,            -- non-zero while status='pending'
  source_event_type   text,                              -- 'refund' | 'chargeback' | 'manual'
  source_stripe_id    text,                              -- the originating Stripe object id
  source_campaign_id  text,
  status              text not null check (status in ('applied','pending','written_off')),
  applied_at          timestamptz,
  created_at          timestamptz not null default now(),
  notes               text
);

create index if not exists clawbacks_developer_idx
  on public.payout_clawbacks(developer_id, created_at desc);
create index if not exists clawbacks_pending_idx
  on public.payout_clawbacks(developer_id, created_at) where status = 'pending';

-- ── 5. Record this migration ───────────────────────────────────────────
insert into public.bbx_schema_migrations (name, applied_by, notes)
values ('12_stripe_connect_payouts.sql', 'andy',
        'Phase E Day 1: developers payout flags + publisher_balance + payouts ext + payout_clawbacks')
on conflict (name) do update
  set applied_by = excluded.applied_by,
      notes      = excluded.notes;

-- ═══════════════════════════════════════════════════════════════════════
-- Sanity checks (run after applying):
--
--   select column_name from information_schema.columns
--    where table_name='developers'
--      and column_name in ('payouts_enabled','payout_blocked','payout_blocked_reason',
--                          'payout_blocked_at','instant_payouts_enabled','stripe_requirements_due');
--   -- expect 6 rows
--
--   select to_regclass('public.publisher_balance'),
--          to_regclass('public.payouts'),
--          to_regclass('public.payout_clawbacks');
--   -- all three should be non-null
--
--   select count(*) from public.publisher_balance;
--   -- should equal: select count(*) from public.developers;
--
--   select column_name from information_schema.columns
--    where table_name='payouts'
--      and column_name in ('fee_usd','failure_reason','failure_tier','retry_count','method','completed_at');
--   -- expect 6 rows
-- ═══════════════════════════════════════════════════════════════════════
