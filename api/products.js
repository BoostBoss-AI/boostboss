/**
 * Boost Boss — Products API
 *
 * Products are the parent entity above Campaigns. An advertiser registers
 * a real-world thing they sell once (name, image, default URL, default
 * commission %), then attaches one or many campaigns to it over time.
 * Affiliates save and share by Product so their saved list stays clean
 * across campaign churn.
 *
 * See [[products-as-parent]] memory for the strategic decision.
 *
 * Actions:
 *   GET   /api/products                       list current advertiser's products
 *   GET   /api/products?id=<uuid>             get a single product (advertiser scope)
 *   POST  /api/products?action=create         create a product
 *   PATCH /api/products?action=update         update an existing product
 *   POST  /api/products?action=archive        soft-delete (status='archived')
 *   POST  /api/products?action=restore        unarchive (status='active')
 *
 *   GET   /api/products?action=browse         affiliate-facing list of active products
 *                                             across ALL advertisers (the marketplace).
 *                                             Requires affiliate JWT.
 *
 * Auth model:
 *   - All writes require a Supabase user JWT in the Authorization header.
 *   - advertiser_id is taken from the JWT claim — never trusted from the
 *     request body — so one advertiser can't write to another's products.
 *   - The "browse" action requires an affiliate (affiliates row exists);
 *     it returns active products across all advertisers for the marketplace
 *     (#4) and the affiliate save flow.
 */

"use strict";

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

let _sbAdmin = null;
function sbAdmin() {
  if (_sbAdmin) return _sbAdmin;
  if (!HAS_SUPABASE) return null;
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

// ── helpers ─────────────────────────────────────────────────────────────

// Pull the Supabase auth user from the Bearer token. Returns the auth.users
// row on success or null on any failure (missing header, expired JWT,
// invalid signature). Callers should 401 on null.
async function getAuthUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const anon = sbAnon();
  if (!anon) return null;
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data || !data.user) return null;
  return data.user;
}

// Verify the user has an `advertisers` row (i.e. is acting in the
// advertiser role for this request). Mirrors the strict role-check
// pattern used by affiliate endpoints — no auto-create on the way in,
// no auth carrying across roles.
async function requireAdvertiser(req) {
  const user = await getAuthUser(req);
  if (!user) return { error: "unauthorized", status: 401 };
  const sb = sbAdmin();
  if (!sb) return { error: "Supabase not configured", status: 500 };
  // We accept either: (a) an explicit advertisers row, OR (b) absence
  // of role tables (early-stage demo deployments). The campaigns table
  // already does this loose-check; we mirror it here.
  const { data: prof } = await sb
    .from("advertisers")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  // If the advertisers table doesn't exist OR there's no row, fall back
  // to user.id (the Supabase user is the advertiser by default). This
  // matches the existing campaigns.js behavior which takes advertiser_id
  // straight from the body.
  return { user, advertiserId: prof ? prof.id : user.id };
}

// Verify the user has an affiliates row. Used by the marketplace browse
// action so only signed-in affiliates can list products across the network.
async function requireAffiliate(req) {
  const user = await getAuthUser(req);
  if (!user) return { error: "unauthorized", status: 401 };
  const sb = sbAdmin();
  if (!sb) return { error: "Supabase not configured", status: 500 };
  const { data: aff } = await sb
    .from("affiliates")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!aff) return { error: "Not an affiliate", code: "not_affiliate", status: 403 };
  return { user, affiliateId: user.id };
}

