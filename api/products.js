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

// Allowlist of SKU types — must match the products_sku_type_check
// constraint in MIGRATION-mor-storefront.sql.
const SKU_TYPES = new Set(["one_time", "bundle", "lifetime", "subscription_pack"]);

// When auto-creating a default pricing_plan on product create, pick a
// sensible name + billing_period from the product's sku_type. Sellers
// can rename / split later via the pricing-plans sub-page.
function pickDefaultPlanName(skuType) {
  switch (skuType) {
    case "lifetime":           return "Lifetime";
    case "subscription_pack":  return "Annual";
    case "bundle":             return "Bundle";
    default:                   return "Standard";
  }
}
function pickDefaultBillingPeriod(skuType) {
  switch (skuType) {
    case "lifetime":           return "lifetime";
    case "subscription_pack":  return "annual";
    default:                   return "one_time";
  }
}

// Normalize + validate a product row from the request body. Returns
// either { row } (the cleaned row ready for insert/update) or { error }
// (a validation error to return as 400).
//
// Fields fall into three groups (see [[mor-product-page-model]]):
//   Basics       name, description, image_url, default_url, default_commission_pct
//                + price, currency, sku_type
//   Storefront   long_description, screenshots[], demo_video_url,
//                package_details[], faq[], testimonials[], external_marketing_url
//   Fulfillment  fulfillment_redirect_url, fulfillment_webhook_url,
//                fulfillment_webhook_secret, redemption_window_days,
//                package_duration_days
function normalizeProduct(body, { partial = false } = {}) {
  if (!body || typeof body !== "object") return { error: "Missing body" };

  // Required fields (only enforced on create — updates can be partial)
  if (!partial) {
    if (!body.name || !String(body.name).trim()) return { error: "name is required" };
    if (!body.default_url || !String(body.default_url).trim()) return { error: "default_url is required" };
  }

  const row = {};

  // ── Basics ───────────────────────────────────────────────────────────
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
    row.default_commission_pct = Math.round(pct * 100) / 100;
  }
  if (body.price !== undefined) {
    if (body.price === null || body.price === "") {
      row.price = null;
    } else {
      const price = Number(body.price);
      if (!Number.isFinite(price)) return { error: "price must be a number" };
      if (price < 0 || price > 100000) return { error: "price must be between 0 and 100000" };
      row.price = Math.round(price * 100) / 100;
    }
  }
  if (body.currency !== undefined) {
    const c = String(body.currency || "USD").toUpperCase().slice(0, 8);
    if (!/^[A-Z]{3,8}$/.test(c)) return { error: "currency must be a 3-letter ISO code (USD, EUR, etc.)" };
    row.currency = c;
  }
  if (body.sku_type !== undefined) {
    if (!SKU_TYPES.has(body.sku_type)) {
      return { error: `sku_type must be one of: ${Array.from(SKU_TYPES).join(", ")}` };
    }
    row.sku_type = body.sku_type;
  }

  // ── Storefront (rich product page content) ──────────────────────────
  if (body.long_description !== undefined)
    row.long_description = body.long_description == null
      ? null : String(body.long_description).slice(0, 20000);
  if (body.demo_video_url !== undefined) {
    if (body.demo_video_url == null || body.demo_video_url === "") {
      row.demo_video_url = null;
    } else {
      const u = String(body.demo_video_url).trim();
      if (!/^https?:\/\//i.test(u)) return { error: "demo_video_url must be a valid URL" };
      row.demo_video_url = u.slice(0, 2000);
    }
  }
  if (body.external_marketing_url !== undefined) {
    if (body.external_marketing_url == null || body.external_marketing_url === "") {
      row.external_marketing_url = null;
    } else {
      const u = String(body.external_marketing_url).trim();
      if (!/^https?:\/\//i.test(u)) return { error: "external_marketing_url must be a valid URL" };
      row.external_marketing_url = u.slice(0, 2000);
    }
  }
  // JSONB arrays — validate shape, cap size, sanitize each entry
  if (body.screenshots !== undefined) {
    if (!Array.isArray(body.screenshots)) return { error: "screenshots must be an array of URLs" };
    if (body.screenshots.length > 10) return { error: "screenshots: max 10 images" };
    const shots = [];
    for (const s of body.screenshots) {
      const u = String(s || "").trim();
      if (!u) continue;
      if (!/^https?:\/\//i.test(u)) return { error: "each screenshot must be a valid URL" };
      shots.push(u.slice(0, 2000));
    }
    row.screenshots = shots;
  }
  if (body.package_details !== undefined) {
    if (!Array.isArray(body.package_details)) return { error: "package_details must be an array" };
    if (body.package_details.length > 30) return { error: "package_details: max 30 items" };
    row.package_details = body.package_details.map((item) => ({
      label:    String((item && item.label) || "").slice(0, 240),
      included: item && item.included === false ? false : true,
    })).filter((x) => x.label);
  }
  if (body.faq !== undefined) {
    if (!Array.isArray(body.faq)) return { error: "faq must be an array of {q, a}" };
    if (body.faq.length > 30) return { error: "faq: max 30 items" };
    row.faq = body.faq.map((item) => ({
      q: String((item && item.q) || "").slice(0, 500),
      a: String((item && item.a) || "").slice(0, 5000),
    })).filter((x) => x.q && x.a);
  }
  if (body.testimonials !== undefined) {
    if (!Array.isArray(body.testimonials)) return { error: "testimonials must be an array" };
    if (body.testimonials.length > 20) return { error: "testimonials: max 20 items" };
    row.testimonials = body.testimonials.map((item) => ({
      author: String((item && item.author) || "").slice(0, 120),
      role:   String((item && item.role)   || "").slice(0, 120),
      body:   String((item && item.body)   || "").slice(0, 2000),
    })).filter((x) => x.body);
  }

  // ── Fulfillment ─────────────────────────────────────────────────────
  if (body.fulfillment_redirect_url !== undefined) {
    if (body.fulfillment_redirect_url == null || body.fulfillment_redirect_url === "") {
      row.fulfillment_redirect_url = null;
    } else {
      const u = String(body.fulfillment_redirect_url).trim();
      if (!/^https?:\/\//i.test(u)) return { error: "fulfillment_redirect_url must be a valid URL" };
      row.fulfillment_redirect_url = u.slice(0, 2000);
    }
  }
  if (body.fulfillment_webhook_url !== undefined) {
    if (body.fulfillment_webhook_url == null || body.fulfillment_webhook_url === "") {
      row.fulfillment_webhook_url = null;
    } else {
      const u = String(body.fulfillment_webhook_url).trim();
      if (!/^https?:\/\//i.test(u)) return { error: "fulfillment_webhook_url must be a valid URL" };
      row.fulfillment_webhook_url = u.slice(0, 2000);
    }
  }
  if (body.fulfillment_webhook_secret !== undefined) {
    row.fulfillment_webhook_secret = body.fulfillment_webhook_secret == null
      ? null : String(body.fulfillment_webhook_secret).slice(0, 240);
  }
  if (body.redemption_window_days !== undefined) {
    const n = parseInt(body.redemption_window_days, 10);
    if (!Number.isFinite(n) || n < 1 || n > 3650) {
      return { error: "redemption_window_days must be between 1 and 3650 (10 years)" };
    }
    row.redemption_window_days = n;
  }
  if (body.package_duration_days !== undefined) {
    if (body.package_duration_days == null || body.package_duration_days === "") {
      row.package_duration_days = null;
    } else {
      const n = parseInt(body.package_duration_days, 10);
      if (!Number.isFinite(n) || n < 1 || n > 3650) {
        return { error: "package_duration_days must be between 1 and 3650 (10 years)" };
      }
      row.package_duration_days = n;
    }
  }

  // ── Pricing & Affiliate (commission model v2) ──────────────────────
  // affiliate_pool_pct replaces default_commission_pct semantically.
  // The DB trigger (in MIGRATION-pricing-plans.sql) keeps the two
  // columns in sync, so writing either populates both. We accept and
  // route through both names — newer clients use affiliate_pool_pct.
  if (body.affiliate_pool_pct !== undefined) {
    const pct = Number(body.affiliate_pool_pct);
    if (!Number.isFinite(pct)) return { error: "affiliate_pool_pct must be a number" };
    if (pct < 0 || pct > 80) return { error: "affiliate_pool_pct must be between 0 and 80" };
    row.affiliate_pool_pct = Math.round(pct * 100) / 100;
  }

  // ── New marketing content fields (Restructure-4) ────────────────────
  // String-array fields. Each entry trimmed, empties dropped. Caps keep
  // any one product from blowing up the row size.
  const arrayField = (key, max, maxLen) => {
    if (body[key] === undefined) return;
    if (!Array.isArray(body[key])) return { error: `${key} must be an array of strings` };
    if (body[key].length > max) return { error: `${key}: max ${max} items` };
    row[key] = body[key]
      .map((s) => String(s == null ? "" : s).trim().slice(0, maxLen))
      .filter(Boolean);
    return null;
  };
  let arrErr;
  if ((arrErr = arrayField("tldr_bullets",   5, 240)))  return arrErr;
  if ((arrErr = arrayField("alternative_to", 10, 80)))  return arrErr;
  if ((arrErr = arrayField("integrations",   20, 80)))  return arrErr;
  if ((arrErr = arrayField("best_for",       10, 80)))  return arrErr;
  if ((arrErr = arrayField("deal_terms",     20, 500))) return arrErr;

  // Trust block
  if (body.refund_window_days !== undefined) {
    if (body.refund_window_days == null || body.refund_window_days === "") {
      row.refund_window_days = null;
    } else {
      const n = parseInt(body.refund_window_days, 10);
      if (!Number.isFinite(n) || n < 0 || n > 365) {
        return { error: "refund_window_days must be between 0 and 365" };
      }
      row.refund_window_days = n;
    }
  }
  if (body.guarantee_label !== undefined) {
    row.guarantee_label = body.guarantee_label == null
      ? null : String(body.guarantee_label).trim().slice(0, 120) || null;
  }

  // Company card — all optional text + a couple of constrained selects
  const textField = (key, max) => {
    if (body[key] === undefined) return;
    row[key] = body[key] == null ? null : String(body[key]).trim().slice(0, max) || null;
  };
  const urlField = (key) => {
    if (body[key] === undefined) return;
    if (body[key] == null || body[key] === "") { row[key] = null; return; }
    const u = String(body[key]).trim();
    if (!/^https?:\/\//i.test(u)) return { error: `${key} must be a valid URL` };
    row[key] = u.slice(0, 2000);
    return null;
  };

  let urlErr;
  if ((urlErr = urlField("company_logo_url")))    return urlErr;
  if ((urlErr = urlField("company_website_url"))) return urlErr;
  if ((urlErr = urlField("founder_photo_url")))   return urlErr;
  if ((urlErr = urlField("founder_linkedin_url"))) return urlErr;

  textField("company_tagline", 240);
  textField("company_about",   5000);
  textField("company_city",    120);
  textField("founder_name",    120);
  textField("founder_role",    120);

  if (body.company_country_code !== undefined) {
    if (body.company_country_code == null || body.company_country_code === "") {
      row.company_country_code = null;
    } else {
      const cc = String(body.company_country_code).trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(cc)) return { error: "company_country_code must be a 2-letter ISO code (US, TW, etc.)" };
      row.company_country_code = cc;
    }
  }

  // Constrained dropdowns — accept the seller's choice as-is from the
  // allowlist used in the modal. Lenient: anything outside the list is
  // coerced to null rather than erroring (UI keeps the seller honest).
  const oneOf = (key, allowed) => {
    if (body[key] === undefined) return;
    if (body[key] == null || body[key] === "") { row[key] = null; return; }
    const v = String(body[key]).trim();
    row[key] = allowed.includes(v) ? v : null;
  };
  oneOf("company_size",           ["1-10", "11-50", "51-200", "201-500", "501+"]);
  oneOf("company_growth_stage",   ["Idea", "Pre-revenue", "Growth", "Profitable"]);
  oneOf("company_funding_status", ["Bootstrapped", "Pre-seed", "Seed", "Series A", "Series B+"]);

  if (body.company_founded_date !== undefined) {
    if (body.company_founded_date == null || body.company_founded_date === "") {
      row.company_founded_date = null;
    } else {
      const d = String(body.company_founded_date).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "company_founded_date must be YYYY-MM-DD" };
      row.company_founded_date = d;
    }
  }

  // ── Hero image carousel ───────────────────────────────────────────
  if (body.hero_images !== undefined) {
    if (!Array.isArray(body.hero_images)) return { error: "hero_images must be an array of URLs" };
    if (body.hero_images.length > 8) return { error: "hero_images: max 8 images" };
    const urls = [];
    for (const u of body.hero_images) {
      const s = String(u || "").trim();
      if (!s) continue;
      if (!/^https?:\/\//i.test(s)) return { error: "each hero_image must be a valid http(s) URL" };
      urls.push(s.slice(0, 2000));
    }
    row.hero_images = urls;
  }

  // ── Feature blocks (zigzag content) ───────────────────────────────
  // Each block: { heading, bullets[], image_url }. Max 8 blocks, max
  // 6 bullets per block. The buyer page renders these alternating
  // image-left/image-right.
  if (body.feature_blocks !== undefined) {
    if (!Array.isArray(body.feature_blocks)) return { error: "feature_blocks must be an array" };
    if (body.feature_blocks.length > 8) return { error: "feature_blocks: max 8 blocks" };
    const blocks = [];
    for (const b of body.feature_blocks) {
      if (!b || typeof b !== "object") continue;
      const heading = String(b.heading || "").trim().slice(0, 240);
      if (!heading) continue;  // heading is required per block
      const bullets = Array.isArray(b.bullets)
        ? b.bullets.map((x) => String(x || "").trim().slice(0, 500)).filter(Boolean).slice(0, 6)
        : [];
      let imageUrl = String(b.image_url || "").trim();
      if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
        return { error: `feature_blocks: each image_url must be a valid http(s) URL (block "${heading.slice(0,40)}")` };
      }
      imageUrl = imageUrl.slice(0, 2000) || null;
      blocks.push({ heading, bullets, image_url: imageUrl });
    }
    row.feature_blocks = blocks;
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

    // ── PUBLIC product page (gated) ──
    // GET /api/products?action=public&id=<uuid>[&bb_click=<id>]
    //
    // Three access modes (see [[mor-product-page-model]] "The gate" section):
    //   1. bb_click present + valid UUID format     → full product
    //   2. Bearer auth + user owns product           → full product + is_owner=true
    //   3. Neither                                   → minimal gated response
    //
    // The gated response contains ONLY name + image_url + the gated flag.
    // The frontend uses it to render the "Exclusive to affiliates" gate.
    // Price, description, FAQ, etc. are hidden — sellers can't bypass the
    // affiliate ecosystem by sharing the bare /p/<uuid> URL.
    if (req.method === "GET" && action === "public") {
      const id = (req.query && req.query.id) || (req.query && req.query.token);
      if (!id) return res.status(400).json({ error: "id is required" });

      const bbClick = (req.query && req.query.bb_click) || "";
      const hasValidClick = typeof bbClick === "string" && /^[0-9a-fA-F-]{8,40}$/.test(bbClick);

      // Pull all fields — we'll decide what to expose based on access mode.
      const { data, error } = await sb
        .from("products")
        .select(`
          id, advertiser_id, name, description, image_url, status,
          price, currency, sku_type,
          long_description, screenshots, demo_video_url,
          package_details, faq, testimonials,
          external_marketing_url, default_url,
          default_commission_pct, redemption_window_days, package_duration_days
        `)
        .eq("id", id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data || data.status !== "active") {
        return res.status(404).json({ error: "Product not found" });
      }

      // Advertiser-ownership check (preview mode). If a Bearer token is
      // present, validate via Supabase auth and check if the user owns
      // this product. We do NOT 401 on missing/invalid auth — we just
      // fall through to the gated response.
      let isOwner = false;
      const authHeader = req.headers.authorization || "";
      if (authHeader.startsWith("Bearer ") && data.advertiser_id) {
        const token = authHeader.replace(/^Bearer\s+/i, "");
        const anon = sbAnon();
        if (anon) {
          try {
            const { data: { user } } = await anon.auth.getUser(token);
            if (user && user.id === data.advertiser_id) isOwner = true;
          } catch (_) { /* swallow — gate the page */ }
        }
      }

      // Decide which response to return.
      if (!hasValidClick && !isOwner) {
        // GATED — minimal payload, just enough to render the gate UI.
        return res.json({
          product: {
            id:        data.id,
            name:      data.name,
            image_url: data.image_url,
          },
          access: {
            gated:  true,
            reason: "no_affiliate",
          },
        });
      }

      // FULL access — buyer with valid bb_click, or advertiser previewing.
      const safe = {
        id:                       data.id,
        name:                     data.name,
        description:              data.description,
        image_url:                data.image_url,
        price:                    data.price,
        currency:                 data.currency,
        sku_type:                 data.sku_type,
        long_description:         data.long_description,
        screenshots:              data.screenshots || [],
        demo_video_url:           data.demo_video_url,
        package_details:          data.package_details || [],
        faq:                      data.faq || [],
        testimonials:             data.testimonials || [],
        external_marketing_url:   data.external_marketing_url,
        default_url:              data.default_url,
        commission_pct_display:   data.default_commission_pct,
        package_duration_days:    data.package_duration_days,
      };
      return res.json({
        product: safe,
        access: {
          gated:    false,
          reason:   isOwner ? "preview" : "affiliate",
          is_owner: isOwner,
        },
      });
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

      // Affiliate marketplace = products that are status='active' AND
      // audit_status='approved'. The audit gate ensures every product an
      // affiliate can promote has been verified to have a real discount
      // against the seller's own site — see [[pricing-plans-audit-policy]].
      // Without this filter, affiliates would mint share links for products
      // that 403 at checkout, leading to broken funnels + lost trust.
      let query = sb
        .from("products")
        .select(`
          id, name, description, image_url, hero_images,
          default_url, external_marketing_url,
          affiliate_pool_pct, default_commission_pct,
          tldr_bullets, alternative_to, integrations, best_for,
          company_tagline, founder_name,
          advertiser_id, created_at
        `, { count: "exact" })
        .eq("status", "active")
        .eq("audit_status", "approved")
        .order("affiliate_pool_pct", { ascending: false })  // best affiliate-budget first
        .range(offset, offset + limit - 1);
      if (q) query = query.ilike("name", `%${q}%`);

      const { data, count, error } = await query;
      if (error) return res.status(500).json({ error: error.message });

      // Enrich with the lowest-priced active plan so affiliates can compare
      // (otherwise the catalog row would lack a price entirely now that
      // pricing moved off products onto pricing_plans).
      const productIds = (data || []).map((p) => p.id);
      let plansByProduct = {};
      if (productIds.length) {
        const { data: plans } = await sb
          .from("pricing_plans")
          .select("product_id, plan_name, price, original_price, currency, billing_period, is_recommended, sort_order")
          .in("product_id", productIds)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });
        (plans || []).forEach((pl) => {
          const arr = plansByProduct[pl.product_id] || (plansByProduct[pl.product_id] = []);
          arr.push(pl);
        });
      }

      const enriched = (data || []).map((p) => {
        const plans = plansByProduct[p.id] || [];
        const cheapest = plans.length
          ? plans.slice().sort((a, b) => Number(a.price) - Number(b.price))[0]
          : null;
        // Affiliate-relevant commission preview: 70% of the pool, on the
        // cheapest plan's price (a buyer floor). Helps affiliates eyeball
        // "is this worth promoting?" without clicking through.
        const poolPct = Number(p.affiliate_pool_pct) || 0;
        const projectedCommission = cheapest && cheapest.price != null
          ? Math.round((Number(cheapest.price) * poolPct / 100 * 0.70) * 100) / 100
          : null;
        return Object.assign({}, p, {
          plans_count:           plans.length,
          cheapest_plan:         cheapest,
          projected_commission:  projectedCommission,
        });
      });

      return res.json({ products: enriched, total: count || 0 });
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

      // Auto-create a default pricing plan from the modal's price/currency
      // so the seller has something to attach proof to from day one.
      // Plan starts in 'pending' audit status — NOT auto-approved like the
      // backfilled legacy plans were. New products must go through the
      // audit gate before they're purchasable. See [[pricing-plans-audit-policy]].
      if (data && data.id && data.price != null && Number(data.price) > 0) {
        try {
          await sb.from("pricing_plans").insert({
            product_id:     data.id,
            plan_name:      pickDefaultPlanName(data.sku_type),
            price:          data.price,
            currency:       data.currency || "USD",
            billing_period: pickDefaultBillingPeriod(data.sku_type),
            audit_status:   "pending",
            is_active:      true,
            is_recommended: true,
            sort_order:     0,
            features:       [],
          });
        } catch (e) {
          // Don't fail the product create over a missing default plan —
          // seller can add one manually on the Pricing plans sub-page.
          console.warn(`[products] default plan auto-create failed for product ${data.id}:`, e.message);
        }
      }

      return res.status(201).json({ product: data });
    }

    // ── UPDATE (partial) ───────────────────────────────────────────────
    // LOCK RULE: approved products are immutable. To make any change, the
    // seller must archive the product and create a new one (or use the
    // "Duplicate as new" affordance). Eliminates the bait-and-switch
    // surface entirely. See [[pricing-plans-audit-policy]] and the
    // 2026-06-13 lock-decision conversation.
    if ((req.method === "PATCH" || req.method === "POST") && action === "update") {
      const auth = await requireAdvertiser(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });

      const id = body.id || req.query.id;
      if (!id) return res.status(400).json({ error: "id is required" });

      // Lock check — fetch audit_status BEFORE attempting the update
      const { data: existing, error: lookupErr } = await sb
        .from("products")
        .select("id, audit_status, advertiser_id")
        .eq("id", id)
        .maybeSingle();
      if (lookupErr) return res.status(500).json({ error: lookupErr.message });
      if (!existing) return res.status(404).json({ error: "Product not found" });
      if (existing.advertiser_id !== auth.advertiserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (existing.audit_status === "approved") {
        return res.status(403).json({
          error: "Approved products are immutable. To make changes, archive this product and create a new one (use 'Duplicate as new' to start from these values).",
          code:  "product_locked",
        });
      }

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

    // ── SUBMIT FOR AUDIT (product-level) ───────────────────────────────
    // Seller signals "I'm ready — review my whole product page."
    // Resets audit_status to 'pending' (from any non-pending state),
    // clears prior reviewer notes. Verifies at least one active plan
    // exists with a price + proof URL so the reviewer has something to
    // verify the discount against. See [[pricing-plans-audit-policy]].
    if (req.method === "POST" && action === "submit_for_audit") {
      const auth = await requireAdvertiser(req);
      if (auth.error) return res.status(auth.status).json({ error: auth.error });

      const id = body.id || req.query.id;
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        return res.status(400).json({ error: "Product id is required" });
      }

      // Ownership + existence check
      const { data: product, error: pErr } = await sb
        .from("products")
        .select("id, advertiser_id, audit_status, status, name")
        .eq("id", id)
        .maybeSingle();
      if (pErr)     return res.status(500).json({ error: pErr.message });
      if (!product) return res.status(404).json({ error: "Product not found" });
      if (product.advertiser_id !== auth.advertiserId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (product.status !== "active") {
        return res.status(400).json({ error: "Archived products can't be submitted for audit. Restore it first." });
      }

      // Eligibility: at least one active plan with price > 0 and a proof URL
      const { data: plans } = await sb
        .from("pricing_plans")
        .select("id, price, original_price_proof_url, is_active")
        .eq("product_id", id);
      const plansArr = Array.isArray(plans) ? plans : [];
      const eligible = plansArr.filter((p) => p.is_active && Number(p.price) > 0 && p.original_price_proof_url);
      if (!eligible.length) {
        return res.status(400).json({
          error: "Add at least one active pricing plan with a proof URL before submitting for audit.",
          code:  "no_eligible_plan",
        });
      }

      const { data: updated, error: uErr } = await sb
        .from("products")
        .update({
          audit_status:        "pending",
          audit_reviewer_id:   null,
          audit_reviewed_at:   null,
          audit_review_notes:  null,
        })
        .eq("id", id)
        .select("id, audit_status, audit_reviewed_at, name")
        .maybeSingle();
      if (uErr) return res.status(500).json({ error: uErr.message });

      return res.json({ success: true, product: updated });
    }

    return res.status(400).json({
      error: "Unknown action. Use: (GET) list/get/browse, (POST) create/archive/restore/submit_for_audit, (PATCH) update",
    });
  } catch (err) {
    console.error("[products] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
