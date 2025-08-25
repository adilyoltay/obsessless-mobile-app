-- Migration: Add AI Cache Table
-- Date: 2025-08-24
-- Purpose: Fix ai_cache.cache_type column missing error

-- Create ai_cache table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.ai_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    cache_key TEXT NOT NULL,
    cache_type TEXT NOT NULL DEFAULT 'unified',
    cache_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, cache_key)
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ai_cache_user_key ON public.ai_cache(user_id, cache_key);
CREATE INDEX IF NOT EXISTS idx_ai_cache_type ON public.ai_cache(cache_type);
CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON public.ai_cache(expires_at);

-- Enable RLS (Row Level Security)
ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can access their own cache" ON public.ai_cache
    FOR ALL USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_cache_updated_at BEFORE UPDATE ON public.ai_cache
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.ai_cache IS 'AI analysis result cache for performance optimization';
COMMENT ON COLUMN public.ai_cache.cache_type IS 'Type of cache: unified, mood, cbt, ocd, etc';
COMMENT ON COLUMN public.ai_cache.cache_data IS 'Cached analysis result data';
COMMENT ON COLUMN public.ai_cache.expires_at IS 'Cache expiration timestamp';
