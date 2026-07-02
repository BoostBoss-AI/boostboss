-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — WAITLIST CAPTURE TABLE
-- Apply with: paste into Supabase → SQL Editor → Run.
--
-- Backs POST /api/waitlist. Email is unique so re-submits upsert cleanly
-- (the endpoint uses ignoreDuplicates). `source` tags where the signup came
-- from (e.g. 'bbx' for the BBX/exchange page).
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists waitlist (
  id          bigint generated always as identity primary key,
  email       text        not null unique,
  source      text        default 'web',
  ip          text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists waitlist_source_idx     on waitlist (source);
create index if not exists waitlist_created_at_idx on waitlist (created_at desc);
