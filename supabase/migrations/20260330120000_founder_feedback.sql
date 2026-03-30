-- Founder feedback: in-app messages + attachment paths in private storage (admin reads via service role).

CREATE TABLE IF NOT EXISTS public.founder_feedback (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  attachment_paths TEXT[] NOT NULL DEFAULT '{}',
  user_email_snapshot TEXT,
  platform TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT founder_feedback_body_len CHECK (
    char_length(body) >= 1 AND char_length(body) <= 10000
  ),
  CONSTRAINT founder_feedback_attachments_max CHECK (cardinality(attachment_paths) <= 8)
);

CREATE INDEX IF NOT EXISTS idx_founder_feedback_created_at
  ON public.founder_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_founder_feedback_user_id
  ON public.founder_feedback (user_id);

COMMENT ON TABLE public.founder_feedback IS 'User feedback to founder; attachments in storage bucket feedback_attachments at paths listed in attachment_paths.';

ALTER TABLE public.founder_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own founder feedback" ON public.founder_feedback;
CREATE POLICY "Users insert own founder feedback"
  ON public.founder_feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

GRANT INSERT ON public.founder_feedback TO authenticated;

-- Private bucket: no public SELECT; service role / dashboard can read objects and table.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback_attachments',
  'feedback_attachments',
  false,
  52428800, -- 50 MB per object
  ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "feedback_attachments insert own prefix" ON storage.objects;
CREATE POLICY "feedback_attachments insert own prefix"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback_attachments'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

-- Optional: user can remove a mistakenly uploaded object under their prefix (same session / retries).
DROP POLICY IF EXISTS "feedback_attachments delete own prefix" ON storage.objects;
CREATE POLICY "feedback_attachments delete own prefix"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedback_attachments'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );
