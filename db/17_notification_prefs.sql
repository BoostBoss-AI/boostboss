-- ═══════════════════════════════════════════════════════════════════════
-- BOOST BOSS — NOTIFICATION PREFERENCES   (migration 17)
-- Apply with: paste into Supabase → SQL Editor.
--
-- Pass 2 of the settings rebuild. Notification preferences were stored in
-- the browser's localStorage (per-device only). This adds a server-side
-- store so a publisher's / advertiser's email preferences follow them
-- across devices. The column holds a small JSON object of boolean toggles
-- (e.g. {"payout_sent": true, "monthly_summary": false}); an empty object
-- means "all defaults" and is the safe initial state.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE developers  ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}'::jsonb;
ALTER TABLE advertisers ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{}'::jsonb;
