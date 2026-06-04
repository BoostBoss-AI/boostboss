-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — TERMS ACCEPTANCES SCHEMA  (migration 21)
-- Apply with: paste into Supabase → SQL Editor.
--
-- Captures legal consent from advertisers and publishers at signup and
-- on subsequent term updates. Required for legally-defensible consent
-- under GDPR, CCPA, PIPL, and TW personal data law.
--
-- Each acceptance records:
--   • Which user
--   • Which document (terms / privacy / refunds / aup / publisher-agreement /
--     advertiser-terms / cookies)
--   • Which version of the document
--   • Timestamp + IP + user-agent (audit trail)
--
-- Phase 1 of PayPal+Payoneer migration (2026-06-04). Created before
-- the billing rewrite because signup UX changes block on this table.
--
-- All statements idempotent — safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. terms_acceptances table ─────────────────────────────────────────
create table if not exists public.terms_acceptances (
  id                 uuid primary key default gen_random_uuid(),
  user_id            text not null,         -- references advertisers.id or developers.id
  user_role          text not null check (user_role in ('advertiser', 'publisher', 'both')),
  terms_type         text not null check (terms_type in (
    'terms_of_service',
    'privacy_policy',
    'refund_policy',
    'acceptable_use_policy',
    'cookie_policy',
    'publisher_agreement',
    'advertiser_terms'
  )),
  terms_version      text not null,         -- e.g. "1.0" — matches version in document footer
  terms_version_hash text,                  -- SHA-256 of the rendered document at the time of acceptance
  document_url       text,                  -- snapshot URL e.g. "https://boostboss.ai/terms"
  accepted_at        timestamptz not null default now(),
  ip_address         inet,                  -- recorded from request headers
  user_agent         text,                  -- recorded from request headers
  acceptance_method  text default 'click_through' check (acceptance_method in (
    'click_through',  -- user clicked an "I agree" checkbox
    'browse_wrap',    -- implied via continued use after notice
    'sign_up_form',   -- agreed during signup form submission
    're_consent',     -- re-prompted after terms update
    'api_consent',    -- accepted via API call (programmatic publisher onboarding)
    'admin_override'  -- recorded by admin (manual addition, rare)
  )),
  metadata           jsonb default '{}'::jsonb,  -- extensible for future fields (locale, source page, etc.)
  created_at         timestamptz not null default now()
);

-- ── 2. Indexes for common queries ──────────────────────────────────────
create index if not exists idx_terms_acceptances_user_id on public.terms_acceptances(user_id);
create index if not exists idx_terms_acceptances_user_role on public.terms_acceptances(user_role);
create index if not exists idx_terms_acceptances_terms_type on public.terms_acceptances(terms_type);
create index if not exists idx_terms_acceptances_accepted_at on public.terms_acceptances(accepted_at desc);

-- ── 3. Composite index for "has this user accepted this document?" lookup ──
create unique index if not exists idx_terms_acceptances_user_doc_version
  on public.terms_acceptances(user_id, terms_type, terms_version);
-- NOTE: unique constraint prevents accidentally recording the same acceptance
-- twice. If we re-prompt on a new version, we record a new row with new version.

-- ── 4. Helper view: latest accepted version per user/document ──────────
create or replace view public.terms_acceptances_latest as
  select distinct on (user_id, terms_type)
    user_id, user_role, terms_type, terms_version, accepted_at, ip_address
  from public.terms_acceptances
  order by user_id, terms_type, accepted_at desc;

-- ── 5. Row-Level Security ──────────────────────────────────────────────
alter table public.terms_acceptances enable row level security;

-- Users can see their own acceptances
drop policy if exists "terms_acceptances_own_select" on public.terms_acceptances;
create policy "terms_acceptances_own_select" on public.terms_acceptances
  for select using (
    user_id = current_setting('request.jwt.claim.sub', true)
  );

-- Service role can insert (signup flow runs server-side)
drop policy if exists "terms_acceptances_service_insert" on public.terms_acceptances;
create policy "terms_acceptances_service_insert" on public.terms_acceptances
  for insert with check (true);

-- Service role can update (rare — e.g. correcting a recorded IP)
drop policy if exists "terms_acceptances_service_update" on public.terms_acceptances;
create policy "terms_acceptances_service_update" on public.terms_acceptances
  for update using (true);

-- ── 6. Migration log entry ─────────────────────────────────────────────
-- NOTE: table is bbx_schema_migrations (created by db/00_schema_migrations.sql),
-- not "schema_migrations". Project convention.
insert into public.bbx_schema_migrations (name, applied_by, notes)
values ('21_terms_acceptances.sql', 'andy',
        'Phase 1 of PayPal+Payoneer migration: legal consent tracking for GDPR/CCPA/PIPL compliance')
on conflict (name) do nothing;

-- ── 7. Document current terms versions (informational; can be overridden in app code) ──
-- These are the active version numbers as of this migration. Update them
-- when you publish new legal documents.
comment on table public.terms_acceptances is
  'Active versions as of 2026-06-04: terms_of_service=1.0, privacy_policy=1.0, refund_policy=1.0, acceptable_use_policy=1.0, cookie_policy=1.0, publisher_agreement=1.0, advertiser_terms=1.0';
