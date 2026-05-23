/**
 * Boost Boss — context fingerprinting helper.
 *
 * "Capture now, score later." Every ad request across all four doors
 * carries a context payload — the user's current message / task. This
 * helper derives a deterministic `context_hash` from it so every
 * downstream feedback event (impression, click, skip, close, dismiss,
 * conversion) can be joined back to the semantic context that produced
 * it.
 *
 * There is NO machine learning here. This is pure capture: the auction
 * stamps the hash onto tracking URLs and upserts a context_fingerprints
 * row. Benna stays a deterministic stub. But the day real context-aware
 * scoring is built, the training data already exists — joined and
 * waiting. Training data cannot be backfilled onto requests that never
 * carried a context fingerprint.
 *
 * See db/19_context_fingerprints.sql.
 */

// ── Normalisation ───────────────────────────────────────────────────────
// Collapse trivially-different phrasings of the same request to one hash:
// lowercase, collapse internal whitespace, trim, cap length so a runaway
// context can't blow up the hash loop or the stored text.
function normalizeContext(text) {
  return String(text == null ? "" : text)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

// ── Deterministic hash ──────────────────────────────────────────────────
// Two independent FNV-style accumulators combined. Collision risk is far
// lower than a single 32-bit hash, and a collision is harmless — it only
// merges two contexts in analytics, never a correctness or billing bug.
// Pure function of the text: stable across processes, deploys, and doors.
function hashString(s) {
  let h1 = 0x811c9dc5;
  let h2 = 0xc2b2ae35;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

/**
 * Derive the stable context hash for a request's context text.
 * Returns "ctx_<hash>", or null when there is no usable context — a null
 * means "no fingerprint to stamp", and downstream code leaves the column
 * NULL rather than inventing a hash.
 */
function deriveContextHash(text) {
  const norm = normalizeContext(text);
  if (!norm) return null;
  return "ctx_" + hashString(norm);
}

// ── Fingerprint upsert ──────────────────────────────────────────────────
// Demo-mode mirror of context_fingerprints so tests covering the capture
// path run without a database. Keyed by context_hash.
const DEMO_FINGERPRINTS = new Map();

/**
 * Insert-or-bump a context_fingerprints row. Call this fire-and-forget
 * from the auction — NEVER await it on the bid path.
 *
 *   • Supabase: one race-free round-trip via bbx_touch_context_fingerprint
 *     (INSERT ... ON CONFLICT DO UPDATE).
 *   • Demo:     in-memory Map, same insert-or-bump semantics.
 *
 * `embedding` is deliberately untouched here — it is filled offline by
 * the embed cron (see api/_lib/embeddings.js + the unembedded index).
 */
async function touchContextFingerprint(sb, opts) {
  const o = opts || {};
  const contextHash = o.contextHash || null;
  if (!contextHash) return { ok: false, reason: "no_hash" };
  const contextText = normalizeContext(o.contextText);
  const surface     = o.surface ? String(o.surface) : null;

  if (sb) {
    try {
      const { error } = await sb.rpc("bbx_touch_context_fingerprint", {
        p_hash:    contextHash,
        p_text:    contextText || null,
        p_surface: surface,
      });
      if (error) {
        console.error("bbx:context:touch_fail", JSON.stringify({
          tag: "context.touch_fail",
          context_hash: contextHash,
          pg_code: error.code || null,
          pg_message: error.message || null,
        }));
        return { ok: false, reason: "rpc_error" };
      }
      return { ok: true, mode: "supabase" };
    } catch (e) {
      console.error("bbx:context:touch_fail", JSON.stringify({
        tag: "context.touch_fail", context_hash: contextHash,
        message: e && e.message,
      }));
      return { ok: false, reason: "exception" };
    }
  }

  // Demo path — in-memory insert-or-bump.
  const existing = DEMO_FINGERPRINTS.get(contextHash);
  if (existing) {
    existing.seen_count += 1;
    existing.last_seen = new Date().toISOString();
  } else {
    DEMO_FINGERPRINTS.set(contextHash, {
      context_hash: contextHash,
      context_text: contextText || null,
      surface,
      embedding: null,
      seen_count: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
    });
  }
  return { ok: true, mode: "demo" };
}

module.exports = {
  normalizeContext,
  deriveContextHash,
  touchContextFingerprint,
  // Test exports
  _DEMO_FINGERPRINTS: DEMO_FINGERPRINTS,
  _reset: () => DEMO_FINGERPRINTS.clear(),
};
