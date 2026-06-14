-- ──────────────────────────────────────────────────────────────────────
-- Boost Boss — developers.integration_door
-- ──────────────────────────────────────────────────────────────────────
-- Persist the integration "door" a publisher picked at onboarding
-- (one of the four installation paths under the publisher_integration_
-- architecture model). Used by the publisher dashboard to default the
-- "Get started" view to the right docs page + setup wizard, and by
-- product analytics to understand which door drives most installs.
--
-- NULL is allowed — every row created before this migration has it.
-- New rows from the cross-role complete_role_profile flow and from the
-- regular /publish/signup form will populate it.
--
-- Values match the door names used everywhere else in the codebase:
--   'mcp'        — Lumi SDK for MCP servers
--   'js_snippet' — Lumi SDK script tag
--   'npm_sdk'    — Lumi SDK for browser extensions / Electron
--   'rest'       — Lumi API for bots
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.developers
  ADD COLUMN IF NOT EXISTS integration_door text;

ALTER TABLE public.developers
  DROP CONSTRAINT IF EXISTS developers_integration_door_check;
ALTER TABLE public.developers
  ADD CONSTRAINT developers_integration_door_check
  CHECK (integration_door IS NULL
      OR integration_door IN ('mcp', 'js_snippet', 'npm_sdk', 'rest'));

COMMENT ON COLUMN public.developers.integration_door IS
  'Primary integration the publisher picked at onboarding. Drives the '
  'default Get-Started tab in the publisher dashboard. NULL for accounts '
  'created before 2026-06-14. See [[publisher_integration_architecture]].';

-- Index — small selectivity payoff today, but the publisher analytics
-- screen will want to bucket installs by door, so add it ahead of need.
CREATE INDEX IF NOT EXISTS developers_integration_door_idx
  ON public.developers (integration_door)
  WHERE integration_door IS NOT NULL;

COMMIT;

-- Smoke check:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name='developers' AND column_name='integration_door';
--   SELECT integration_door, count(*) FROM public.developers
--    GROUP BY integration_door ORDER BY 2 DESC;
