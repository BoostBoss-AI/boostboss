/**
 * Boost Boss — Conversion postback + affiliate listing
 *
 * The conversion attribution endpoint. See [[commission-attribution-model]]
 * memory for the full architectural rationale.
 *
 * Endpoints
 * ─────────
 *   POST  /api/conversions/postback     advertiser → BB conversion event
 *   GET   /api/conversions              affiliate dashboard: list own conversions
 *   GET   /api/conversions?action=summary  affiliate dashboard: aggregate totals
 *
 * Postback request shape (advertiser → BB)
 *   POST /api/conversions/postback
 *   Authorization: Bearer <advertiser_api_key>    (optional but recommended)
 *   {
 *     "bb_click":        "<uuid>",        // REQUIRED — comes from URL the user landed with
 *     "event_type":      "signup" | "purchase" | "trial" | custom,
 *     "amount":          49.00,            // optional — gross purchase value
 *     "currency":        "USD",            // optional — defaults USD
 *     "idempotency_key": "ord_12345",      // optional — prevents double-credit on retries
 *     "metadata":        { "plan": "pro" } // optional — anything else useful
 *   }
 *
 * Attribution resolution
 *   1. Look up affiliate_clicks row by bb_click → gives us
 *      (affiliate_id, share_link_id, saved_ad_id)
 *   2. Look up share_link row → gives us product_id
 *   3. Look up product → gives us default_commission_pct + advertiser_id
 *   4. Compute commission_due = amount * commission_pct / 100
 *   5. Compute bb_take_due (15% take rate, see [[products-as-parent]])
 *   6. Write affiliate_conversions row with status='pending',
 *      clawback_until = now() + 30 days
 *
 * If bb_click is missing or doesn't match a click row, the postback still
 * records as an 'orphan' row for manual reconciliation (no commission credited).
 */

"use strict";

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

// BB take rate — same constant we surface in product listings and quoted
// to advertisers. Hard-coded for now; future: per-advertiser overrides.
const BB_TAKE_PCT = 15.00;

// Clawback window — how long pending conversions wait for refund signals
// before auto-confirming. 30 days is the affiliate-industry standard.
const CLAWBACK_DAYS = 30;

let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!HAS_SUPABASE) return null;
  _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _sb;
}

let _sbAnon = null;
function sbAnon() {
  if (_sbAnon) return _sbAnon;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || "";
  if (!SUPABASE_URL || !anonKey) return null;
  _sbAnon = createClient(SUPABASE_URL, anonKey, { auth: { persistSession: false } });
  return _sbAnon;
}

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"] || "";
  const first = String(xff).split(",")[0].trim();
  return first || req.socket?.remoteAddress || null;
}

// Validate event_type to a known set + custom-string allowlist (alphanumeric
// + underscore, max 40 chars). Prevents the conversion log from becoming
// a free-for-all of arbitrary advertiser-defined strings.
function normalizeEventType(t) {
  const allowed = new Set(["signup", "purchase", "trial", "credit_purchase", "subscription_start", "upgrade"]);
  if (allowed.has(t)) return t;
  if (typeof t === "string" && /^[a-z][a-z0-9_]{0,39}$/.test(t)) return t;
  return null;
}

