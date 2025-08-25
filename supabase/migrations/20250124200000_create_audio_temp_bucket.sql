-- Create audio-temp storage bucket for voice recordings
-- This migration creates the storage bucket and policies for audio file handling

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-temp', 
  'audio-temp', 
  false, 
  10485760, -- 10MB limit
  ARRAY['audio/wav', 'audio/webm', 'audio/mp4', 'audio/mpeg']
) ON CONFLICT (id) DO NOTHING;

-- Create storage policies

-- Allow authenticated users to upload audio files
CREATE POLICY IF NOT EXISTS "authenticated_upload_audio" ON storage.objects 
FOR INSERT TO authenticated 
WITH CHECK (
  bucket_id = 'audio-temp'
);

-- Allow authenticated users to read their own files
CREATE POLICY IF NOT EXISTS "authenticated_read_own_audio" ON storage.objects 
FOR SELECT TO authenticated 
USING (
  bucket_id = 'audio-temp' AND 
  auth.uid()::text = owner
);

-- Allow service role full access for Edge Functions
CREATE POLICY IF NOT EXISTS "service_role_full_audio_access" ON storage.objects 
FOR ALL TO service_role 
USING (bucket_id = 'audio-temp');

-- Allow authenticated users to delete their own files (for cleanup)
CREATE POLICY IF NOT EXISTS "authenticated_delete_own_audio" ON storage.objects 
FOR DELETE TO authenticated 
USING (
  bucket_id = 'audio-temp' AND 
  auth.uid()::text = owner
);
