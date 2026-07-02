/**
 * Boost Boss — waitlist capture
 *
 *   POST /api/waitlist   body: { email, source? }
 *
 * Stores an email into the `waitlist` table (dedup on email). Follows the
 * project's dual-mode convention: with Supabase configured it persists to
 * the table; without it (demo/local) it accepts the email in-memory so the
 * front-end flow still works. On a DB error the email is logged so it is
 * never silently lost.
 *
 * Table: run db/waitlist.sql in the Supabase SQL Editor before going live.
 */
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const HAS_SUPABASE = !!(SUPABASE_URL && SUPABASE_SERVICE_KEY);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

let _sb = null;
function sb() {
  if (_sb) return _sb;
  if (!HAS_SUPABASE) return null;
  _sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  return _sb;
}

// Demo-mode store (per warm lambda) so the flow works without a database.
const _mem = [];

function clientIp(req) {
  const xff = req.headers["x-forwarded-for"] || "";
  const first = String(xff).split(",")[0].trim();
  return first || req.socket?.remoteAddress || null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const email = (body.email || "").toString().trim().toLowerCase();
  const source = (body.source || "web").toString().slice(0, 40);

  if (!EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ error: "Please enter a valid email." });
  }

  const row = {
    email,
    source,
    ip: clientIp(req),
    user_agent: (req.headers["user-agent"] || "").toString().slice(0, 300),
  };

  const cli = sb();
  if (!cli) {
    // No database configured — accept it so the UX works in demo/local.
    _mem.push(row);
    return res.status(200).json({ ok: true, demo: true });
  }

  // Upsert on the unique email so re-submits don't error or duplicate.
  const { error } = await cli
    .from("waitlist")
    .upsert(row, { onConflict: "email", ignoreDuplicates: true });

  if (error) {
    // Never lose the lead: surface it in logs for manual recovery.
    console.error("waitlist DB error — email was:", email, "|", error.message);
    return res.status(500).json({ error: "Could not save right now. Please try again." });
  }

  return res.status(200).json({ ok: true });
};
