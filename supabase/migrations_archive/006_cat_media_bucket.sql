-- Storage bucket for cat photos and videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('cat_media', 'cat_media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Authenticated users can upload cat media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'cat_media'
    AND auth.role() = 'authenticated'
  );

-- Allow public to view
CREATE POLICY "Anyone can view cat media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cat_media');

-- Allow owners to update/delete
CREATE POLICY "Owners can update cat media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'cat_media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Owners can delete cat media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'cat_media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
