-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — ADVERTISER API KEYS
-- Apply with: paste into Supabase → SQL Editor → Run.
--
-- Backs api/api-keys.js (management) + api/_lib/advertiser_auth.js (auth).
-- Keys are SHOW-ONCE: we store only a SHA-256 hash + a short display prefix,
-- never the raw key. Losing the key = regenerate (revokes the old one).
-- One active (non-revoked) key per advertiser.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists advertiser_api_keys (
  id            bigint generated always as identity primary key,
  advertiser_id uuid        not null,                 -- auth.users(id)
  key_hash      text        not null unique,          -- sha256(full key)
  key_prefix    text        not null,                 -- first 16 chars, display only
  scopes        text[]      not null default array[
                  'campaigns.read','campaigns.write',
                  'products.read','products.write','reporting.read'],
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  revoked_at    timestamptz
);

-- One active key per advertiser (regenerate revokes the previous one).
create unique index if not exists advertiser_api_keys_one_active
  on advertiser_api_keys (advertiser_id) where revoked_at is null;

create index if not exists advertiser_api_keys_adv_idx
  on advertiser_api_keys (advertiser_id);

-- Only the service role (used by the API) touches this table. Enable RLS with
-- no policies so anon/authenticated clients can never read key hashes.
alter table advertiser_api_keys enable row level security;
