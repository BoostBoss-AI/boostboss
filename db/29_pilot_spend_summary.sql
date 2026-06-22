-- =====================================================================
-- 29_pilot_spend_summary.sql — aggregation RPC for the Pilot Console
-- =====================================================================
--
-- Called from api/pilot-spend.js. Returns one JSON object with all the
-- breakdowns the Pilot Console's "Spend allocation" panel renders:
--   totals       : impressions, clicks, spend, impressions_today, ctr
--   by_door      : grouped by integration_method
--   by_placement : grouped by placement_id + surface
--   by_publisher : grouped by developer_id (joined to developers.app_name)
--
-- All events for a Pilot product boost share campaign_id='pboost_<uuid>'
-- (synthesized in mcp.js productBoostToVirtualCampaign). We filter by
-- that single key, then group locally.
--
-- Ownership: the calling advertiser must own the product. The RPC checks
-- this directly so the API endpoint stays a thin wrapper.
--
-- Idempotent — uses CREATE OR REPLACE. Safe to re-run.
-- =====================================================================

create or replace function public.get_pilot_spend_summary(
  p_product_id    uuid,
  p_advertiser_id uuid
) returns jsonb
language plpgsql
stable
security definer
as $$
declare
  v_campaign_id text := 'pboost_' || p_product_id::text;
  v_owner_check int;
  v_total_record record;
begin
  -- Ownership check — refuse if the product doesn't belong to caller.
  select count(*) into v_owner_check
  from public.products
  where id = p_product_id
    and advertiser_id = p_advertiser_id;

  if v_owner_check = 0 then
    return jsonb_build_object('error', 'product_not_found_or_not_owned');
  end if;

  -- Build the response in one return — avoids walking events three times.
  return jsonb_build_object(
    'product_id',  p_product_id,
    'campaign_id', v_campaign_id,

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
      where campaign_id = v_campaign_id
    ),

    'by_door', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.spend_cents desc), '[]'::jsonb)
      from (
        select integration_method                                                                as door,
               count(*) filter (where event_type = 'impression')                                 as impressions,
               count(*) filter (where event_type = 'click')                                      as clicks,
               coalesce(round(sum(coalesce(cost, 0)) * 100)::int, 0)                             as spend_cents
        from public.events
        where campaign_id = v_campaign_id
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
        where campaign_id = v_campaign_id
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
        where campaign_id = v_campaign_id
          and developer_id is not null
        group by developer_id
        order by spend_cents desc
        limit 10
      ) t
      left join public.developers d on d.id = t.developer_id
    ),

    -- Last 14 days of impressions, daily — fuels a future sparkline.
    'last_14_days', (
      select coalesce(jsonb_agg(row_to_json(t) order by t.day), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date                          as day,
               count(*) filter (where event_type = 'impression')            as impressions,
               count(*) filter (where event_type = 'click')                 as clicks,
               coalesce(round(sum(coalesce(cost, 0)) * 100)::int, 0)        as spend_cents
        from public.events
        where campaign_id = v_campaign_id
          and created_at >= current_date - interval '14 days'
        group by 1
      ) t
    )
  );
end;
$$;

-- Grant execute to the service role (used by api/pilot-spend.js).
grant execute on function public.get_pilot_spend_summary(uuid, uuid) to service_role;

-- Verify with:
--   select public.get_pilot_spend_summary(
--     'a3ea0ecc-35c5-486b-a201-388c1c2721f9'::uuid,  -- StripeFlow product id
--     (select advertiser_id from products where id = 'a3ea0ecc-35c5-486b-a201-388c1c2721f9'::uuid)
--   );
