-- ============================================================================
-- 25_user_mfa.sql — TOTP two-factor authentication factors per user.
--   (Renamed from 22_user_mfa.sql 2026-06-06 to resolve numbering
--    collision with the pre-existing 22_paypal_transactions.sql. Both
--    migrations create different objects so there's no DB conflict.)
--
-- One row per user once they've successfully verified an authenticator app.
-- The TOTP secret is stored as base32 ciphertext (the secret IS the
-- credential; rotate by deleting and re-enrolling). Service-role only access.
--
-- Applies to both publisher (developers) and advertiser (advertisers) roles —
-- the foreign key is auth.users so the same auth identity gets one factor
-- across both dashboards.
--
-- Step-up auth (for cashout requests, bank-detail changes) reads from this
-- table at verify time. Login flow is unchanged in v1 — no AAL2 enforcement
-- at session-start; this is purely step-up MFA for high-value actions.
--
-- Recovery codes deferred for v1. If a user loses access to their app,
-- support intervenes manually via the admin console. Recovery codes will
-- get their own table + flow as a follow-up migration.
-- ============================================================================

create table if not exists public.user_mfa (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  totp_secret    text        not null,
  friendly_name  text        not null default 'Authenticator',
  enrolled_at    timestamptz not null default now(),
  last_used_at   timestamptz,
  last_step_up_at timestamptz,
  -- counter of failed verify attempts since the last successful verify;
  -- the API short-circuits at 10 to slow down online guessing.
  failed_attempts integer not null default 0
);

comment on table  public.user_mfa is
  'TOTP factors. One row per enrolled user. totp_secret is base32 (RFC 4648).';
comment on column public.user_mfa.last_step_up_at is
  'Set when a successful TOTP verify is used to authorize a step-up action (cashout, bank-detail change).';

-- Enable RLS and lock it down: only service-role can read or write. The
-- frontend never touches this table directly — it goes through /api/auth
-- which validates the user's session JWT and proxies the operation.
alter table public.user_mfa enable row level security;

-- (No grants — service role bypasses RLS by default.)

-- Helpful index for the admin tooling that will eventually surface
-- "users with 2FA enrolled" — not used by the hot path.
create index if not exists idx_user_mfa_enrolled_at on public.user_mfa(enrolled_at);
