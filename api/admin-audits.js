/**
 * Boost Boss — Admin product audit queue
 *
 * Reviews the WHOLE product page (marketing + every pricing tier + every
 * proof URL) in one decision. Audit happens at the product level — not
 * per-plan. See [[pricing-plans-audit-policy]] (revised model).
 *
 * Endpoints (all require ADMIN_TOKEN bearer):
 *
 *   GET   /api/admin-audits?action=list&status=queue
 *     Returns products awaiting review (audit_status IN ('pending',
 *     'changes_requested')) joined with EVERY pricing plan + seller info
 *     + all marketing content. One row = one product page = one decision.
 *
 *   GET   /api/admin-audits?action=summary
 *     Aggregate counts by audit_status for sidebar badge.
 *
 *   POST  /api/admin-audits?action=approve   Body: { product_id, notes? }
 *     Whole product becomes purchasable. All active plans go live.
 *
 *   POST  /api/admin-audits?action=reject    Body: { product_id, notes (required) }
 *     Product blocked. Seller sees reviewer notes.
 *
 *   POST  /api/admin-audits?action=request_changes  Body: { product_id, notes (required) }
 *     Soft reject — seller's UI shows "fix and re-submit."
 *
 * Auth model
 * ──────────
 * Same single-key static-bearer pattern as api/campaigns and api/payouts
 * (ADMIN_TOKEN / BBX_ADMIN_KEY env var).
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
// GET ?action=list&status=queue
// ──────────────────────────────────────────────────────────────────────
async function handleList(req, res) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const filter = (req.query && req.query.status) || "queue";

  // 1. Pull the product rows for the requested filter.
  let prodQuery = client
    .from("products")
    .select("*")
    .order("audit_reviewed_at", { ascending: false, nullsFirst: true })
    .order("created_at", { ascending: true })
    .limit(200);

  if (filter === "queue") {
    prodQuery = prodQuery.in("audit_status", ["pending", "changes_requested"]);
  } else if (["pending", "approved", "rejected", "changes_requested", "draft"].includes(filter)) {
    prodQuery = prodQuery.eq("audit_status", filter);
  } else {
    // 'all' — exclude drafts because they are not yet submitted for review
    // (Task #156). Admin can still see them by passing ?status=draft.
    prodQuery = prodQuery.neq("audit_status", "draft");
  }

  const { data: products, error } = await prodQuery;
  if (error) return res.status(500).json({ error: error.message });
  const productList = products || [];

  // 2. Fan out for related data
  const productIds   = productList.map((p) => p.id);
  const advertiserIds = Array.from(new Set(productList.map((p) => p.advertiser_id).filter(Boolean)));

  const [{ data: plans }, { data: advs }] = await Promise.all([
    productIds.length
      ? client.from("pricing_plans")
          .select("id, product_id, plan_name, description, price, original_price, currency, billing_period, features, original_price_proof_url, original_price_proof_notes, is_active, is_recommended, sort_order")
          .in("product_id", productIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    advertiserIds.length
      ? client.from("advertisers")
          .select("id, email, company_name, display_name")
          .in("id", advertiserIds)
      : Promise.resolve({ data: [] }),
  ]);
  const plansByProduct = {};
  (plans || []).forEach((pl) => {
    if (!plansByProduct[pl.product_id]) plansByProduct[pl.product_id] = [];
    plansByProduct[pl.product_id].push(pl);
  });
  const advById = {};
  (advs || []).forEach((a) => { advById[a.id] = a; });

  // 3. Shape the response — everything an admin needs to render the
  //    review card in one screen, with no extra requests.
  const items = productList.map((p) => {
    const productPlans = plansByProduct[p.id] || [];
    const advertiser   = p.advertiser_id ? advById[p.advertiser_id] || null : null;

    return {
      id:                   p.id,
      name:                 p.name,
      description:          p.description,
      image_url:            p.image_url,
      default_url:          p.default_url,
      external_marketing_url: p.external_marketing_url,
      status:               p.status,
      currency:             p.currency,
      affiliate_pool_pct:   p.affiliate_pool_pct,

      // Marketing content (the buyer-facing page)
      tldr_bullets:         Array.isArray(p.tldr_bullets) ? p.tldr_bullets : [],
      alternative_to:       Array.isArray(p.alternative_to) ? p.alternative_to : [],
      integrations:         Array.isArray(p.integrations) ? p.integrations : [],
      best_for:             Array.isArray(p.best_for) ? p.best_for : [],
      deal_terms:           Array.isArray(p.deal_terms) ? p.deal_terms : [],
      long_description:     p.long_description,
      refund_window_days:   p.refund_window_days,
      guarantee_label:      p.guarantee_label,

      // Company/founder card
      company_logo_url:     p.company_logo_url,
      company_website_url:  p.company_website_url,
      company_tagline:      p.company_tagline,
      company_about:        p.company_about,
      company_founded_date: p.company_founded_date,
      company_city:         p.company_city,
      company_country_code: p.company_country_code,
      company_size:         p.company_size,
      company_growth_stage: p.company_growth_stage,
      company_funding_status: p.company_funding_status,
      founder_name:         p.founder_name,
      founder_role:         p.founder_role,
      founder_photo_url:    p.founder_photo_url,
      founder_linkedin_url: p.founder_linkedin_url,

      // Audit
      audit_status:         p.audit_status,
      audit_review_notes:   p.audit_review_notes,
      audit_reviewed_at:    p.audit_reviewed_at,
      audit_reviewer_id:    p.audit_reviewer_id,
      created_at:           p.created_at,
      updated_at:           p.updated_at,

      // Pricing tiers — what the admin needs to verify
      plans: productPlans.map((pl) => {
        const discount = (pl.original_price && pl.price && Number(pl.original_price) > 0 && Number(pl.price) < Number(pl.original_price))
          ? Math.round((1 - Number(pl.price) / Number(pl.original_price)) * 100)
          : null;
        return {
          id:                          pl.id,
          plan_name:                   pl.plan_name,
          description:                 pl.description,
          price:                       pl.price,
          original_price:              pl.original_price,
          discount_pct:                discount,
          currency:                    pl.currency,
          billing_period:              pl.billing_period,
          features:                    Array.isArray(pl.features) ? pl.features : [],
          original_price_proof_url:    pl.original_price_proof_url,
          original_price_proof_notes:  pl.original_price_proof_notes,
          is_active:                   pl.is_active,
          is_recommended:              pl.is_recommended,
        };
      }),

      // Seller info
      advertiser: advertiser ? {
        id:           advertiser.id,
        email:        advertiser.email,
        company_name: advertiser.company_name,
        display_name: advertiser.display_name,
      } : null,
      live_page_url: `/p/${p.id}`,
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
    .from("products")
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
// Shared decision helper
// ──────────────────────────────────────────────────────────────────────
async function applyDecision(req, res, newStatus, { requireNotes }) {
  const client = sb();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const body = req.body || {};
  // Accept either product_id (new) or plan_id (legacy; resolve to its product)
  let productId = body.product_id;
  const planId  = body.plan_id;
  const notes   = (body.notes || "").toString().trim();

  if (!productId && planId) {
    if (!/^[0-9a-f-]{36}$/i.test(planId)) {
      return res.status(400).json({ error: "plan_id (legacy) must be a UUID" });
    }
    const { data: plan } = await client
      .from("pricing_plans").select("product_id").eq("id", planId).maybeSingle();
    if (plan) productId = plan.product_id;
  }
  if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) {
    return res.status(400).json({ error: "product_id is required" });
  }
  if (requireNotes && !notes) {
    return res.status(400).json({ error: "notes is required when rejecting or requesting changes" });
  }

  const { data: product } = await client
    .from("products").select("id, audit_status").eq("id", productId).maybeSingle();
  if (!product) return res.status(404).json({ error: "Product not found" });

  const updates = {
    audit_status:        newStatus,
    audit_reviewed_at:   new Date().toISOString(),
    audit_review_notes:  notes || null,
  };
  if (process.env.ADMIN_DEFAULT_REVIEWER_ID) {
    updates.audit_reviewer_id = process.env.ADMIN_DEFAULT_REVIEWER_ID;
  }

  const { data: updated, error: upErr } = await client
    .from("products")
    .update(updates)
    .eq("id", productId)
    .select("id, audit_status, audit_reviewed_at, audit_review_notes, name")
    .maybeSingle();
  if (upErr) return res.status(500).json({ error: upErr.message });

  // Cascade decision to pricing plans (Task #150, fixed 2026-06-18).
  //
  // Before this, pricing_plans had full audit columns but no mechanism
  // ever updated them — every plan stayed pending forever. The semantics:
  //   - approved: only plans WITH an original_price_proof_url get
  //     approved. Plans missing proof URLs stay pending so the
  //     pricing_plans_audit_policy invariant (every live plan has a
  //     proof URL) is protected even if a product is approved early.
  //   - rejected / changes_requested: cascade to ALL plans. A rejected
  //     product cannot have an approved plan hanging off it.
  const planUpdates = {
    audit_status:        newStatus,
    audit_reviewed_at:   new Date().toISOString(),
    audit_review_notes:  notes || null,
  };
  if (process.env.ADMIN_DEFAULT_REVIEWER_ID) {
    planUpdates.audit_reviewer_id = process.env.ADMIN_DEFAULT_REVIEWER_ID;
  }

  let planQuery = client.from("pricing_plans")
    .update(planUpdates)
    .eq("product_id", productId);
  if (newStatus === "approved") {
    planQuery = planQuery
      .not("original_price_proof_url", "is", null)
      .neq("original_price_proof_url", "");
  }
  const { data: updatedPlans, error: planErr } = await planQuery
    .select("id, plan_name, audit_status, original_price_proof_url");

  // Plan-cascade failure is non-fatal — the product still got the
  // requested status. Surface the count for the admin UI to display.
  if (planErr) {
    console.error("[admin-audits] plan cascade failed:", planErr.message);
  }

  return res.json({
    success:       true,
    product:       updated,
    prior_status:  product.audit_status,
    plans_updated: Array.isArray(updatedPlans) ? updatedPlans.length : 0,
    plans:         updatedPlans || [],
  });
}

// ──────────────────────────────────────────────────────────────────────
//                              HANDLER
// ──────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

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
