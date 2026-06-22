-- =====================================================================
-- 30_placement_kind_and_autoreg_FIX.sql — column-shift bug
-- =====================================================================
--
-- The original 30 declared:
--   returns table (kind, surface, format, floor_cpm, freq_cap, display_name)
-- but the inner VALUES table has 7 columns (door first, used for the
-- WHERE filter). `select *` returned all 7, so column 4 of the output
-- got VALUES column 4 (format = text) instead of floor_cpm (numeric).
--
-- This fix re-creates the function with an explicit column list in the
-- SELECT, dropping the door column from the projection.
--
-- The auto_register_placements_for_developer function depends on this
-- one, but the dependency is by-name, so we just CREATE OR REPLACE the
-- inner one — the outer one keeps working without changes.
--
-- Safe to re-run. Idempotent.
-- =====================================================================

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
  -- Explicit column projection — DROPS the leading 'door' column from
  -- the inner VALUES table so the function's return-type columns line up
  -- correctly. Without this, `select *` would return 7 cols vs the 6
  -- the function declares, shifting types by one position.
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


-- ── Re-run the backfill ──────────────────────────────────────────────
-- The original migration's backfill loop ran AFTER the broken template
-- function was defined, so it silently inserted 0 rows. Re-run now that
-- the template returns the right shape.
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


-- Verify with:
--   select * from public.placement_template_for_door('mobile-app');
--   -- Expect 10 rows
--
--   select d.app_name, d.integration_door,
--          count(p.id) as n_placements
--   from public.developers d
--   left join public.placements p on p.developer_id = d.id
--   group by d.app_name, d.integration_door
--   order by d.created_at desc
--   limit 10;