// ──────────────────────────────────────────────────────────────────────
// POST /api/conversions/postback  — advertiser → BB
// ──────────────────────────────────────────────────────────────────────
async function handlePostback(req, res) {
  const sbCli = sb();
  if (!sbCli) return res.status(500).json({ error: "Supabase not configured" });

  const body = req.body || {};
  const bbClick = (body.bb_click || body.click_id || "").toString().trim();
  const eventType = normalizeEventType(body.event_type || body.type);
  const amount = Number(body.amount || 0);
  const currency = (body.currency || "USD").toString().slice(0, 8).toUpperCase();
  const idempotencyKey = body.idempotency_key
    ? String(body.idempotency_key).slice(0, 120) : null;
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (!eventType) {
    return res.status(400).json({
      error: "event_type is required (signup, purchase, trial, etc.)",
    });
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: "amount must be a non-negative number" });
  }

  // Resolve attribution chain via bb_click. If bb_click is missing or
  // doesn't match a click row, we still record the conversion as 'orphan'
  // so ops can investigate manually — but no commission accrues.
  let click = null;
  if (bbClick && /^[0-9a-fA-F-]{8,40}$/.test(bbClick)) {
    const { data, error } = await sbCli
      .from("affiliate_clicks")
      .select("click_id, affiliate_id, share_link_id, saved_ad_id")
      .eq("click_id", bbClick)
      .maybeSingle();
    if (!error && data) click = data;
  }

  // Resolve share link → product → advertiser if we have a matching click.
  let productId = null;
  let commissionPct = 0;
  let advertiserId = null;
  if (click && click.share_link_id) {
    const { data: link } = await sbCli
      .from("affiliate_share_links")
      .select("product_id")
      .eq("id", click.share_link_id)
      .maybeSingle();
    if (link && link.product_id) {
      productId = link.product_id;
      const { data: prod } = await sbCli
        .from("products")
        .select("advertiser_id, default_commission_pct")
        .eq("id", productId)
        .maybeSingle();
      if (prod) {
        commissionPct = Number(prod.default_commission_pct) || 0;
        advertiserId  = prod.advertiser_id || null;
      }
    }
  }

  // Compute commission_due + bb_take_due. Round to 2 decimals.
  const commissionDue = Math.round((amount * commissionPct / 100) * 100) / 100;
  const bbTakeDue     = Math.round((commissionDue * BB_TAKE_PCT / 100) * 100) / 100;

  // Status: 'orphan' if we couldn't resolve the click chain, otherwise
  // 'pending' awaiting the clawback window.
  const status = click ? "pending" : "orphan";
  const clawbackUntil = click ? new Date(Date.now() + CLAWBACK_DAYS * 86400 * 1000).toISOString() : null;

  const row = {
    click_id:        click ? click.click_id : null,
    affiliate_id:    click ? click.affiliate_id : null,
    share_link_id:   click ? click.share_link_id : null,
    product_id:      productId,
    advertiser_id:   advertiserId,
    event_type:      eventType,
    amount:          amount,
    currency:        currency,
    commission_pct:  commissionPct,
    commission_due: click ? commissionDue : 0,
    bb_take_pct:     BB_TAKE_PCT,
    bb_take_due:    click ? bbTakeDue : 0,
    status:          status,
    clawback_until:  clawbackUntil,
    idempotency_key: idempotencyKey,
    metadata:        metadata,
    client_ip:       clientIp(req),
  };

  // Idempotency check — if (advertiser, idempotency_key) already exists,
  // return the prior row instead of double-crediting. The DB also enforces
  // this via UNIQUE INDEX, but we check explicitly so the response is
  // a clean 200 OK with deduped=true instead of a 500 from the constraint.
  if (idempotencyKey && advertiserId) {
    const { data: existing } = await sbCli
      .from("affiliate_conversions")
      .select("*")
      .eq("advertiser_id", advertiserId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return res.json({
        success: true,
        deduped: true,
        conversion: { id: existing.id, status: existing.status, commission_due: existing.commission_due },
      });
    }
  }

  const { data, error } = await sbCli
    .from("affiliate_conversions")
    .insert(row)
    .select()
    .maybeSingle();

  if (error) {
    console.error("[Conversions] insert failed:", error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.json({
    success: true,
    conversion: {
      id:              data.id,
      status:          data.status,
      affiliate_id:    data.affiliate_id,
      product_id:      data.product_id,
      commission_due:  data.commission_due,
      clawback_until:  data.clawback_until,
    },
  });
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/conversions  — affiliate dashboard: list own conversions
// ──────────────────────────────────────────────────────────────────────
async function handleAffiliateList(req, res) {
  const sbCli = sb();
  if (!sbCli) return res.status(500).json({ error: "Supabase not configured" });
  const anon = sbAnon();
  if (!anon) return res.status(500).json({ error: "Supabase not configured" });

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "No token" });
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  // STRICT: require affiliates row.
  const { data: aff } = await sbCli
    .from("affiliates").select("id").eq("id", user.id).maybeSingle();
  if (!aff) return res.status(403).json({ error: "Not an affiliate", code: "not_affiliate" });

  const params = Object.assign({}, req.query || {}, req.body || {});
  const limit  = Math.min(parseInt(params.limit, 10) || 50, 200);
  const offset = Math.max(parseInt(params.offset, 10) || 0, 0);
  const status = ["pending", "confirmed", "refunded", "paid"].includes(params.status) ? params.status : null;
  const fromDate = params.from && /^\d{4}-\d{2}-\d{2}/.test(params.from) ? params.from : null;
  const toDate   = params.to   && /^\d{4}-\d{2}-\d{2}/.test(params.to)   ? params.to   : null;

  let q = sbCli
    .from("affiliate_conversions")
    .select(`
      id, event_type, amount, currency, commission_pct, commission_due,
      bb_take_pct, bb_take_due, status, clawback_until, refunded_at, paid_at,
      created_at, share_link_id, product_id,
      products(name, image_url)
    `, { count: "exact" })
    .eq("affiliate_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (status)   q = q.eq("status", status);
  if (fromDate) q = q.gte("created_at", fromDate);
  if (toDate)   q = q.lte("created_at", toDate + " 23:59:59");

  const { data, count, error } = await q;
  if (error) return res.status(500).json({ error: error.message });

  // Aggregate totals for the dashboard summary cards.
  const conversions = (data || []).map((r) => ({
    id:              r.id,
    event_type:      r.event_type,
    amount:          r.amount,
    currency:        r.currency,
    commission_pct:  r.commission_pct,
    commission_due:  r.commission_due,
    status:          r.status,
    clawback_until:  r.clawback_until,
    paid_at:         r.paid_at,
    created_at:      r.created_at,
    product:         r.products ? { name: r.products.name, image_url: r.products.image_url } : null,
  }));

  return res.json({ conversions, total: count || 0 });
}

// ──────────────────────────────────────────────────────────────────────
// GET /api/conversions?action=summary  — totals for dashboard cards
// ──────────────────────────────────────────────────────────────────────
async function handleAffiliateSummary(req, res) {
  const sbCli = sb();
  if (!sbCli) return res.status(500).json({ error: "Supabase not configured" });
  const anon = sbAnon();
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "No token" });
  const { data: { user }, error: authErr } = await anon.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });
  const { data: aff } = await sbCli
    .from("affiliates").select("id").eq("id", user.id).maybeSingle();
  if (!aff) return res.status(403).json({ error: "Not an affiliate", code: "not_affiliate" });

  // Pull all rows for this affiliate. At 10k+ conversions per affiliate
  // we'd want a SQL aggregate via RPC; for MVP scale (<1k per affiliate)
  // the client-side sum here is fine.
  const { data, error } = await sbCli
    .from("affiliate_conversions")
    .select("status, amount, commission_due, event_type")
    .eq("affiliate_id", user.id);
  if (error) return res.status(500).json({ error: error.message });

  const rows = data || [];
  const pending   = rows.filter((r) => r.status === "pending");
  const confirmed = rows.filter((r) => r.status === "confirmed");
  const paid      = rows.filter((r) => r.status === "paid");
  const refunded  = rows.filter((r) => r.status === "refunded");

  const sumCommission = (arr) => arr.reduce((a, r) => a + (Number(r.commission_due) || 0), 0);
  const sumAmount     = (arr) => arr.reduce((a, r) => a + (Number(r.amount) || 0), 0);

  const signups     = rows.filter((r) => r.event_type === "signup" && r.status !== "orphan").length;
  const activations = rows.filter((r) => ["purchase", "credit_purchase", "subscription_start", "upgrade"]
    .includes(r.event_type) && r.status !== "orphan").length;
  const newUsers    = rows.filter((r) => r.event_type === "signup" && r.status !== "orphan").length;

  return res.json({
    counts: {
      total:     rows.length,
      pending:   pending.length,
      confirmed: confirmed.length,
      paid:      paid.length,
      refunded:  refunded.length,
      signups,
      activations,
      new_users: newUsers,
    },
    money: {
      // Pending = commission expected to pay out after clawback window
      pending_commission:   Math.round(sumCommission(pending) * 100) / 100,
      // Confirmed = past clawback, awaiting next payout batch
      confirmed_commission: Math.round(sumCommission(confirmed) * 100) / 100,
      // Paid = lifetime earnings actually sent to PayPal
      paid_commission:      Math.round(sumCommission(paid) * 100) / 100,
      // Total revenue we surfaced to advertisers from this affiliate's traffic
      revenue:              Math.round(sumAmount(rows.filter((r) => r.status !== "orphan")) * 100) / 100,
    },
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

  // Postback path is gated on POST + path/action=postback so that public
  // GET requests can't accidentally record a conversion.
  const action = (req.query && req.query.action) || (req.body && req.body.action) || null;
  const isPostback =
    (req.url || "").endsWith("/postback") ||
    action === "postback" ||
    (req.method === "POST" && !action);

  try {
    if (req.method === "POST" && isPostback) {
      return await handlePostback(req, res);
    }
    if (req.method === "GET" && action === "summary") {
      return await handleAffiliateSummary(req, res);
    }
    if (req.method === "GET") {
      return await handleAffiliateList(req, res);
    }
    return res.status(400).json({ error: "Unknown action. Use POST /postback or GET (with optional ?action=summary)." });
  } catch (err) {
    console.error("[conversions] handler error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
};
