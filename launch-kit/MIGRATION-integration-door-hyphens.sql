-- ────────────────────────────────────────────────────────────────────────
-- Boost Boss — developers.integration_door taxonomy alignment
--
-- Pre-2026-06-21 the column used underscore-separated values
--   ('mcp', 'js_snippet', 'npm_sdk', 'rest')
-- which were the OLD-WORLD taxonomy. The canonical 4-door taxonomy used
-- everywhere else in the system (Lumi SDK runtime, ad-tracking, marketing
-- pages, /publish/* docs) is hyphenated:
--   ('mcp', 'js-snippet', 'npm-sdk', 'rest-api')
--
-- This migration:
--   1. Converts any existing legacy underscored values to canonical
--      hyphens in place.
--   2. Replaces the CHECK constraint to accept the canonical taxonomy
--      AND the catch-all signals 'multiple' (publisher ships on more
--      than one surface) and 'other' (publisher hasn't decided yet),
--      which the primary signup form provides as legitimate answers.
--   3. NULL stays valid — publishers who skip the question keep no
--      classification rather than a wrong one.
--
-- Idempotent — safe to re-run.
-- ────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Migrate any legacy underscored values to canonical hyphens.
UPDATE public.developers
   SET integration_door = 'js-snippet'
 WHERE integration_door = 'js_snippet';

UPDATE public.developers
   SET integration_door = 'npm-sdk'
 WHERE integration_door = 'npm_sdk';

UPDATE public.developers
   SET integration_door = 'rest-api'
 WHERE integration_door = 'rest';

-- 'mcp' stays as 'mcp' — same in both taxonomies.

-- 2. Replace the CHECK constraint.
ALTER TABLE public.developers
  DROP CONSTRAINT IF EXISTS developers_integration_door_check;

ALTER TABLE public.developers
  ADD CONSTRAINT developers_integration_door_check
  CHECK (integration_door IS NULL
      OR integration_door IN (
           'mcp', 'js-snippet', 'npm-sdk', 'rest-api',
           'multiple', 'other'
         ));

-- 3. Comment is informational only — refresh it to match the new spec.
COMMENT ON COLUMN public.developers.integration_door IS
  'Primary integration door chosen during signup. One of mcp / js-snippet / '
  'npm-sdk / rest-api (the canonical 4-door taxonomy), or multiple / other '
  '(catch-all signals from the primary signup form), or NULL (skipped).';

COMMIT;

-- ── Sanity check after running ──
-- SELECT integration_door, COUNT(*) FROM public.developers
--  GROUP BY integration_door ORDER BY 2 DESC;