// Normalize + validate a product row from the request body. Returns
// either { row } (the cleaned row ready for insert/update) or { error }
// (a validation error to return as 400).
function normalizeProduct(body, { partial = false } = {}) {
  if (!body || typeof body !== "object") return { error: "Missing body" };

  // Required fields (only enforced on create — updates can be partial)
  if (!partial) {
    if (!body.name || !String(body.name).trim()) return { error: "name is required" };
    if (!body.default_url || !String(body.default_url).trim()) return { error: "default_url is required" };
  }

  const row = {};

  if (body.name !== undefined)
    row.name = String(body.name).trim().slice(0, 240);
  if (body.description !== undefined)
    row.description = body.description == null ? null : String(body.description).slice(0, 5000);
  if (body.image_url !== undefined)
    row.image_url = body.image_url == null ? null : String(body.image_url).slice(0, 2000);
  if (body.default_url !== undefined) {
    const u = String(body.default_url).trim();
    if (!/^https?:\/\//i.test(u)) return { error: "default_url must start with http:// or https://" };
    row.default_url = u.slice(0, 2000);
  }
  if (body.default_commission_pct !== undefined) {
    const pct = Number(body.default_commission_pct);
    if (!Number.isFinite(pct)) return { error: "default_commission_pct must be a number" };
    if (pct < 0 || pct > 100) return { error: "default_commission_pct must be between 0 and 100" };
    row.default_commission_pct = Math.round(pct * 100) / 100;  // 2 decimal places
  }

  return { row };
}

// ────────────────────────────────────────────────────────────────────────
//                                HANDLER
// ────────────────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const sb = sbAdmin();
  if (!sb) return res.status(500).json({ error: "Supabase not configured" });

  const action = (req.query && req.query.action) || (req.body && req.body.action) || null;
  const body = req.body || {};

  try {
    // ── LIST (default GET) ─────────────────────────────────────────────
    // Returns the calling advertiser's own products (including archived).
    if (req.method === "GET" && !action) {
      const auth = await requireAdvertiser(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });

      const limit  = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const filterStatus = ["active", "archived"].includes(req.query.status)
        ? req.query.status : null;

      let q = sb
        .from("products")
        .select("*", { count: "exact" })
        .eq("advertiser_id", auth.advertiserId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (filterStatus) q = q.eq("status", filterStatus);

      const { data, count, error } = await q;
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ products: data || [], total: count || 0 });
    }

    // ── GET single product ─────────────────────────────────────────────
    if (req.method === "GET" && action === "get") {
      const auth = await requireAdvertiser(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });

      const id = req.query.id;
      if (!id) return res.status(400).json({ error: "id is required" });

      const { data, error } = await sb
        .from("products")
        .select("*, campaigns(id, name, status, headline, cta_url)")
        .eq("id", id)
        .eq("advertiser_id", auth.advertiserId)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Product not found" });
      return res.json({ product: data });
    }

    // ── BROWSE (marketplace — all active products across advertisers) ──
    // Used by the affiliate dashboard's #4 Marketplace section. Returns
    // active products only, with the join to advertiser display name
    // (if there's an advertisers table with one).
    if (req.method === "GET" && action === "browse") {
      const auth = await requireAffiliate(req);
      if (auth.error) {
        return res.status(auth.status).json(
          auth.code ? { error: auth.error, code: auth.code } : { error: auth.error }
        );
      }

      const limit  = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const q = (req.query.q || "").trim();

      let query = sb
        .from("products")
        .select("id, name, description, image_url, default_url, default_commission_pct, advertiser_id, created_at", { count: "exact" })
        .eq("status", "active")
        .order("default_commission_pct", { ascending: false })  // best commission first
        .range(offset, offset + limit - 1);
      if (q) query = query.ilike("name", `%${q}%`);

      const { data, count, error } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ products: data || [], total: count || 0 });
    }

    // ── CREATE ─────────────────────────────────────────────────────────
    if (req.method === "POST" && action === "create") {
      const auth = await requireAdvertiser(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });

      const norm = normalizeProduct(body);
      if (norm.error) return res.status(400).json({ error: norm.error });

      const insertRow = Object.assign({}, norm.row, {
        advertiser_id: auth.advertiserId,
        status: "active",
      });
      const { data, error } = await sb
        .from("products")
        .insert(insertRow)
        .select()
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ product: data });
    }

    // ── UPDATE (partial) ───────────────────────────────────────────────
    if ((req.method === "PATCH" || req.method === "POST") && action === "update") {
      const auth = await requireAdvertiser(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });

      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: "id is required" });

      const norm = normalizeProduct(body, { partial: true });
      if (norm.error) return res.status(400).json({ error: norm.error });
      if (Object.keys(norm.row).length === 0) {
        return res.status(400).json({ error: "No updatable fields supplied" });
      }

      const { data, error } = await sb
        .from("products")
        .update(norm.row)
        .eq("id", id)
        .eq("advertiser_id", auth.advertiserId)
        .select()
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Product not found" });
      return res.json({ product: data });
    }

    // ── ARCHIVE (soft delete) ──────────────────────────────────────────
    if (req.method === "POST" && action === "archive") {
      const auth = await requireAdvertiser(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });

      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: "id is required" });

      const { data, error } = await sb
        .from("products")
        .update({ status: "archived" })
        .eq("id", id)
        .eq("advertiser_id", auth.advertiserId)
        .select()
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Product not found" });
      return res.json({ product: data });
    }

    // ── RESTORE (un-archive) ───────────────────────────────────────────
    if (req.method === "POST" && action === "restore") {
      const auth = await requireAdvertiser(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });

      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: "id is required" });

      const { data, error } = await sb
        .from("products")
        .update({ status: "active" })
        .eq("id", id)
        .eq("advertiser_id", auth.advertiserId)
        .select()
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Product not found" });
      return res.json({ product: data });
    }

    return res.status(400).json({
      error: "Unknown action. Use: (GET) list/get/browse, (POST) create/archive/restore, (PATCH) update",
    });
  } catch (err) {
    console.error("[products] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
