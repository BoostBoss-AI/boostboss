/**
 * Boost Boss — PayPal webhook receiver
 *
 * Sibling of api/stripe-webhook.js. PayPal's verify-webhook-signature
 * endpoint does NOT require us to compute an HMAC of the raw body, but
 * the body MUST be JSON-parsed exactly as PayPal sent it (no body
 * parser middleware re-serializing the keys in a different order).
 * Disabling the Vercel body parser here is the simplest guarantee.
 *
 * Configure your PayPal webhook to point at:
 *   https://boostboss.ai/api/paypal-webhook
 *
 * Required env (read by api/_lib/payin/paypal.js):
 *   PAYPAL_CLIENT_ID     — REST app client id
 *   PAYPAL_CLIENT_SECRET — REST app secret
 *   PAYPAL_ENV           — "sandbox" or "live"
 *   PAYPAL_WEBHOOK_ID    — id of the webhook config on PayPal side
 */

module.exports.config = { api: { bodyParser: false } };

const billing = require("./billing.js");

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")    return res.status(405).json({ error: "POST only" });

  let raw = "";
  try { raw = await readRawBody(req); }
  catch (e) { return res.status(400).json({ error: "could not read body: " + e.message }); }

  req.rawBody = raw;
  try { req.body = JSON.parse(raw); }
  catch (_) { req.body = null; }

  req.query = Object.assign({}, req.query, { action: "paypal_webhook" });
  return billing(req, res);
};
