// =====================================================================
// /api/pilot-spend.js — Pilot Console spend allocation feed
// =====================================================================
//
// GET /api/pilot-spend?product_id=<uuid>
//
// Returns the breakdown the Pilot Console's right-column "Spend
// allocation" panel renders: totals + by_door + by_placement +
// by_publisher + last_14_days. See [[advertiser-pilot-model]].
//
// Auth: Bearer JWT (advertiser owner of the product). Ownership is
// enforced inside the RPC (get_pilot_spend_summary), not here, so the
// HTTP layer stays a thin wrapper. Per [[advertiser-pilot-model]] this
// is the trust-layer endpoint — the rendered breakdown is how the
// advertiser sees Benna's transparency.
//
// Lightweight. Should respond in <100ms on a warm DB even with 100k+
// events on a single product (single-key index hit on campaign_id).
// =====================================================================

const { createClient } = require("@supabase/supabase-js");

function sbAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function getAuthUser(req) {
  const sb = sbAdmin();
  if (!sb) return null;
  const auth = req.headers && req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (_) {
    return null;
  }
}

async function requireAdvertiser(req) {
  const user = await getAuthUser(req);
  if (!user) return { error: "unauthorized", status: 401 };
  const sb = sbAdmin();
  if (!sb) return { error: "Supabase not configured", status: 500 };
  const { data: prof } = await sb
    .from("advertisers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  return { user, advertiserId: prof ? prof.id : user.id };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sb = sbAdmin();
  if (!sb) return res.status(500).json({ error: "Supabase not configured" });

  const auth = await requireAdvertiser(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const productId = (req.query && req.query.product_id) || null;
  if (!productId) {
    return res.status(400).json({ error: "product_id is required" });
  }
  // Defensive UUID shape check — RPC will reject otherwise, but we'd
  // rather return a clean 400.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) {
    return res.status(400).json({ error: "product_id must be a valid UUID" });
  }

  try {
    const { data, error } = await sb.rpc("get_pilot_spend_summary", {
      p_product_id:    productId,
      p_advertiser_id: auth.advertiserId,
    });
    if (error) {
      console.warn("[pilot-spend] RPC error:", error.message);
      return res.status(500).json({ error: error.message });
    }
    // RPC returns its own ownership error when the advertiser doesn't
    // own the product — translate to 404 so the frontend can show a
    // "product not found" empty state.
    if (data && data.error === "product_not_found_or_not_owned") {
      return res.status(404).json({ error: "Product not found" });
    }
    return res.json(data || {});
  } catch (e) {
    console.error("[pilot-spend] handler error:", e);
    return res.status(500).json({ error: "Internal error" });
  }
};
