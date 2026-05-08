-- ───────────────────────────────────────────────────────────────────────
-- 10_events_campaign_id_text.sql
-- Loosen events.campaign_id from uuid to text.
--
-- Why: sandbox creatives (api/_lib/sandbox.js) use synthetic IDs like
-- 'cmp_sandbox_billing_native' that are NOT valid UUIDs. Production
-- writes used real UUIDs. The events table is an analytics/tracking log,
-- not a foreign-key target — keeping it strict here blocked sandbox
-- traffic from ever landing in events. The campaigns table keeps
-- id uuid; this only changes the tracking-side reference column.
--
-- Surfaced by Door 4 / Telegram internal validation 2026-05-08:
-- impression beacons fired but never wrote any rows because Postgres
-- rejected the insert with "invalid input syntax for type uuid".
--
-- Apply via Supabase SQL Editor → run the whole file. Idempotent.
-- ───────────────────────────────────────────────────────────────────────

-- Drop the view that depends on this column (created by 07_sandbox.sql).
-- Postgres won't let us alter a column type while a view references it.
DROP VIEW IF EXISTS events_production;

-- Drop FK if any (in case earlier setups had one — current schema doesn't)
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_campaign_id_fkey;

-- Loosen the column type. Postgres casts uuid → text trivially, so all
-- existing rows preserve their value (just stored as the canonical
-- 8-4-4-4-12 hex string with dashes).
ALTER TABLE events
  ALTER COLUMN campaign_id TYPE text
  USING campaign_id::text;

-- Recreate the view with the new column type. Same definition as 07.
CREATE OR REPLACE VIEW events_production AS
  SELECT * FROM events WHERE is_sandbox = FALSE;

-- Note: dashboard queries that compare events.campaign_id to
-- campaigns.id (uuid) still work because Postgres does implicit
-- text → uuid casting in equality comparisons. If a future query
-- breaks, add an explicit cast: events.campaign_id::uuid = campaigns.id
