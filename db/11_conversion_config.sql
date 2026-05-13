-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — CAMPAIGN-LEVEL CONVERSION CONFIG  (migration 11)
-- Apply with: paste into Supabase → SQL Editor.
--
-- Phase B (2026-05-11). Adds:
--   1. 'cpa' to campaigns.billing_model CHECK so advertisers can pay
--      per acquisition (charged when a matching conversion event lands).
--   2. campaigns.conversion_event_types — array of conversion_type strings
--      that count as a "conversion" for this campaign. Empty/null = any.
--      Example values: 'signup', 'purchase', 'lead', 'tool_invoke', 'install'.
--   3. Records this migration in bbx_schema_migrations.
--
-- All statements idempotent.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Drop old billing_model CHECK and re-add with 'cpa' included ──────
do $$
declare conname text;
begin
  select c.conname
    into conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
   where t.relname = 'campaigns'
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) ilike '%billing_model%';
  if conname is not null then
    execute format('alter table public.campaigns drop constraint %I', conname);
  end if;
end $$;

alter table public.campaigns
  add constraint campaigns_billing_model_check
  check (billing_model in ('cpm','cpc','cpv','cpa'));

-- ── 2. Add conversion_event_types ───────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'conversion_event_types'
  ) then
    alter table public.campaigns
      add column conversion_event_types text[] default array[]::text[];
  end if;
end $$;

-- ── 3. Index for the conversion-billing fast path ───────────────────────
-- When a conversion event lands, we look up campaigns where billing_model='cpa'
-- AND the conversion_type matches; this index speeds that up.
create index if not exists campaigns_cpa_idx
  on public.campaigns(id)
  where billing_model = 'cpa';

-- ── 4. Record this migration ────────────────────────────────────────────
-- bbx_schema_migrations is keyed on `name` (the filename). See
-- db/00_schema_migrations.sql for the table definition.
insert into public.bbx_schema_migrations (name, applied_by, notes)
values ('11_conversion_config.sql', 'andy',
        'Phase B: add cpa billing_model + conversion_event_types[] to campaigns')
on conflict (name) do update
  set applied_by = excluded.applied_by,
      notes      = excluded.notes;

-- ═══════════════════════════════════════════════════════════════════════
-- Sanity:
--   select column_name from information_schema.columns
--    where table_name = 'campaigns' and column_name = 'conversion_event_types';
--   -- expect 1 row
--
--   select pg_get_constraintdef(c.oid) from pg_constraint c
--    join pg_class t on t.oid = c.conrelid
--    where t.relname = 'campaigns' and c.conname = 'campaigns_billing_model_check';
--   -- expect: CHECK (billing_model IN ('cpm','cpc','cpv','cpa'))
-- ═══════════════════════════════════════════════════════════════════════
