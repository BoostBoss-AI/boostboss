/**
 * Boost Boss — Pricing Plans CRUD (advertiser-side)
 *
 * Powers the per-product "Pricing plans" sub-page in the advertiser
 * dashboard. One product → many plans. Each plan independently
 * audit-gated (see [[pricing-plans-audit-policy]]).
 *
 * Endpoints (all require advertiser auth + ownership of product_id):
 *
 *   GET   /api/pricing-plans?action=list&product_id=X
 *     Returns every plan for this product, ordered by sort_order. Includes
 *     all fields — the seller owns the product, no field hiding needed.
 *
 *   POST  /api/pricing-plans?action=create  Body: { product_id, ...plan }
 *     Creates a new plan in 'pending' audit status. Required fields:
 *     plan_name, price. Optional: original_price, original_price_proof_url,
 *     original_price_proof_notes, currency, billing_period, features[],
 *     description, is_recommended, sort_order.
 *
 *   PATCH /api/pricing-plans?action=update  Body: { plan_id, ...fields }
 *     Updates fields on a plan. Any update to price-related fields
 *     (price, original_price, original_price_proof_url) resets the audit
 *     status to 'pending' — sellers can't sneak a price change past a
 *     prior approval.
 *
 *   POST  /api/pricing-plans?action=delete  Body: { plan_id }
 *     Hard-deletes a plan. Refuses if any storefront_transactions reference
 *     it (the FK has ON DELETE SET NULL but we'd rather preserve the
 *     historical link); in that case sets is_active=false instead.
 *
 *   POST  /api/pricing-plans?action=submit_for_audit  Body: { plan_id }
 *     Explicit "I've attached proof, please review" action. Flips status
 *     from any non-approved state → 'pending' and clears prior reviewer
 *     notes. Refuses if proof_url is missing.
 *
 * Auth model
 * ──────────
 * All endpoints derive the product owner from products.advertiser_id and
 * compare against the JWT user. Mismatched IDs return 403.
 *
 * Audit status semantics
 * ──────────────────────
 * The seller cannot set audit_status — only admins (via a future
 * /api/audits endpoint, Pass 4) can flip it to 'approved' or 'rejected'.
 * Seller can submit_for_audit to set it to 'pending' from any non-pending
 * state (e.g. coming back from 'changes_requested' or 'rejected').
 */

"use strict";

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";

let _sbAdmin = null;
function sbAdmin() {
  if (_sbAdmin) return _sbAdmin;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  _sbAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _sbAdmin;
}

