-- =====================================================================
-- 30_placement_kind_and_autoreg.sql — placement kind + per-door auto-reg
-- =====================================================================
--
-- Two things:
--   1. Add `kind` to placements (e.g. 'corner', 'bottom_banner', 'rewarded_video')
--      so the SDK's per-impression call resolves to the publisher's right
--      row via (developer_id, kind) instead of needing a UUID the SDK
--      doesn't know.
--   2. Add a function `auto_register_placements_for_developer(uuid, text)`
--      that inserts the per-door placement set (8/8/11/10) for a publisher
--      based on their integration_door. Called from /api/auth signup +
--      run once for every existing developer below.
--
-- See [[advertiser-pilot-model]] memory. Without this, mobile SDKs ship
-- ads requests that never match anything — auction returns no-fill.
--
-- Idempotent — uses IF NOT EXISTS, ON CONFLICT DO NOTHING. Safe to re-run.
-- =====================================================================

-- ── 1. kind column ──────────────────────────────────────────────────
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'placements' and column_name = 'kind'
  ) then
    alter table public.placements
      add column kind text;
  end if;
end $$;

-- Backfill kind from name where it's empty.
-- name like "Chat inline default" → kind = 'card' (best-effort).
-- Existing rows mostly have null kind anyway; this is a no-op for them.
update public.placements
   set kind = lower(regexp_replace(coalesce(name, ''), '[^a-z0-9_]+', '_', 'g'))
 where kind is null
   and coalesce(name, '') <> '';

-- ── 2. Unique constraint (developer_id, kind) ───────────────────────
-- One placement per (publisher, kind) — prevents accidental duplicates
-- if the auto-register RPC runs twice for the same developer.
do $$ begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'placements_developer_kind_unique_idx'
  ) then
    create unique index placements_developer_kind_unique_idx
      on public.placements(developer_id, kind)
      where kind is not null;
  end if;
end $$;

