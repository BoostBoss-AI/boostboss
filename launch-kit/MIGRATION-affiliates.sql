-- ════════════════════════════════════════════════════════════════════════
-- Boost Boss — Affiliate marketplace v1 migration
-- ════════════════════════════════════════════════════════════════════════
--
-- Run in: Supabase Dashboard → SQL Editor → New query → Paste → Run.
-- Safe to re-run (IF NOT EXISTS).
--
-- WHAT THIS DOES
-- --------------
-- Establishes a third user role — "affiliate" — alongside advertiser and
-- publisher. Affiliates SAVE ads they see in the wild (when the SDK ships
-- a "save to affiliate" button on every placement), eventually share them
-- with their audience, and earn a cut when those shares convert to sales.
--
-- Today's MVP scope:
--   - Affiliate signup + login
--   - Dashboard that lists what they've saved
--   - Nothing actually flows in yet (SDK button still to come)
--
-- WHY A NEW TABLE INSTEAD OF REUSING developers/advertisers
-- ----------------------------------------------------------
-- Affiliates have a different lifecycle (no campaign creation, no
-- inventory ownership, no payout-to-bank — they'll eventually get paid
-- on commission from advertisers). Keeping them separate now means
-- commission tracking, share-link generation, and per-affiliate
-- attribution can evolve without retrofitting the advertiser /
-- publisher data models.
--
-- AUTH model
-- ----------
-- We use Supabase auth.users for the actual credentials (one email, one
-- password, one JWT, same auth surface as everyone else). The affiliate
-- profile row in public.affiliates is keyed by that auth.users.id, the
-- same pattern as advertisers + developers. A user can therefore hold
-- accounts in all three roles using the same email — the `affiliates`
-- row is what makes them an affiliate.
-- ════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────
-- 1. AFFILIATES — profile row per affiliate user
-- ────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.affiliates (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS affiliates_email_idx
  ON public.affiliates (LOWER(email));

COMMENT ON TABLE public.affiliates IS
  'Affiliate profile row. Keyed by auth.users.id; one row per affiliate user. '
  'Other tables (affiliate_saved_ads, future commission tracking) reference '
  'affiliate_id → affiliates.id.';

-- ────────────────────────────────────────────────────────────────────────
-- 2. AFFILIATE_SAVED_ADS — what affiliates have bookmarked off the SDK
-- ────────────────────────────────────────────────────────────────────────
--
-- Populated when an affiliate clicks the (future) "save to affiliate"
-- button on an ad render. Every column except id, affiliate_id, saved_at
-- is nullable because the SDK may not always have full creative metadata
-- at click time — we capture what's available and never block the save.
--
-- Lifecycle hints:
--   campaign_id      — links to campaigns table; null if ad was a fallback
--   advertiser_id    — links to advertisers table; null if attribution missing
--   target_url       — the destination URL the ad would have opened
--   source_placement_id — opaque placement id from the publisher's SDK call
--   source_surface   — 'mcp' | 'web' | 'extension' | 'bot' | 'unknown'
--   status           — 'active' | 'shared' | 'archived' (future use)
--
-- Frozen-snapshot semantics: headline/body/image_url are stored on this
-- row at save time so the affiliate's saved list doesn't break if the
-- underlying campaign is paused or edited later.

CREATE TABLE IF NOT EXISTS public.affiliate_saved_ads (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id         UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  campaign_id          UUID,
  advertiser_id        UUID,
  headline             TEXT,
  body                 TEXT,
  image_url            TEXT,
  target_url           TEXT,
  source_placement_id  TEXT,
  source_surface       TEXT,
  saved_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes                TEXT,
  status               TEXT NOT NULL DEFAULT 'active'
);

ALTER TABLE public.affiliate_saved_ads
  DROP CONSTRAINT IF EXISTS affiliate_saved_ads_status_check;
ALTER TABLE public.affiliate_saved_ads
  ADD CONSTRAINT affiliate_saved_ads_status_check
  CHECK (status IN ('active', 'shared', 'archived'));

ALTER TABLE public.affiliate_saved_ads
  DROP CONSTRAINT IF EXISTS affiliate_saved_ads_surface_check;
ALTER TABLE public.affiliate_saved_ads
  ADD CONSTRAINT affiliate_saved_ads_surface_check
  CHECK (source_surface IS NULL OR source_surface IN (
    'mcp', 'web', 'extension', 'bot', 'mobile', 'unknown'
  ));

CREATE INDEX IF NOT EXISTS affiliate_saved_ads_affiliate_id_idx
  ON public.affiliate_saved_ads (affiliate_id, saved_at DESC);
CREATE INDEX IF NOT EXISTS affiliate_saved_ads_campaign_id_idx
  ON public.affiliate_saved_ads (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS affiliate_saved_ads_advertiser_id_idx
  ON public.affiliate_saved_ads (advertiser_id) WHERE advertiser_id IS NOT NULL;

COMMENT ON TABLE public.affiliate_saved_ads IS
  'Ad impressions an affiliate has bookmarked via the SDK save button. '
  'Headline/body/image_url are frozen at save time so the saved list survives '
  'edits/pauses on the underlying campaign. Commission tracking and share-link '
  'generation will add follow-up columns in future migrations.';

-- ────────────────────────────────────────────────────────────────────────
-- 3. RLS — affiliates can only see their own data
-- ────────────────────────────────────────────────────────────────────────
--
-- Our backend uses the SUPABASE_SERVICE_ROLE_KEY for all writes (which
-- bypasses RLS), so these policies are belt-and-suspenders against accidental
-- direct-from-client access via the anon key. The dashboard fetches data
-- through /api/auth?action=affiliate_list_saved — server-mediated — so RLS
-- is the safety net not the gate.

ALTER TABLE public.affiliates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_saved_ads  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliates_read_own"      ON public.affiliates;
DROP POLICY IF EXISTS "affiliates_update_own"    ON public.affiliates;
DROP POLICY IF EXISTS "saved_ads_read_own"       ON public.affiliate_saved_ads;
DROP POLICY IF EXISTS "saved_ads_modify_own"     ON public.affiliate_saved_ads;

CREATE POLICY "affiliates_read_own"
  ON public.affiliates
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "affiliates_update_own"
  ON public.affiliates
  FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "saved_ads_read_own"
  ON public.affiliate_saved_ads
  FOR SELECT
  USING (auth.uid() = affiliate_id);

CREATE POLICY "saved_ads_modify_own"
  ON public.affiliate_saved_ads
  FOR ALL
  USING (auth.uid() = affiliate_id);

-- ────────────────────────────────────────────────────────────────────────
-- 4. updated_at trigger on affiliates
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.tg_affiliates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS affiliates_updated_at_trg ON public.affiliates;
CREATE TRIGGER affiliates_updated_at_trg
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_affiliates_updated_at();

-- ════════════════════════════════════════════════════════════════════════
-- DONE.
-- ════════════════════════════════════════════════════════════════════════
--
-- Verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name IN ('affiliates', 'affiliate_saved_ads');
--
--   SELECT pol.polname, c.relname
--   FROM pg_policy pol JOIN pg_class c ON pol.polrelid = c.oid
--   WHERE c.relname IN ('affiliates', 'affiliate_saved_ads');
