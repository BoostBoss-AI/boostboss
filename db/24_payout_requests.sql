-- ============================================================================
-- 24_payout_requests.sql — Publisher cashout requests.
--
-- One row per publisher cashout. The publisher's available balance is
-- decremented at request time (so they can't re-request the same balance
-- twice). Andy runs Payoneer Mass Payout batches every other Friday by
-- exporting the pending rows for that target_payout_date, uploading the CSV
-- to Payoneer, then marking the batch paid.
--
-- Lifecycle:
--   pending   → just created, balance already deducted from publisher_balance
--   batched   → admin exported it into a Payoneer batch; status frozen
--   paid      → Payoneer confirmed the transfer; final state
--   failed    → batch was rejected by Payoneer/bank; balance is refunded back
--               to publisher_balance via the same RPC used at credit time
--   cancelled → publisher cancelled the pending request; balance refunded
--
-- bank_snapshot freezes the routing details at the moment of request, so a
-- publisher who later changes their bank info doesn't affect already-batched
-- payouts.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payout_request_status') then
    create type public.payout_request_status as enum (
      'pending', 'batched', 'paid', 'failed', 'cancelled'
    );
  end if;
end$$;

create table if not exists public.payout_requests (
  id                  uuid primary key default gen_random_uuid(),
  publisher_id        uuid not null references auth.users(id) on delete cascade,
  amount_usd          numeric(12, 2) not null check (amount_usd > 0),
  status              public.payout_request_status not null default 'pending',
  target_payout_date  date not null,
  batch_id            text,
  bank_snapshot       jsonb not null,
  created_at          timestamptz not null default now(),
  batched_at          timestamptz,
  paid_at             timestamptz,
  failure_reason      text
);

comment on table public.payout_requests is
  'Publisher cashout requests. Balance is deducted on insert; refunded on failure or cancellation.';
comment on column public.payout_requests.target_payout_date is
  'The Friday this request will be paid out on (or null-shifted to next Friday if the Tuesday cutoff is missed).';
comment on column public.payout_requests.batch_id is
  'Set when the admin exports a CSV. Groups all requests for one Payoneer Mass Payout upload.';
comment on column public.payout_requests.bank_snapshot is
  'Frozen copy of publisher_payout_methods at request time. Changing bank info later does not affect already-pending payouts.';

create index if not exists idx_payout_requests_publisher
  on public.payout_requests (publisher_id, created_at desc);
create index if not exists idx_payout_requests_status_target
  on public.payout_requests (status, target_payout_date);
create index if not exists idx_payout_requests_batch
  on public.payout_requests (batch_id) where batch_id is not null;

alter table public.payout_requests enable row level security;
-- No grants. Service role bypasses RLS; all access is through /api/payouts.
