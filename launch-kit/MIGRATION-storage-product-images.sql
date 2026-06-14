-- ──────────────────────────────────────────────────────────────────────
-- Boost Boss — product-images storage bucket + RLS policies
-- ──────────────────────────────────────────────────────────────────────
-- Public-read bucket (so buyer pages render anonymously).
-- INSERT/UPDATE/DELETE restricted to authenticated users writing only to
-- their own advertiser-id folder. RLS uses Supabase's storage.foldername
-- helper to inspect the first path segment and compare against auth.uid().
--
-- Path convention: <advertiser_id>/<timestamp>-<random>.<ext>
-- Used by: product modal (image/video uploads), campaign creative dropzone.
-- ──────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Create / update the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,                  -- public read for buyer pages
  104857600,             -- 100 MB per file (videos)
  ARRAY[
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp',
    'image/svg+xml', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS policies (idempotent — drop then create)
DROP POLICY IF EXISTS "product_images_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "product_images_owner_insert"  ON storage.objects;
DROP POLICY IF EXISTS "product_images_owner_update"  ON storage.objects;
DROP POLICY IF EXISTS "product_images_owner_delete"  ON storage.objects;

CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'product-images');

CREATE POLICY "product_images_owner_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "product_images_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "product_images_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. New column on products — hero video (autoplay-muted-loop at top of buyer page)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hero_video_url text;

COMMENT ON COLUMN public.products.hero_video_url IS
  'Optional product video URL (mp4/webm). When set, buyer page renders '
  'this autoplay-muted-loop video BEFORE the hero_images carousel. '
  'Visual centerpiece of the product page when present.';

COMMIT;

-- ──────────────────────────────────────────────────────────────────────
-- Verify:
--   SELECT id, file_size_limit, array_length(allowed_mime_types, 1)
--   FROM storage.buckets WHERE id = 'product-images';
--
--   SELECT policyname FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects'
--     AND policyname LIKE 'product_images_%';
-- ──────────────────────────────────────────────────────────────────────
