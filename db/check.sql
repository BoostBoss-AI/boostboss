-- ───────────────────────────────────────────────────────────────────────
-- check.sql
-- Compare migration files recorded as applied (in bbx_schema_migrations)
-- against the canonical list of files in db/.
--
-- Run this in the Supabase SQL Editor whenever you suspect schema drift.
-- The list of files below must be kept in sync manually with the db/
-- directory. To update: ls db/*.sql, paste filenames into the array
-- below, save this file.
-- ───────────────────────────────────────────────────────────────────────

WITH on_disk(name) AS (
  SELECT unnest(ARRAY[
    '00_schema_migrations.sql',
    '03_rtb_ledger.sql',
    '04_bbx_mcp_extensions.sql',
    '05_bbx_conversions.sql',
    '06_freq_cap.sql',
    '06_integration_method.sql',
    '07_embedding_cache.sql',
    '07_sandbox.sql',
    '08_auction_logs.sql',
    '08_voyage_embeddings.sql',
    '09_target_integration_methods.sql',
    '10_events_campaign_id_text.sql'
  ])
)
SELECT
  d.name AS migration,
  CASE
    WHEN m.name IS NULL THEN 'MISSING — apply with SQL editor, then INSERT into bbx_schema_migrations'
    ELSE 'applied ' || to_char(m.applied_at, 'YYYY-MM-DD')
  END AS status,
  m.applied_by,
  m.notes
FROM on_disk d
LEFT JOIN bbx_schema_migrations m USING (name)
ORDER BY d.name;

-- Anything that's recorded as applied but NOT in the on_disk list
-- (i.e., files we may have deleted from the repo).
SELECT
  m.name AS migration,
  'STALE — recorded as applied but not in on_disk list above' AS status,
  m.applied_at, m.applied_by, m.notes
FROM bbx_schema_migrations m
WHERE NOT EXISTS (
  SELECT 1 FROM (
    SELECT unnest(ARRAY[
      '00_schema_migrations.sql',
      '03_rtb_ledger.sql',
      '04_bbx_mcp_extensions.sql',
      '05_bbx_conversions.sql',
      '06_freq_cap.sql',
      '06_integration_method.sql',
      '07_embedding_cache.sql',
      '07_sandbox.sql',
      '08_auction_logs.sql',
      '08_voyage_embeddings.sql',
      '09_target_integration_methods.sql',
      '10_events_campaign_id_text.sql'
    ]) AS name
  ) d
  WHERE d.name = m.name
);
