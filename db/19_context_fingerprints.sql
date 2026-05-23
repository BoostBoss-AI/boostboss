-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — CONTEXT FINGERPRINTS   (migration 19)
-- Apply with: paste into Supabase → SQL Editor.
--
-- "Capture now, score later." The 4-door build threads a `context` payload
-- through every ad request (the user's current message / task, publisher
-- vertical, surface). The auction derives a deterministic `context_hash`
-- from that payload and stamps it onto every event the request produces.
--
-- This makes the feedback loop context-aware WITHOUT building any ML now:
--   • events.context_hash      — joins impression / click / skip / close /
--                                dismiss / conversion rows back to the
--                                semantic context that produced them.
--   • context_fingerprints     — one row per distinct context. Stores the
--                                raw text, the publisher vertical, and a
--                                nullable Voyage embedding (filled offline,
--                                fire-and-forget — never on the bid path).
--
-- Benna stays a deterministic stub today. But the day real context-aware
-- scoring is built, the training data already exists — joined and waiting.
-- Training data cannot be backfilled onto requests that never carried it.
-- ═══════════════════════════════════════════════════════════════════════

-- ── 1. Stamp every event with the context that produced it ──────────────
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS context_hash TEXT;

CREATE INDEX IF NOT EXISTS events_context_hash_idx
  ON public.events (context_hash)
  WHERE context_hash IS NOT NULL;

-- ── 2. One row per distinct request context ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.context_fingerprints (
  context_hash       TEXT PRIMARY KEY,
  context_text       TEXT,                 -- raw context summary (truncated)
  publisher_vertical TEXT,                 -- declared at publisher signup
  surface            TEXT,                 -- placement surface, when known
  embedding          vector(512),          -- Voyage voyage-3-lite, nullable
  seen_count         INTEGER     DEFAULT 1,
  first_seen         TIMESTAMPTZ DEFAULT now(),
  last_seen          TIMESTAMPTZ DEFAULT now()
);

-- Rows whose embedding is still NULL are the offline embed cron's work queue.
CREATE INDEX IF NOT EXISTS context_fingerprints_unembedded_idx
  ON public.context_fingerprints (first_seen)
  WHERE embedding IS NULL;

-- ── 3. Atomic insert-or-bump ────────────────────────────────────────────
-- The auction (api/mcp.js) calls this fire-and-forget for every request.
-- ON CONFLICT makes it a single race-free round-trip: first sighting of a
-- context inserts the row; every later sighting bumps seen_count + last_seen.
-- It deliberately does NOT touch `embedding` — that is filled offline.
CREATE OR REPLACE FUNCTION public.bbx_touch_context_fingerprint(
  p_hash    TEXT,
  p_text    TEXT,
  p_surface TEXT
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.context_fingerprints (context_hash, context_text, surface)
  VALUES (p_hash, p_text, p_surface)
  ON CONFLICT (context_hash) DO UPDATE
    SET seen_count = public.context_fingerprints.seen_count + 1,
        last_seen  = now();
$$;
