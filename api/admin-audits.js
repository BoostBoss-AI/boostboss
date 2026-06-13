/**
 * Boost Boss — Admin pricing-plan audit queue
 *
 * Admin-facing surface for reviewing seller pricing plans before they go
 * live to affiliates. Implements the legitimacy moat described in
 * [[pricing-plans-audit-policy]]: every plan needs a proof URL pointing
 * to the seller's own pricing page; admin verifies the discount is real.
 *
 * Endpoints (all require ADMIN_TOKEN bearer):
 *
 *   GET   /api/admin-audits?action=list
 *     Returns pricing plans awaiting review (audit_status IN
 *     ('pending', 'changes_requested')), joined with product name +
 *     seller display info. Default ordered by created_at ASC (FIFO).
 *
 *   GET   /api/admin-audits?action=summary
 *     Tiny aggregate for the sidebar badge count: how many plans are
 *     waiting + how many of each status.
 *
 *   POST  /api/admin-audits?action=approve   Body: { plan_id, notes? }
 *     Flip audit_status → 'approved'. Plan becomes immediately purchasable.
 *
 *   POST  /api/admin-audits?action=reject    Body: { plan_id, notes (required) }
 *     Flip audit_status → 'rejected'. notes is required and shown to the
 *     seller on their pricing-plans page.
 *
 *   POST  /api/admin-audits?action=request_changes  Body: { plan_id, notes (required) }
 *     Flip audit_status → 'changes_requested'. Same as reject but the
 *     seller's UI shows it as "fix and re-submit" rather than terminal.
 *
 * Auth model
 * ──────────
 * Same single-key pattern as api/campaigns.js requireAdmin — the admin
 * console at /admin stores ADMIN_TOKEN in localStorage.bb_admin_token and
 * sends it as Authorization: Bearer ... on every call.
 */

"use strict";

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _sb;
}

