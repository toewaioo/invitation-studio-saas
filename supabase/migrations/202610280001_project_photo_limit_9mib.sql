-- Approval required before applying: raise only the private project-photos
-- bucket's per-object cap from 4 MiB to 9 MiB. No policies, table data,
-- bucket visibility, MIME restrictions, or application credentials change.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'project-photos'
      AND public = false
  ) THEN
    RAISE EXCEPTION 'Expected private project-photos bucket was not found';
  END IF;
END;
$$;

UPDATE storage.buckets
SET file_size_limit = 9437184
WHERE id = 'project-photos'
  AND public = false;