-- ── 3. The per-door placement set ────────────────────────────────────
-- This function returns the canonical list of (kind, surface, format,
-- floor_cpm, freq_cap, name) tuples for a given integration_door. Edit
-- HERE when adding new placements — the RPC below reads from this single
-- source of truth.
--
-- Door mapping (matches the [[publisher-taxonomy]] convention):
--   'js-snippet' → Browser App        (8 placements)
--   'npm-sdk'    → Browser Extension App (8 placements)
--   'mcp'        → Computer App       (11 = 8 browser + 3 desktop-only)
--   'mobile-app' → Mobile App         (10 placements, new door key)
--
-- Surface mapping respects the existing surface enum (chat / tool_response
-- / sidebar / loading_screen / status_line / web). Mobile placements map
-- to existing surfaces — see [[advertiser-pilot-model]] for the rationale.
create or replace function public.placement_template_for_door(
  p_door text
) returns table (
  kind          text,
  surface       text,
  format        text,
  floor_cpm     numeric,
  freq_cap      int,
  display_name  text
)
language sql
immutable
as $$
  -- Explicit column projection — drops the leading 'door' column from
  -- the inner VALUES so the function's 6 return columns line up. The
  -- FIX migration (30_placement_kind_and_autoreg_FIX.sql) is for
  -- already-deployed DBs that ran the buggy first draft.
  select t.kind, t.surface, t.format, t.floor_cpm, t.freq_cap, t.display_name
  from (values
    -- ── Browser App (js-snippet) — 8 ──────────────────────────────
    ('js-snippet'::text, 'corner'::text,        'sidebar'::text,        'native'::text,    1.50::numeric, 5, 'Corner unit'::text),
    ('js-snippet',       'citation',            'chat',                 'text_card',       1.00,          8, 'Sponsored citation'),
    ('js-snippet',       'chip',                'chat',                 'text_card',       0.80,         10, 'Suggested chip'),
    ('js-snippet',       'card',                'chat',                 'native',          1.20,          6, 'Inline sponsored card'),
    ('js-snippet',       'hero',                'loading_screen',       'native',          1.40,          3, 'Empty-state hero'),
    ('js-snippet',       'loading',             'loading_screen',       'native',          1.30,          4, 'Loading-state ad'),
    ('js-snippet',       'settings',            'web',                  'native',          1.10,          2, 'Settings page slot'),
    ('js-snippet',       'interstitial',        'tool_response',        'image',           2.00,          1, 'Page interstitial'),

    -- ── Browser Extension App (npm-sdk) — 8 ───────────────────────
    ('npm-sdk',          'popup_card',          'sidebar',              'native',          1.50,          5, 'Popup card'),
    ('npm-sdk',          'side_panel',          'sidebar',              'native',          1.60,          4, 'Side panel slot'),
    ('npm-sdk',          'new_tab',             'web',                  'image',           2.50,          3, 'New-tab takeover'),
    ('npm-sdk',          'install_onboarding',  'web',                  'native',          1.30,          1, 'Install onboarding'),
    ('npm-sdk',          'citation',            'chat',                 'text_card',       1.00,          8, 'Sponsored citation'),
    ('npm-sdk',          'chip',                'chat',                 'text_card',       0.80,         10, 'Suggested chip'),
    ('npm-sdk',          'card',                'chat',                 'native',          1.20,          6, 'Inline sponsored card'),
    ('npm-sdk',          'loading',             'loading_screen',       'native',          1.30,          4, 'Loading-state ad'),

    -- ── Computer App (mcp) — 8 browser + 3 desktop-only = 11 ───────
    ('mcp',              'corner',              'sidebar',              'native',          1.50,          5, 'Corner unit'),
    ('mcp',              'citation',            'chat',                 'text_card',       1.00,          8, 'Sponsored citation'),
    ('mcp',              'chip',                'chat',                 'text_card',       0.80,         10, 'Suggested chip'),
    ('mcp',              'card',                'chat',                 'native',          1.20,          6, 'Inline sponsored card'),
    ('mcp',              'hero',                'loading_screen',       'native',          1.40,          3, 'Empty-state hero'),
    ('mcp',              'loading',             'loading_screen',       'native',          1.30,          4, 'Loading-state ad'),
    ('mcp',              'settings',            'web',                  'native',          1.10,          2, 'Settings page slot'),
    ('mcp',              'interstitial',        'tool_response',        'image',           2.00,          1, 'Page interstitial'),
    ('mcp',              'window_banner',       'status_line',          'image',           1.40,          6, 'Window banner'),
    ('mcp',              'sidebar',             'sidebar',              'native',          1.60,          4, 'Sidebar slot'),
    ('mcp',              'system_notification', 'tool_response',        'image',           2.20,          2, 'System notification'),

    -- ── Mobile App (mobile-app) — 10 ──────────────────────────────
    ('mobile-app',       'bottom_banner',         'sidebar',            'image',           1.50,          6, 'Bottom banner'),
    ('mobile-app',       'splash_sponsor',        'loading_screen',     'native',          2.00,          1, 'Splash sponsor'),
    ('mobile-app',       'inline_native_banner',  'chat',               'image',           1.20,          8, 'Inline native banner'),
    ('mobile-app',       'inline_sponsored_card', 'chat',               'native',          1.30,          6, 'Inline sponsored card'),
    ('mobile-app',       'sponsored_citation',    'chat',               'text_card',       1.00,          8, 'Sponsored citation'),
    ('mobile-app',       'suggested_chip',        'chat',               'text_card',       0.80,         10, 'Suggested chip'),
    ('mobile-app',       'loading_state_ad',      'loading_screen',     'native',          1.30,          4, 'Loading-state ad'),
    ('mobile-app',       'interstitial',          'tool_response',      'image',           2.50,          1, 'Interstitial'),
    ('mobile-app',       'rewarded_video',        'tool_response',      'video',           8.00,          3, 'Rewarded video'),
    ('mobile-app',       'pre_roll_video',        'tool_response',      'video',           4.50,          2, 'Pre-roll video')
  ) as t (door, kind, surface, format, floor_cpm, freq_cap, display_name)
  where t.door = p_door;
