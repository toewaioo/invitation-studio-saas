-- Lower only the existing private photo bucket's per-object limit.
-- Privacy, RLS policies, and all stored objects remain unchanged.
DO $$
DECLARE
  bucket_is_public boolean;
BEGIN
  SELECT public
    INTO bucket_is_public
    FROM storage.buckets
   WHERE id = 'project-photos'
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Required project-photos bucket is missing';
  END IF;

  IF bucket_is_public IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'project-photos bucket must remain private';
  END IF;

  UPDATE storage.buckets
     SET file_size_limit = 4500000
   WHERE id = 'project-photos';
END;
$$;
