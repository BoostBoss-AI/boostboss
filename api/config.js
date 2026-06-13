/**
 * Boost Boss — public client config
 *
 * Returns a whitelisted subset of public-safe configuration values that
 * the front-end needs. Used by the checkout page to fetch the PayPal
 * client ID without embedding it in HTML (so we can swap sandbox /
 * production / environment without rebuilds).
 *
 * Only keys in PUBLIC_KEYS are exposed. Never add secrets here.
 *
 *   GET /api/config?key=paypal_client_id
 *     → { key: "paypal_client_id", value: "..." }
 *
 * Returns 404 for unknown keys, empty value for unset keys (so the
 * caller can fall back to sandbox).
 */

"use strict";

// Whitelisted env vars. The value is read from process.env at request time.
// PUBLIC_KEYS controls which keys are exposable — adding a key here makes
// it readable by anyone over HTTP. Only include values that are safe to
// publish (client IDs, public URLs, feature flags).
const PUBLIC_KEYS = {
  paypal_client_id: () => process.env.PAYPAL_CLIENT_ID || "",
};

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const key = req.query && req.query.key;
  if (!key) return res.status(400).json({ error: "key is required" });

  const resolver = PUBLIC_KEYS[key];
  if (!resolver) return res.status(404).json({ error: "Unknown config key" });

  return res.json({ key, value: resolver() });
};