$$;


-- ── 4. auto_register_placements_for_developer ───────────────────────
-- INSERTs one row per template entry for the given developer + door.
-- Idempotent: ON CONFLICT (developer_id, kind) DO NOTHING. Returns the
-- number of rows newly inserted (0 if all already existed).
create or replace function public.auto_register_placements_for_developer(
  p_developer_id uuid,
  p_door         text
) returns int
language plpgsql
security definer
as $$
declare
  v_app_id text;
  v_inserted int := 0;
  v_row record;
begin
  -- Skip doors that don't have a defined template (multiple/other/rest-api)
  if p_door is null or p_door not in ('js-snippet', 'npm-sdk', 'mcp', 'mobile-app') then
    return 0;
  end if;

  -- Pull the developer's app_id (denormalised on placements rows)
  select app_id into v_app_id
  from public.developers
  where id = p_developer_id;
  if v_app_id is null then return 0; end if;

  for v_row in
    select * from public.placement_template_for_door(p_door)
  loop
    begin
      insert into public.placements (
        developer_id, app_id, name, kind, surface, format,
        floor_cpm, freq_cap_per_user_per_day, status
      ) values (
        p_developer_id, v_app_id, v_row.display_name, v_row.kind, v_row.surface, v_row.format,
        v_row.floor_cpm, v_row.freq_cap, 'active'
      )
      on conflict (developer_id, kind) where kind is not null do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    exception when others then
      -- Best-effort — log to stderr but keep going. A single bad row
      -- shouldn't stop the rest of the door's set from landing.
      raise notice '[auto_register] failed for door=% kind=% err=%', p_door, v_row.kind, sqlerrm;
    end;
  end loop;

  return v_inserted;
end;
$$;

grant execute on function public.auto_register_placements_for_developer(uuid, text) to service_role;


-- ── 5. Backfill existing developers ─────────────────────────────────
-- One-time pass: for every developer with an integration_door set, call
-- the RPC. Existing rows protected by the unique constraint.
do $$
declare
  v_dev record;
  v_inserted int;
begin
  for v_dev in
    select id, integration_door
    from public.developers
    where integration_door is not null
  loop
    v_inserted := public.auto_register_placements_for_developer(v_dev.id, v_dev.integration_door);
    if v_inserted > 0 then
      raise notice '[backfill] developer=% door=% inserted=%', v_dev.id, v_dev.integration_door, v_inserted;
    end if;
  end loop;
end $$;


-- ── 6. Expand integration_door whitelist to allow 'mobile-app' ──────
-- The developers table CHECK constraint currently allows the legacy
-- 4-pillar values + 'multiple' / 'other'. The new Pilot-aligned 4-door
-- model needs 'mobile-app' too. See [[advertiser-pilot-model]].
do $$
declare
  v_constraint_name text;
begin
  select conname into v_constraint_name
  from pg_constraint
  where conrelid = 'public.developers'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%integration_door%';

  if v_constraint_name is not null then
    execute format('alter table public.developers drop constraint %I', v_constraint_name);
  end if;

  alter table public.developers
    add constraint developers_integration_door_chk
    check (integration_door is null
        or integration_door in (
          'mcp', 'js-snippet', 'npm-sdk', 'rest-api',  -- legacy 4-pillar
          'mobile-app',                                -- new 4-door key
          'multiple', 'other'
        ));
end $$;


-- Verify with:
--   -- How many placements per developer / per door?
--   select d.app_name, d.integration_door,
--          count(p.id) as n_placements
--   from public.developers d
--   left join public.placements p on p.developer_id = d.id
--   group by d.app_name, d.integration_door
--   order by d.created_at desc
--   limit 10;
--
--   -- What's the Mobile App template look like?
--   select * from public.placement_template_for_door('mobile-app');
