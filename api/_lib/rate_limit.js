'use strict';

/**
 * Boost Boss — minimal in-memory rate limiter
 *
 * Used for pre-launch hardening of signup-style endpoints where the
 * primary attack we worry about is a casual bot, not a determined
 * distributed adversary.
 *
 * SCALING NOTE — this is intentionally simple:
 *   • In-memory map, per Vercel function instance. A burst of traffic
 *     that spawns 4 instances effectively gets 4× the per-instance
 *     limit. That's still way better than no limit.
 *   • For real protection at scale, swap to Vercel KV (Upstash Redis)
 *     by replacing this module's exports while keeping the same shape.
 *     The caller surface (`check(key, action, opts)`) is the contract.
 *   • Supabase auth.signUp() also has built-in rate limiting at the
 *     project level (~30/hour/IP by default). This module is a second
 *     layer of defense, not the primary one.
 *
 * Usage:
 *   const rl = require("./_lib/rate_limit.js");
 *   const decision = rl.check(getClientIp(req), "signup", { limit: 10, windowMs: 3600_000 });
 *   if (!decision.allowed) {
 *     return res.status(429).json({ error: decision.error, retry_after_seconds: decision.retryAfter });
 *   }
 */

// Map<actionKey, Map<identifier, { count, resetAt }>>
const _buckets = new Map();

// Periodically prune expired entries so the in-memory map can't grow
// unbounded across the lifetime of a hot Vercel instance.
let _lastPrune = 0;
const PRUNE_INTERVAL_MS = 5 * 60 * 1000; // 5 min

function _maybePrune(now) {
  if (now - _lastPrune < PRUNE_INTERVAL_MS) return;
  _lastPrune = now;
  for (const [action, byId] of _buckets) {
    for (const [id, entry] of byId) {
      if (entry.resetAt <= now) byId.delete(id);
    }
    if (byId.size === 0) _buckets.delete(action);
  }
}

/**
 * Check whether `identifier` is allowed to perform `action` right now.
 *
 * @param {string} identifier — caller-supplied key, usually a client IP.
 *                              Pass a fallback like "unknown" when IP
 *                              isn't extractable so we still rate-limit
 *                              (just per shared bucket).
 * @param {string} action — opaque tag, e.g. "signup", "signin", "deposit".
 * @param {object} [opts]
 * @param {number} [opts.limit=10] — max calls per window.
 * @param {number} [opts.windowMs=3600000] — rolling window, default 1 hour.
 * @param {string} [opts.errorMessage] — optional override for the 429 body.
 * @returns {{ allowed: boolean, retryAfter: number, error?: string }}
 */
function check(identifier, action, opts = {}) {
  // Tests and local dev can opt out of rate limiting entirely. CI and
  // unit tests should set BBX_DISABLE_RATE_LIMIT=1 (or the test file
  // sets it inline before requiring api modules).
  if (process.env.BBX_DISABLE_RATE_LIMIT === '1' ||
      process.env.BBX_DISABLE_RATE_LIMIT === 'true') {
    return { allowed: true, retryAfter: 0 };
  }

  if (!identifier || typeof identifier !== 'string') identifier = 'unknown';
  if (!action || typeof action !== 'string') action = 'default';

  const limit = Number(opts.limit) > 0 ? Number(opts.limit) : 10;
  const windowMs = Number(opts.windowMs) > 0 ? Number(opts.windowMs) : 3600_000;
  const now = Date.now();

  _maybePrune(now);

  let byId = _buckets.get(action);
  if (!byId) {
    byId = new Map();
    _buckets.set(action, byId);
  }

  let entry = byId.get(identifier);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    byId.set(identifier, entry);
  }

  entry.count += 1;

  if (entry.count > limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      error: opts.errorMessage ||
        `Too many ${action} attempts. Try again in ${Math.ceil((entry.resetAt - now) / 60_000)} minutes.`,
    };
  }

  return { allowed: true, retryAfter: 0 };
}

/**
 * Extract a best-effort client IP from a Vercel/Node request. Vercel
 * sets x-forwarded-for and x-real-ip; fall back to socket address.
 * Returns a string like "1.2.3.4" or "unknown".
 */
function getClientIp(req) {
  if (!req || !req.headers) return 'unknown';
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    // First entry is the originating client; rest are upstream proxies.
    return fwd.split(',')[0].trim() || 'unknown';
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length > 0) return real;
  // Last resort: Node's connection remote address.
  const sock = req.socket || req.connection;
  if (sock && sock.remoteAddress) return sock.remoteAddress;
  return 'unknown';
}

/** Reset the in-memory state — used by tests and explicit operator action. */
function _resetForTests() {
  _buckets.clear();
  _lastPrune = 0;
}

module.exports = {
  check,
  getClientIp,
  _resetForTests,
};
