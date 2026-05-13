-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — PER-DOOR CREATIVE OVERRIDES   (migration 14)
-- Apply with: paste into Supabase → SQL Editor.
--
-- Phase E.5 (2026-05-13). One campaign, one creative — but the same
-- creative renders very differently in each of the four publisher
-- "doors" (MCP responses, JS snippet on a website, NPM SDK in-app card,
-- REST API JSON). This table lets an advertiser override the copy +
-- media per door without forking the campaign.
--
-- Why a separate table instead of more columns on campaigns:
--   • campaigns has 30+ columns already — adding 24 more (6 fields × 4 doors)
--     is a maintenance disaster and balloons row size for the 90% of
--     campaigns that don't customise per door.
--   • Per-door rows let us add new doors later (e.g. "voice", "AR") without
--     another schema migration.
--   • Cleanly answers the "fall back to default" pattern via one SELECT.
--
-- Read path (api/mcp.js auction):
--   SELECT * FROM campaign_creatives
--    WHERE campaign_id = $1
--      AND door IN ($current_door, 'default')
--    ORDER BY (door = $current_door) DESC  -- prefer exact match
--    LIMIT 1;
--   If no rows → fall back to campaigns.headline/media_url/etc. (legacy
--   campaigns predate this table and keep working unchanged).
--
-- Write path (advertiser creating/updating a campaign):
--   • Always write a 'default' row mirroring the campaign-level copy.
--   • Write a per-door row ONLY when the advertiser explicitly overrode
--     something for that door. source='user-uploaded' on override rows,
--     source='inherited' on the default row.
--
-- All statements idempotent — re-running the file is safe.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Table ───────────────────────────────────────────────────────────
create table if not exists public.campaign_creatives (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.campaigns(id) on delete cascade,
  -- The four production doors + a sentinel 'default' row used as fallback
  -- when a door-specific override doesn't exist.
  door          text not null check (door in ('mcp','js-snippet','npm-sdk','rest-api','default')),
  headline      text,
  subtext       text,
  media_url     text,
  poster_url    text,
  cta_label     text,
  cta_url       text,
  -- 'user-uploaded' = advertiser explicitly customised this door.
  -- 'inherited'     = mirror of campaign-level copy, written automatically.
  -- Lets the UI render an "Edited" / "Default" badge per door without
  -- recomputing the diff every render.
  source        text not null default 'inherited'
                check (source in ('user-uploaded','inherited')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (campaign_id, door)
);

-- ── 2. Index for read path ─────────────────────────────────────────────
-- campaign_id is the dominant filter in the auction read path (one
-- lookup per won impression). Door is included for index-only scans on
-- the "prefer exact match, fall back to default" query.
create index if not exists idx_campaign_creatives_campaign_door
  on public.campaign_creatives(campaign_id, door);

-- ── 3. updated_at trigger ──────────────────────────────────────────────
-- Tiny convenience trigger so the application doesn't have to set
-- updated_at on every PATCH. Same pattern as existing tables.
create or replace function public.bbx_campaign_creatives_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_campaign_creatives_updated_at on public.campaign_creatives;
create trigger trg_campaign_creatives_updated_at
before update on public.campaign_creatives
for each row execute function public.bbx_campaign_creatives_set_updated_at();

-- ── 4. RLS ─────────────────────────────────────────────────────────────
-- Same policy as campaigns: an advertiser can read/write rows for
-- campaigns they own. service_role bypasses RLS for the auction path.
alter table public.campaign_creatives enable row level security;

do $$ begin
  drop policy if exists "Advertisers manage own creatives" on campaign_creatives;
  create policy "Advertisers manage own creatives" on campaign_creatives
    for all
    using (
      exists (
        select 1 from public.campaigns c
         where c.id = campaign_creatives.campaign_id
           and c.advertiser_id = auth.uid()
      )
    );

  -- Read-only access for active-campaign creatives is needed by the
  -- public auction path. service_role bypasses RLS, but for safety we
  -- also allow anon SELECT when the parent campaign is active.
  drop policy if exists "Active campaign creatives are readable" on campaign_creatives;
  create policy "Active campaign creatives are readable" on campaign_creatives
    for select
    using (
      exists (
        select 1 from public.campaigns c
         where c.id = campaign_creatives.campaign_id
           and c.status = 'active'
      )
    );
end $$;

-- ── 5. Backfill 'default' rows for existing active campaigns ──────────
-- Without this, the auction read path would have nothing to find for
-- legacy campaigns until their next edit. The api/mcp.js fallback handles
-- the empty case, but seeding the rows now means the new code path is
-- the only path going forward — easier to reason about and to test.
insert into public.campaign_creatives
  (campaign_id, door, headline, subtext, media_url, poster_url, cta_label, cta_url, source)
select
  c.id,
  'default',
  c.headline,
  c.subtext,
  c.media_url,
  c.poster_url,
  c.cta_label,
  c.cta_url,
  'inherited'
from public.campaigns c
on conflict (campaign_id, door) do nothing;

-- ── 6. Record this migration ──────────────────────────────────────────
insert into public.bbx_schema_migrations (name, applied_by, notes)
values ('14_per_door_creatives.sql', 'andy',
        'Phase E.5: per-door creative overrides table + RLS + backfill for active campaigns')
on conflict (name) do update
  set applied_by = excluded.applied_by,
      notes      = excluded.notes;

-- ═══════════════════════════════════════════════════════════════════════
-- Sanity checks (run after applying):
--
--   select count(*) from public.campaign_creatives where door = 'default';
--   -- expect ≥ count of campaigns in active/in_review status
--
--   -- Read path simulation — for any campaign, this is the auction lookup:
--   select * from public.campaign_creatives
--    where campaign_id = (select id from public.campaigns limit 1)
--      and door in ('mcp','default')
--    order by (door = 'mcp') desc
--    limit 1;
-- ═══════════════════════════════════════════════════════════════════════
