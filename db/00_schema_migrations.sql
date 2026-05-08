-- ───────────────────────────────────────────────────────────────────────
-- 00_schema_migrations.sql
-- Track which db/*.sql migration files have been applied to this database.
--
-- WHY (Phase A, surfaced 2026-05-08):
--   Previously migrations were applied informally by pasting into the
--   Supabase SQL Editor. Two of them (06_integration_method, 07_sandbox)
--   silently weren't applied to production, and we didn't notice for a
--   week — every track.js insert was being rejected with no operator
--   visibility. This table is the audit trail.
--
-- HOW TO USE:
--   1. Apply this file once: paste into Supabase SQL Editor, run.
--   2. After running ANY db/NN_*.sql file, INSERT a row recording it.
--   3. db/check.sql lists which files exist on disk vs which have
--      a row here, surfacing any drift.
--
-- This file is idempotent — re-running it does nothing harmful.
-- ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.bbx_schema_migrations (
  name        text PRIMARY KEY,
  applied_at  timestamptz NOT NULL DEFAULT now(),
  applied_by  text,                 -- 'andy' / 'cron' / etc., free-form
  notes       text                  -- optional commit hash, ticket ref, etc.
);

-- Backfill known-applied migrations. Use ON CONFLICT DO NOTHING so
-- re-running this file after fresh migrations is safe — it only adds
-- rows that aren't already there.
INSERT INTO public.bbx_schema_migrations (name, applied_by, notes) VALUES
  ('03_rtb_ledger.sql',                'backfill', 'pre-existing'),
  ('04_bbx_mcp_extensions.sql',        'backfill', 'pre-existing'),
  ('05_bbx_conversions.sql',           'backfill', 'pre-existing'),
  ('06_freq_cap.sql',                  'backfill', 'pre-existing'),
  ('06_integration_method.sql',        'backfill', 'applied 2026-05-08 during validation phase'),
  ('07_embedding_cache.sql',           'backfill', 'pre-existing'),
  ('07_sandbox.sql',                   'backfill', 'applied 2026-05-08 during validation phase'),
  ('08_auction_logs.sql',              'backfill', 'pre-existing'),
  ('08_voyage_embeddings.sql',         'backfill', 'pre-existing'),
  ('09_target_integration_methods.sql','backfill', 'pre-existing'),
  ('10_events_campaign_id_text.sql',   'backfill', 'applied 2026-05-08 during validation phase'),
  ('00_schema_migrations.sql',         'backfill', 'this file')
ON CONFLICT (name) DO NOTHING;

-- ── Helper: record a new migration after applying it ───────────────────
-- Run inside the SQL Editor right after applying any db/NN_*.sql file:
--   INSERT INTO bbx_schema_migrations (name, applied_by, notes)
--   VALUES ('11_my_new_migration.sql', 'andy', 'commit abc1234');