let _sbAnon = null;
function sbAnon() {
  if (_sbAnon) return _sbAnon;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
  if (!SUPABASE_URL || !anonKey) return null;
  _sbAnon = createClient(SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  return _sbAnon;
}

async function getAuthUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = sbAnon();
  if (!anon) return null;
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

async function requireProductOwner(req, productId) {
  if (!productId || !/^[0-9a-f-]{36}$/i.test(productId)) {
    return { error: "Invalid product_id", status: 400 };
  }
  const user = await getAuthUser(req);
  if (!user) return { error: "unauthorized", status: 401 };
  const client = sbAdmin();
  if (!client) return { error: "Supabase not configured", status: 500 };
  const { data: product, error } = await client
    .from("products")
    .select("id, advertiser_id, name, status")
    .eq("id", productId)
    .maybeSingle();
  if (error)    return { error: error.message, status: 500 };
  if (!product) return { error: "Product not found", status: 404 };
  if (product.advertiser_id && product.advertiser_id !== user.id) {
    return { error: "Forbidden", status: 403 };
  }
  return { client, user, product };
}

// ─────────────────────────────────────────────────────────────────────
// Validation helpers
// ─────────────────────────────────────────────────────────────────────

const VALID_BILLING_PERIODS = new Set(["one_time", "monthly", "annual", "lifetime"]);

// Coerce a raw body shape into a clean DB row. Returns either {row} ready
// for insert/update, or {error} with a 400-ish message.
//
// When `partial: true`, fields not present in the body are skipped — used
// by PATCH so undefined fields don't get nulled.
function normalizePlan(body, { partial = false } = {}) {
  const out = {};
  const errs = [];

  const trim = (v) => (typeof v === "string" ? v.trim() : v);
  const strOrNull = (v) => {
    const s = trim(v);
    return s === "" || s == null ? null : String(s);
  };

  // ── Required fields on create
  if (!partial || body.plan_name !== undefined) {
    const name = strOrNull(body.plan_name);
    if (!name) errs.push("plan_name is required");
    out.plan_name = name;
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) errs.push("price must be a non-negative number");
    out.price = Math.round(price * 100) / 100;
  }

  // ── Optional / nullable fields
  if (body.description !== undefined)               out.description = strOrNull(body.description);
  if (body.currency !== undefined)                  out.currency = (strOrNull(body.currency) || "USD").toUpperCase();
  if (body.billing_period !== undefined) {
    const bp = strOrNull(body.billing_period) || "one_time";
    if (!VALID_BILLING_PERIODS.has(bp)) {
      errs.push("billing_period must be one of: " + Array.from(VALID_BILLING_PERIODS).join(", "));
    }
    out.billing_period = bp;
  }

  // ── Audit gate inputs
  if (body.original_price !== undefined) {
    if (body.original_price === null || body.original_price === "") {
      out.original_price = null;
    } else {
      const op = Number(body.original_price);
      if (!Number.isFinite(op) || op < 0) errs.push("original_price must be a non-negative number");
      out.original_price = Math.round(op * 100) / 100;
    }
  }
  if (body.original_price_proof_url !== undefined) {
    const url = strOrNull(body.original_price_proof_url);
    if (url && !/^https?:\/\//i.test(url)) errs.push("original_price_proof_url must start with http:// or https://");
    out.original_price_proof_url = url;
  }
  if (body.original_price_proof_notes !== undefined) out.original_price_proof_notes = strOrNull(body.original_price_proof_notes);

  // ── Marketing
  if (body.features !== undefined) {
    if (!Array.isArray(body.features)) {
      errs.push("features must be an array of strings");
    } else {
      // Allow either array of strings or array of {label, included} objects.
      // Normalize to {label, included:true} so the buyer-page renderer
      // can do checkmark vs X.
      out.features = body.features
        .map((f) => {
          if (typeof f === "string") return { label: f.trim(), included: true };
          if (f && typeof f === "object" && typeof f.label === "string") {
            return { label: f.label.trim(), included: f.included !== false };
          }
          return null;
        })
        .filter((f) => f && f.label);
    }
  }
  if (body.is_recommended !== undefined) out.is_recommended = !!body.is_recommended;
  if (body.is_active !== undefined)      out.is_active      = !!body.is_active;
  if (body.sort_order !== undefined) {
    const so = Number(body.sort_order);
    out.sort_order = Number.isFinite(so) ? Math.round(so) : 0;
  }

  // Sanity: BB price should be LESS than original_price if both provided.
  // (Otherwise it's not a discount — buyers won't believe it.)
  if (out.price != null && out.original_price != null && out.original_price > 0 && out.price >= out.original_price) {
    errs.push("BB price must be less than original_price (the discount has to be real)");
  }

  if (errs.length) return { error: errs.join("; ") };
  return { row: out };
}

// Detect if an update touches price-related fields. If so, the plan
// needs re-audit — we reset audit_status to 'pending'.
function changesPriceFields(updates) {
  return (
    Object.prototype.hasOwnProperty.call(updates, "price") ||
    Object.prototype.hasOwnProperty.call(updates, "original_price") ||
    Object.prototype.hasOwnProperty.call(updates, "original_price_proof_url") ||
    Object.prototype.hasOwnProperty.call(updates, "currency") ||
    Object.prototype.hasOwnProperty.call(updates, "billing_period")
  );
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/pricing-plans?action=list&product_id=X
// ──────────────────────────────────────────────────────────────────────
async function handleList(req, res) {
  const productId = req.query.product_id;
  const auth = await requireProductOwner(req, productId);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { client, product } = auth;

  const { data: plans, error } = await client
    .from("pricing_plans")
    .select("*")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  return res.json({
    product: { id: product.id, name: product.name, status: product.status },
    plans: plans || [],
  });
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/pricing-plans?action=create  Body: { product_id, ...plan }
// ──────────────────────────────────────────────────────────────────────
async function handleCreate(req, res) {
  const body = req.body || {};
  const productId = body.product_id;
  const auth = await requireProductOwner(req, productId);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { client, product } = auth;

  const n = normalizePlan(body, { partial: false });
  if (n.error) return res.status(400).json({ error: n.error });

  // Default sort_order: append to the end of the list
  if (n.row.sort_order == null) {
    const { count } = await client
      .from("pricing_plans")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    n.row.sort_order = count || 0;
  }

  // Plans always start in 'pending'. Only admins can approve.
  const insertRow = Object.assign({}, n.row, {
    product_id: product.id,
    audit_status: "pending",
  });

  const { data: plan, error } = await client
    .from("pricing_plans")
    .insert(insertRow)
    .select()
    .maybeSingle();
  if (error) return res.status(500).json({ error: error.message });

  return res.json({ success: true, plan });
}

// ──────────────────────────────────────────────────────────────────────
// PATCH /api/pricing-plans?action=update  Body: { plan_id, ...fields }
// ──────────────────────────────────────────────────────────────────────
//
// Resets audit_status to 'pending' if any price-related field changes —
// admin must re-approve so sellers can't bait-and-switch the price.
async function handleUpdate(req, res) {
  const body = req.body || {};
  const planId = body.plan_id;
  if (!planId || !/^[0-9a-f-]{36}$/i.test(planId)) {
    return res.status(400).json({ error: "plan_id is required" });
  }
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const client = sbAdmin();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  // Load plan → product → ownership check
  const { data: plan, error: pErr } = await client
    .from("pricing_plans")
    .select("id, product_id, audit_status")
    .eq("id", planId)
    .maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const { data: product, error: prodErr } = await client
    .from("products")
    .select("id, advertiser_id")
    .eq("id", plan.product_id)
    .maybeSingle();
  if (prodErr) return res.status(500).json({ error: prodErr.message });
  if (!product || product.advertiser_id !== user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const n = normalizePlan(body, { partial: true });
  if (n.error) return res.status(400).json({ error: n.error });
  if (!Object.keys(n.row).length) return res.status(400).json({ error: "No updatable fields supplied" });

  // Price-related change → re-audit
  if (changesPriceFields(n.row) && plan.audit_status === "approved") {
    n.row.audit_status = "pending";
    n.row.audit_reviewer_id = null;
    n.row.audit_reviewed_at = null;
    n.row.audit_review_notes = null;
  }

  const { data: updated, error: upErr } = await client
    .from("pricing_plans")
    .update(n.row)
    .eq("id", planId)
    .select()
    .maybeSingle();
  if (upErr) return res.status(500).json({ error: upErr.message });

  return res.json({ success: true, plan: updated });
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/pricing-plans?action=delete  Body: { plan_id }
// ──────────────────────────────────────────────────────────────────────
//
// Hard delete if no transactions reference the plan. If transactions
// exist, soft-delete (is_active=false) to preserve historical data.
async function handleDelete(req, res) {
  const body = req.body || {};
  const planId = body.plan_id;
  if (!planId || !/^[0-9a-f-]{36}$/i.test(planId)) {
    return res.status(400).json({ error: "plan_id is required" });
  }
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const client = sbAdmin();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const { data: plan, error: pErr } = await client
    .from("pricing_plans")
    .select("id, product_id")
    .eq("id", planId)
    .maybeSingle();
  if (pErr) return res.status(500).json({ error: pErr.message });
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const { data: product } = await client
    .from("products")
    .select("id, advertiser_id")
    .eq("id", plan.product_id)
    .maybeSingle();
  if (!product || product.advertiser_id !== user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Any transactions reference this plan?
  const { count } = await client
    .from("storefront_transactions")
    .select("id", { count: "exact", head: true })
    .eq("pricing_plan_id", planId);

  if (count && count > 0) {
    // Soft delete — preserve historical link
    const { error: upErr } = await client
      .from("pricing_plans")
      .update({ is_active: false })
      .eq("id", planId);
    if (upErr) return res.status(500).json({ error: upErr.message });
    return res.json({ success: true, soft_deleted: true, reason: "Plan has historical transactions; deactivated instead of deleted." });
  }

  // No transactions — hard delete
  const { error: delErr } = await client
    .from("pricing_plans")
    .delete()
    .eq("id", planId);
  if (delErr) return res.status(500).json({ error: delErr.message });

  return res.json({ success: true, deleted: true });
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/pricing-plans?action=submit_for_audit  Body: { plan_id }
// ──────────────────────────────────────────────────────────────────────
//
// Explicit "please review this plan now" action. Refuses if proof URL is
// missing — the seller has to give the admin something to verify.
async function handleSubmitForAudit(req, res) {
  const body = req.body || {};
  const planId = body.plan_id;
  if (!planId || !/^[0-9a-f-]{36}$/i.test(planId)) {
    return res.status(400).json({ error: "plan_id is required" });
  }
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "unauthorized" });
  const client = sbAdmin();
  if (!client) return res.status(500).json({ error: "Supabase not configured" });

  const { data: plan } = await client
    .from("pricing_plans")
    .select("id, product_id, original_price_proof_url, original_price, audit_status")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return res.status(404).json({ error: "Plan not found" });

  const { data: product } = await client
    .from("products")
    .select("id, advertiser_id")
    .eq("id", plan.product_id)
    .maybeSingle();
  if (!product || product.advertiser_id !== user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (!plan.original_price_proof_url) {
    return res.status(400).json({
      error: "Attach original_price_proof_url before submitting for audit. The reviewer needs a link to the seller's own pricing page.",
      code:  "proof_required",
    });
  }
  if (plan.original_price == null) {
    return res.status(400).json({
      error: "Set original_price before submitting for audit. The audit verifies the discount against this number.",
      code:  "original_price_required",
    });
  }

  const { error: upErr } = await client
    .from("pricing_plans")
    .update({
      audit_status:        "pending",
      audit_reviewer_id:   null,
      audit_reviewed_at:   null,
      audit_review_notes:  null,
    })
    .eq("id", planId);
  if (upErr) return res.status(500).json({ error: upErr.message });

  return res.json({ success: true, audit_status: "pending" });
}

// ──────────────────────────────────────────────────────────────────────
//                              HANDLER
// ──────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = (req.query && req.query.action) || null;
  try {
    if (req.method === "GET"   && action === "list")              return await handleList(req, res);
    if (req.method === "POST"  && action === "create")            return await handleCreate(req, res);
    if (req.method === "PATCH" && action === "update")            return await handleUpdate(req, res);
    if (req.method === "POST"  && action === "delete")            return await handleDelete(req, res);
    if (req.method === "POST"  && action === "submit_for_audit")  return await handleSubmitForAudit(req, res);
    return res.status(400).json({ error: "Unknown action. Use list, create, update, delete, or submit_for_audit." });
  } catch (err) {
    console.error("[pricing-plans] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
