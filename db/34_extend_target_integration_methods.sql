-- =====================================================================
-- 34_extend_target_integration_methods.sql — allow 'mobile-app' in
-- campaigns.target_integration_methods CHECK constraint
-- =====================================================================
--
-- The legacy CHECK on campaigns.target_integration_methods was added
-- when only the 4-pillar doors existed (mcp / js-snippet / npm-sdk /
-- rest-api). The new 4-door model (migration 30) added 'mobile-app'
-- to public.developers.integration_door, but the campaigns-side CHECK
-- was never updated.
--
-- Result: any campaign created with target_integration_methods including
-- 'mobile-app' (which the new 3-step wizard does by default since all
-- 4 doors are pre-checked) fails with:
--   new row for relation "campaigns" violates check constraint
--   "campaigns_target_integration_methods_chk"
--
-- Fix: drop + recreate the constraint with the expanded allowlist.
-- Idempotent — drop-if-exists then add fresh. Safe to re-run.
-- =====================================================================

-- ── 1. Drop the old constraint if it exists ─────────────────────────
do $$
declare
  v_constraint_name text;
begin
  -- Find any CHECK constraint on campaigns that references
  -- target_integration_methods. Name may vary by deploy history.
  for v_constraint_name in
    select conname
    from pg_constraint
    where conrelid = 'public.campaigns'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%target_integration_methods%'
  loop
    execute format('alter table public.campaigns drop constraint %I', v_constraint_name);
    raise notice '[migration 34] dropped check constraint %', v_constraint_name;
  end loop;
end $$;


-- ── 2. Add the fresh constraint with mobile-app included ─────────────
-- Uses the `<@` subset operator (every element of LHS array is in RHS
-- array). Subqueries aren't allowed in CHECK constraints — earlier draft
-- used an unnest+bool_and subquery and Postgres rejected it with
-- "cannot use subquery in check constraint". The subset operator is the
-- idiomatic array-validation pattern.
--
-- NULL and empty array are both vacuously valid (no elements to violate).
alter table public.campaigns
  add constraint campaigns_target_integration_methods_chk
  check (
    target_integration_methods is null
    or target_integration_methods <@ ARRAY['mcp','js-snippet','npm-sdk','rest-api','mobile-app']::text[]
  );


-- ── 3. Verify ─────────────────────────────────────────────────────────
-- After running, this should return one row showing the new constraint:
--   select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.campaigns'::regclass
--     and conname = 'campaigns_target_integration_methods_chk';
