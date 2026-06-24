-- =====================================================================
-- 32_pilot_spend_on_campaigns.sql — re-point spend RPCs at campaigns
-- =====================================================================
--
-- Phase D.3 + D.4 of the [[advertiser-pilot-model]] pivot 2026-06-24.
--
-- Migrations 27 + 29 wrote two RPCs that operated on products:
--   - increment_boost_spend(p_product_id, p_cents)
--   - get_pilot_spend_summary(p_product_id, p_advertiser_id)
--
-- After moving Pilot ownership to campaigns (migration 31), both need
-- to be re-pointed. We drop the old signatures and create new ones
-- keyed on campaign_id.
--
-- The spend itself lands in campaigns.spent_total (existing column,
-- numeric in USD), not a new boost_spent_cents column — campaigns
-- already have the right shape.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

-- ── 1. Drop the old product-keyed signatures ─────────────────────────
drop function if exists public.increment_boost_spend(uuid, int);
drop function if exists public.get_pilot_spend_summary(uuid, uuid);


-- ── 2. increment_boost_spend (campaign) ──────────────────────────────
-- Called from api/mcp.js after a campaign wins an auction. Increments
-- campaigns.spent_total by debit USD, and atomically flips the campaign
-- to status='depleted' when spent_total crosses total_budget.
--
-- API change: parameter renamed p_product_id → p_campaign_id, and the
-- cents value is converted to USD inside (campaigns.spent_total is USD).
create or replace function public.increment_boost_spend(
  p_campaign_id uuid,
  p_cents       int
) returns void
language plpgsql
security definer
as $$
declare
  v_cap_usd   numeric;
  v_total_usd numeric;
  v_debit_usd numeric;
begin
  if p_cents is null or p_cents <= 0 then return; end if;
  v_debit_usd := p_cents::numeric / 100.0;

  update public.campaigns
     set spent_total = coalesce(spent_total, 0) + v_debit_usd,
         updated_at  = now()
   where id = p_campaign_id
     and status in ('active', 'paused')  -- never debit completed/rejected/depleted
  returning total_budget, spent_total
        into v_cap_usd, v_total_usd;

  -- Auto-deplete when total_budget cap is set (>0) and we've crossed it.
  if v_cap_usd is not null and v_cap_usd > 0 and v_total_usd >= v_cap_usd then
    update public.campaigns
       set status     = 'depleted',
           updated_at = now()
     where id = p_campaign_id
       and status = 'active';
  end if;
end;
$$;

grant execute on function public.increment_boost_spend(uuid, int) to service_role;


-- ── 3. get_pilot_spend_summary (campaign) ────────────────────────────
-- Called from /api/pilot-spend.js. Returns the breakdown the Boost Ads
-- spend allocation panel renders: totals + by_door + by_placement +
-- by_publisher + last_14_days.
--
-- All events for a campaign already use the campaign's real UUID as
-- events.campaign_id — no 'pboost_' prefix anymore.
create or replace function public.get_pilot_spend_summary(
  p_campaign_id   uuid,
  p_advertiser_id uuid
) returns jsonb
language plpgsql
stable
security definer
as $$
declare
  v_owner_check int;
begin
  -- Ownership — caller must own the campaign.
  select count(*) into v_owner_check
  from public.campaigns
  where id = p_campaign_id
    and advertiser_id = p_advertiser_id;

  if v_owner_check = 0 then
    return jsonb_build_object('error', 'campaign_not_found_or_not_owned');
  end if;

  return jsonb_build_object(
    'campaign_id', p_campaign_id,

    'totals', (
      select jsonb_build_object(
        'impressions',       coalesce(count(*) filter (where event_type = 'impression'), 0),
        'clicks',            coalesce(count(*) filter (where event_type = 'click'),      0),
        'video_completes',   coalesce(count(*) filter (where event_type = 'video_complete'), 0),
        'spend_cents',       coalesce(round(sum(coalesce(cost, 0)) * 100)::int, 0),
        'impressions_today', coalesce(count(*) filter (where event_type = 'impression' and created_at >= current_date), 0),
        'spend_cents_today', coalesce(round(sum(coalesce(cost, 0)) filter (where created_at >= current_date) * 100)::int, 0)
      )
      from public.events
      where campaign_id = p_campaign_id::text
    ),

    'by_door', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.spend_cents desc), '[]'::jsonb)
      from (
        select integration_method                                                                as door,
               count(*) filter (where event_type = 'impression')                                 as impressions,
               count(*) filter (where event_type = 'click')                                      as clicks,
               coalesce(round(sum(coalesce(cost, 0)) * 100)::int, 0)                             as spend_cents
        from public.events
        where campaign_id = p_campaign_id::text
          and integration_method is not null
        group by integration_method
      ) t
    ),

    'by_placement', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.spend_cents desc), '[]'::jsonb)
      from (
        select placement_id,
               surface,
               count(*) filter (where event_type = 'impression')           as impressions,
               count(*) filter (where event_type = 'click')                as clicks,
               coalesce(round(sum(coalesce(cost, 0)) * 100)::int, 0)       as spend_cents
        from public.events
        where campaign_id = p_campaign_id::text
          and (placement_id is not null or surface is not null)
        group by placement_id, surface
        order by spend_cents desc
        limit 10
      ) t
    ),

    'by_publisher', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'developer_id', t.developer_id,
        'app_name',     d.app_name,
        'impressions',  t.impressions,
        'clicks',       t.clicks,
        'spend_cents',  t.spend_cents
      ) order by t.spend_cents desc), '[]'::jsonb)
      from (
        select developer_id,
               count(*) filter (where event_type = 'impression')           as impressions,
               count(*) filter (where event_type = 'click')                as clicks,
               coalesce(round(sum(coalesce(cost, 0)) * 100)::int, 0)       as spend_cents
        from public.events
        where campaign_id = p_campaign_id::text
          and developer_id is not null
        group by developer_id
        order by spend_cents desc
        limit 10
      ) t
      left join public.developers d on d.id = t.developer_id
    ),

    'last_14_days', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date                          as day,
               count(*) filter (where event_type = 'impression')            as impressions,
               count(*) filter (where event_type = 'click')                 as clicks,
               coalesce(round(sum(coalesce(cost, 0)) * 100)::int, 0)        as spend_cents
        from public.events
        where campaign_id = p_campaign_id::text
          and created_at >= current_date - interval '14 days'
        group by 1
      ) t
    )
  );
end;
$$;

grant execute on function public.get_pilot_spend_summary(uuid, uuid) to service_role;

-- Verify with:
--   select public.get_pilot_spend_summary(
--     '<your-campaign-uuid>'::uuid,
--     (select advertiser_id from campaigns where id = '<your-campaign-uuid>'::uuid)
--   );
