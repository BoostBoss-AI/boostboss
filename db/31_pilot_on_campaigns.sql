-- =====================================================================
-- 31_pilot_on_campaigns.sql — move Pilot fields to where they belong
-- =====================================================================
--
-- Per Andy's clarification 2026-06-24: the Pilot/Boost Ads tab operates
-- on Campaigns, not Products. Products are the passive affiliate-
-- marketplace catalog. Campaigns are the active ads that ship to the 37
-- placements.
--
-- Migration 26 mistakenly added boost_* fields to products. Migration 28
-- added creative_* arrays there. This migration moves those concerns to
-- the campaigns table where they actually belong. Products columns are
-- left in place for back-compat — a follow-up migration can drop them
-- after the UI/auction pivot lands and is verified.
--
-- REUSED existing campaign columns (NOT re-added):
--   daily_budget        — already there (USD numeric)
--   total_budget        — already there
--   spent_total         — already there
--   status              — extended below to include 'depleted'
--   headline / subtext / media_url / cta_label / cta_url — default creative
--
-- ADDED here:
--   boost_objective         — awareness / clicks / signups / conversion / install
--   boost_pacing            — slider 0..1
--   boost_reach             — slider 0..1
--   boost_brand_safety      — slider 0..1
--   boost_creative_refresh  — slider 0..1
--   boost_confidence_floor  — slider 0..1
--   boost_activated_at      — first-active timestamp
--   creative_headlines      — text[] variants for bandit
--   creative_body_copy      — text[] variants
--   creative_cta_labels     — text[] variants
--   creative_library_ready  — bool, auto-computed via trigger
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- ── 1. Extend the status check constraint to include 'depleted' ──────
do $$
declare
  v_constraint text;
begin
  -- Find the existing CHECK constraint on status (Postgres auto-names it)
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.campaigns'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%status%';

  if v_constraint is not null then
    execute format('alter table public.campaigns drop constraint %I', v_constraint);
  end if;

  alter table public.campaigns
    add constraint campaigns_status_chk
    check (status in ('active','paused','in_review','completed','rejected','depleted'));
end $$;


-- ── 2. Boost model fields ────────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'boost_objective'
  ) then
    alter table public.campaigns
      add column boost_objective text default 'awareness'
        check (boost_objective in ('awareness','clicks','signups','conversion','install'));
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'boost_pacing'
  ) then
    alter table public.campaigns
      add column boost_pacing numeric(3,2) default 0.50
        check (boost_pacing >= 0 and boost_pacing <= 1);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'boost_reach'
  ) then
    alter table public.campaigns
      add column boost_reach numeric(3,2) default 0.50
        check (boost_reach >= 0 and boost_reach <= 1);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'boost_brand_safety'
  ) then
    alter table public.campaigns
      add column boost_brand_safety numeric(3,2) default 0.50
        check (boost_brand_safety >= 0 and boost_brand_safety <= 1);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'boost_creative_refresh'
  ) then
    alter table public.campaigns
      add column boost_creative_refresh numeric(3,2) default 0.50
        check (boost_creative_refresh >= 0 and boost_creative_refresh <= 1);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'boost_confidence_floor'
  ) then
    alter table public.campaigns
      add column boost_confidence_floor numeric(3,2) default 0.30
        check (boost_confidence_floor >= 0 and boost_confidence_floor <= 1);
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'boost_activated_at'
  ) then
    alter table public.campaigns
      add column boost_activated_at timestamptz;
  end if;
end $$;


-- ── 3. Creative variant arrays + readiness flag ──────────────────────
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'creative_headlines'
  ) then
    alter table public.campaigns
      add column creative_headlines text[] default '{}';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'creative_body_copy'
  ) then
    alter table public.campaigns
      add column creative_body_copy text[] default '{}';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'creative_cta_labels'
  ) then
    alter table public.campaigns
      add column creative_cta_labels text[] default '{}';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'campaigns' and column_name = 'creative_library_ready'
  ) then
    alter table public.campaigns
      add column creative_library_ready boolean default false;
  end if;
end $$;


-- ── 4. compute_campaign_creative_ready function ──────────────────────
-- Mirror of products' helper. A campaign is ready when it has 3+ headline
-- variants AND a creative image (campaign.media_url or campaign.poster_url).
create or replace function public.compute_campaign_creative_ready(
  p_headlines   text[],
  p_media_url   text,
  p_poster_url  text
) returns boolean
language plpgsql
immutable
as $$
declare
  v_headline_count int;
  v_has_image      boolean;
begin
  v_headline_count := coalesce(array_length(p_headlines, 1), 0);
  v_has_image := (p_media_url is not null and p_media_url <> '')
              or (p_poster_url is not null and p_poster_url <> '');
  return v_headline_count >= 3 and v_has_image;
end;
$$;


-- ── 5. Trigger — keep creative_library_ready in sync on every write ──
create or replace function public.campaigns_recompute_creative_ready()
returns trigger
language plpgsql
as $$
begin
  new.creative_library_ready := public.compute_campaign_creative_ready(
    new.creative_headlines,
    new.media_url,
    new.poster_url
  );
  return new;
end;
$$;

drop trigger if exists trg_campaigns_creative_ready on public.campaigns;
create trigger trg_campaigns_creative_ready
  before insert or update of creative_headlines, media_url, poster_url
  on public.campaigns
  for each row
  execute function public.campaigns_recompute_creative_ready();


-- ── 6. Backfill creative_library_ready for existing campaigns ────────
update public.campaigns
   set creative_library_ready = public.compute_campaign_creative_ready(
     creative_headlines, media_url, poster_url
   )
 where true;


-- ── 7. Indexes — hot path is "give me active boosts for the auction" ─
create index if not exists campaigns_active_boost_idx
  on public.campaigns(status, boost_activated_at)
  where status = 'active';

create index if not exists campaigns_objective_idx
  on public.campaigns(boost_objective)
  where status = 'active';


-- Verify with:
--   select id, name, status, boost_objective,
--          boost_pacing, boost_reach, boost_confidence_floor,
--          array_length(creative_headlines, 1) as n_head,
--          creative_library_ready
--   from public.campaigns
--   order by created_at desc
--   limit 5;
