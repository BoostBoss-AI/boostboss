-- =====================================================================
-- 27_pilot_spend_rpc.sql — atomic boost-spend debit + auto-deplete
-- =====================================================================
--
-- Called from api/mcp.js after a Pilot product boost wins an auction.
-- Increments boost_spent_cents and, if the running total crosses the
-- lifetime budget cap, flips boost_status='depleted' atomically.
--
-- Daily-cap enforcement is NOT done here — that lives in the auction
-- candidate filter (next round). The auction reads recent spend events
-- from the events table to enforce the day cap; this RPC only handles
-- the cumulative lifetime cap because depletion is a state change.
--
-- See [[advertiser-pilot-model]] memory.
-- =====================================================================

create or replace function public.increment_boost_spend(
  p_product_id uuid,
  p_cents      int
) returns void
language plpgsql
security definer
as $$
declare
  v_cap   int;
  v_total int;
begin
  -- Atomic increment. RETURNING gives us the post-update totals so we
  -- can decide whether to deplete without a second query.
  update public.products
     set boost_spent_cents = boost_spent_cents + p_cents,
         updated_at        = now()
   where id = p_product_id
     and boost_status in ('active', 'paused')  -- never debit archived/depleted
  returning boost_lifetime_budget_cents, boost_spent_cents
        into v_cap, v_total;

  -- If a lifetime cap is set and the new total reaches/exceeds it,
  -- auto-deplete. The next auction round will exclude this product.
  if v_cap is not null and v_cap > 0 and v_total >= v_cap then
    update public.products
       set boost_status = 'depleted',
           updated_at   = now()
     where id = p_product_id
       and boost_status = 'active';
  end if;
end;
$$;

-- Grant execute to the service role so api/mcp.js can call it.
-- (Other roles do not call this; it's invoked server-to-server.)
grant execute on function public.increment_boost_spend(uuid, int) to service_role;

-- Verify with:
--   select proname, pronargs from pg_proc where proname = 'increment_boost_spend';
