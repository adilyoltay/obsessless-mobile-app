-- Migration: Create audio-temp storage bucket for temporary voice recordings
-- Date: 2025-08-24
-- Purpose: Support large audio file processing via Supabase Storage

-- Create the audio-temp bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-temp',
  'audio-temp', 
  false, -- Private bucket
  10485760, -- 10MB limit per file
  ARRAY['audio/wav', 'audio/mpeg', 'audio/webm', 'audio/mp4']
) ON CONFLICT (id) DO NOTHING;

-- Create RLS policy for authenticated users
CREATE POLICY IF NOT EXISTS "Audio temp bucket access for auth users" ON storage.objects
FOR ALL USING (
  bucket_id = 'audio-temp' 
  AND auth.uid() IS NOT NULL
  AND (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
);

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE storage.buckets IS 'Storage buckets including audio-temp for voice processing';