// ── Admin auth — matches the requireAdmin pattern in campaigns.js ─────
function requireAdmin(req) {
  const authHeader = (req.headers && req.headers.authorization) || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const staticKeys = [process.env.BBX_ADMIN_KEY, process.env.ADMIN_TOKEN].filter(Boolean);
  if (staticKeys.length && staticKeys.includes(token)) {
    return { role: "admin", source: "static_key" };
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────
// GET ?action=list&status=pending  (also accepts: changes_requested, all)
// ──────────────────────────────────────────────────────────────────────
async function handleList(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const filter = (req.query && req.query.status) || "queue";

  let query = client
    .from("pricing_plans")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(200);

  if (filter === "queue") {
    query = query.in("audit_status", ["pending", "changes_requested"]);
  } else if (filter === "all") {
    // no filter — recent history of all decisions
    query = client
      .from("pricing_plans")
      .select("*")
      .order("audit_reviewed_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);
  } else if (["pending", "approved", "rejected", "changes_requested"].includes(filter)) {
    query = query.eq("audit_status", filter);
  }

  const { data: plans, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  const rows = plans || [];

  // Fan-out: fetch product + advertiser display info in batches
  const productIds = Array.from(new Set(rows.map((r) => r.product_id).filter(Boolean)));
  let productsById = {};
  if (productIds.length) {
    const { data: prods } = await client
      .from("products")
      .select("id, name, image_url, advertiser_id, status, default_url, external_marketing_url, affiliate_pool_pct")
      .in("id", productIds);
    (prods || []).forEach((p) => { productsById[p.id] = p; });
  }

  const advertiserIds = Array.from(new Set(
    Object.values(productsById).map((p) => p.advertiser_id).filter(Boolean)
  ));
  let advertisersById = {};
  if (advertiserIds.length) {
    const { data: advs } = await client
      .from("advertisers")
      .select("id, email, company_name, display_name")
      .in("id", advertiserIds);
    (advs || []).forEach((a) => { advertisersById[a.id] = a; });
  }

  const items = rows.map((r) => {
    const product = productsById[r.product_id] || null;
    const advertiser = product && product.advertiser_id ? advertisersById[product.advertiser_id] || null : null;
    const discountPct = (r.original_price && r.price && Number(r.original_price) > 0 && Number(r.price) < Number(r.original_price))
      ? Math.round((1 - Number(r.price) / Number(r.original_price)) * 100)
      : null;
    return {
      id:                          r.id,
      product_id:                  r.product_id,
      plan_name:                   r.plan_name,
      description:                 r.description,
      price:                       r.price,
      original_price:              r.original_price,
      currency:                    r.currency,
      billing_period:              r.billing_period,
      discount_pct:                discountPct,
      original_price_proof_url:    r.original_price_proof_url,
      original_price_proof_notes:  r.original_price_proof_notes,
      audit_status:                r.audit_status,
      audit_review_notes:          r.audit_review_notes,
      audit_reviewed_at:           r.audit_reviewed_at,
      audit_reviewer_id:           r.audit_reviewer_id,
      features:                    Array.isArray(r.features) ? r.features : [],
      is_active:                   r.is_active,
      is_recommended:              r.is_recommended,
      created_at:                  r.created_at,
      product: product ? {
        id:                       product.id,
        name:                     product.name,
        image_url:                product.image_url,
        status:                   product.status,
        default_url:              product.default_url,
        external_marketing_url:   product.external_marketing_url,
        affiliate_pool_pct:       product.affiliate_pool_pct,
      } : null,
      advertiser: advertiser ? {
        id:           advertiser.id,
        email:        advertiser.email,
        company_name: advertiser.company_name,
        display_name: advertiser.display_name,
      } : null,
    };
  });

  return res.json({ audits: items, count: items.length, filter });
}

// ──────────────────────────────────────────────────────────────────────
// GET ?action=summary
// ──────────────────────────────────────────────────────────────────────
async function handleSummary(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const { data: rows, error } = await client
    .from("pricing_plans")
    .select("audit_status");
  if (error) return res.status(500).json({ error: error.message });

  const counts = { pending: 0, approved: 0, rejected: 0, changes_requested: 0, queue: 0, total: 0 };
  (rows || []).forEach((r) => {
    counts.total += 1;
    if (counts.hasOwnProperty(r.audit_status)) counts[r.audit_status] += 1;
    if (r.audit_status === "pending" || r.audit_status === "changes_requested") counts.queue += 1;
  });

  return res.json({ counts });
}

// ──────────────────────────────────────────────────────────────────────
// Shared decision helper — used by approve/reject/request_changes
// ──────────────────────────────────────────────────────────────────────
async function applyDecision(req, res, newStatus, { requireNotes }) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const body = req.body || {};
  const planId = body.plan_id;
  const notes  = (body.notes || "").toString().trim();

  if (!planId || !/^[0-9a-f-]{36}$/i.test(planId)) {
    return res.status(400).json({ error: "plan_id is required" });
  }
  if (requireNotes && !notes) {
    return res.status(400).json({ error: "notes is required when rejecting or requesting changes" });
  }

  const { data: plan } = await client
    .from("pricing_plans")
    .select("id, audit_status, audit_reviewer_id")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const updates = {
    audit_status:        newStatus,
    audit_reviewed_at:   new Date().toISOString(),
    audit_review_notes:  notes || null,
  };
  // Reviewer id — we don't have a user id under the static-key flow,
  // so stamp a placeholder if env says so. Future: when admins have
  // individual accounts, derive from JWT.
  if (process.env.ADMIN_DEFAULT_REVIEWER_ID) {
    updates.audit_reviewer_id = process.env.ADMIN_DEFAULT_REVIEWER_ID;
  }

  const { data: updated, error: upErr } = await client
    .from("pricing_plans")
    .update(updates)
    .eq("id", planId)
    .select("id, audit_status, audit_reviewed_at, audit_review_notes")
    .maybeSingle();
  if (upErr) return res.status(500).json({ error: upErr.message });

  return res.json({ success: true, plan: updated, prior_status: plan.audit_status });
}

// ──────────────────────────────────────────────────────────────────────
//                              HANDLER
// ──────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  // Admin gate
  if (!requireAdmin(req)) {
    return res.status(401).json({ error: "Admin authentication required" });
  }

  const action = (req.query && req.query.action) || null;
  try {
    if (req.method === "GET") {
      if (action === "list")    return await handleList(req, res);
      if (action === "summary") return await handleSummary(req, res);
      return res.status(400).json({ error: "Unknown GET action. Use list or summary." });
    }
    if (req.method === "POST") {
      if (action === "approve")           return await applyDecision(req, res, "approved",          { requireNotes: false });
      if (action === "reject")            return await applyDecision(req, res, "rejected",          { requireNotes: true  });
      if (action === "request_changes")   return await applyDecision(req, res, "changes_requested", { requireNotes: true  });
      return res.status(400).json({ error: "Unknown POST action. Use approve, reject, or request_changes." });
    }
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[admin-audits] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
