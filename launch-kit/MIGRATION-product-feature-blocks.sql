-- ──────────────────────────────────────────────────────────────────────
-- Boost Boss — Feature blocks (zigzag content) + hero image carousel
-- ──────────────────────────────────────────────────────────────────────
--
-- After 2026-06-13 review of seller UX vs. AppSumo/Castmagic, two
-- structural fields were missing:
--
--   feature_blocks  — the alternating image-left/image-right blocks
--                     that fill most of the buyer page. Each block:
--                     { heading, bullets[], image_url }
--   hero_images     — multiple hero images shown as a clickable
--                     thumbnail carousel (single image_url stays as
--                     the "primary" / fallback)
--
-- Existing `image_url` is preserved — code that doesn't know about
-- hero_images keeps rendering. New code reads (hero_images.length ?
-- hero_images : [image_url]) to get the full carousel list.
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS feature_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hero_images    jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.products.feature_blocks IS
  'Zigzag content blocks for the buyer-facing page. Array of '
  '{heading: text, bullets: [text], image_url: text}. AppSumo-style 4-block '
  'alternating layout. Empty array = no feature-block section rendered.';

COMMENT ON COLUMN public.products.hero_images IS
  'Hero image carousel — list of image URLs shown as clickable thumbnails. '
  'image_url stays the primary/fallback. Empty array = single image_url only.';

COMMIT;

-- Smoke check:
--   SELECT id, name, jsonb_array_length(feature_blocks) AS blocks,
--                    jsonb_array_length(hero_images)   AS images
--   FROM products ORDER BY created_at DESC LIMIT 5;
