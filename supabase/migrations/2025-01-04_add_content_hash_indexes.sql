-- Migration: Add content_hash and indexes for idempotency
-- Date: 2025-01-04
-- Purpose: Prevent duplicate entries and optimize queries for CoreAnalysisService v1

-- 1. Add content_hash column to voice_checkins
ALTER TABLE voice_checkins 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add unique constraint on (user_id, content_hash)
ALTER TABLE voice_checkins
ADD CONSTRAINT voice_checkins_user_content_unique 
UNIQUE (user_id, content_hash);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_voice_checkins_hash 
ON voice_checkins (content_hash);

-- Create compound index for user + day queries
CREATE INDEX IF NOT EXISTS idx_voice_checkins_user_day 
ON voice_checkins (user_id, DATE(created_at));

-- 2. Add content_hash column to thought_records
ALTER TABLE thought_records 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add unique constraint on (user_id, content_hash)
ALTER TABLE thought_records
ADD CONSTRAINT thought_records_user_content_unique 
UNIQUE (user_id, content_hash);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_thought_records_hash 
ON thought_records (content_hash);

-- Create compound index for user + day queries
CREATE INDEX IF NOT EXISTS idx_thought_records_user_day 
ON thought_records (user_id, DATE(created_at));

-- 3. Add content_hash column to erp_sessions
ALTER TABLE erp_sessions 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Add unique constraint on (user_id, content_hash)
ALTER TABLE erp_sessions
ADD CONSTRAINT erp_sessions_user_content_unique 
UNIQUE (user_id, content_hash);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_erp_sessions_hash 
ON erp_sessions (content_hash);

-- Create compound index for user + day queries
CREATE INDEX IF NOT EXISTS idx_erp_sessions_user_day 
ON erp_sessions (user_id, DATE(created_at));

-- 4. Add content_hash column to mood_entries (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mood_entries') THEN
    ALTER TABLE mood_entries 
    ADD COLUMN IF NOT EXISTS content_hash TEXT;
    
    ALTER TABLE mood_entries
    ADD CONSTRAINT mood_entries_user_content_unique 
    UNIQUE (user_id, content_hash);
    
    CREATE INDEX IF NOT EXISTS idx_mood_entries_hash 
    ON mood_entries (content_hash);
    
    CREATE INDEX IF NOT EXISTS idx_mood_entries_user_day 
    ON mood_entries (user_id, DATE(created_at));
  END IF;
END $$;

-- 5. Add content_hash column to compulsion_records (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compulsion_records') THEN
    ALTER TABLE compulsion_records 
    ADD COLUMN IF NOT EXISTS content_hash TEXT;
    
    ALTER TABLE compulsion_records
    ADD CONSTRAINT compulsion_records_user_content_unique 
    UNIQUE (user_id, content_hash);
    
    CREATE INDEX IF NOT EXISTS idx_compulsion_records_hash 
    ON compulsion_records (content_hash);
    
    CREATE INDEX IF NOT EXISTS idx_compulsion_records_user_day 
    ON compulsion_records (user_id, DATE(created_at));
  END IF;
END $$;

-- 6. Create AI cache table for CoreAnalysisService
CREATE TABLE IF NOT EXISTS ai_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ttl_hours INTEGER NOT NULL DEFAULT 24,
  expires_at TIMESTAMPTZ GENERATED ALWAYS AS (computed_at + (ttl_hours || ' hours')::INTERVAL) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for ai_cache
CREATE INDEX IF NOT EXISTS idx_ai_cache_user 
ON ai_cache (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key 
ON ai_cache (cache_key);

CREATE INDEX IF NOT EXISTS idx_ai_cache_expires 
ON ai_cache (expires_at);

-- Enable RLS on ai_cache
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_cache
CREATE POLICY "Users can only access their own cache entries" 
ON ai_cache FOR ALL 
USING (auth.uid() = user_id);

-- 7. Create AI telemetry table
CREATE TABLE IF NOT EXISTS ai_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  session_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for ai_telemetry
CREATE INDEX IF NOT EXISTS idx_ai_telemetry_user 
ON ai_telemetry (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_telemetry_event 
ON ai_telemetry (event_type);

CREATE INDEX IF NOT EXISTS idx_ai_telemetry_session 
ON ai_telemetry (session_id);

CREATE INDEX IF NOT EXISTS idx_ai_telemetry_timestamp 
ON ai_telemetry (timestamp);

-- Enable RLS on ai_telemetry
ALTER TABLE ai_telemetry ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_telemetry
CREATE POLICY "Users can only access their own telemetry" 
ON ai_telemetry FOR ALL 
USING (auth.uid() = user_id);

-- 8. Create function to compute content hash
CREATE OR REPLACE FUNCTION compute_content_hash(text_content TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Normalize text: trim, collapse spaces, lowercase
  -- Then compute SHA-256 hash
  RETURN encode(
    digest(
      lower(regexp_replace(trim(text_content), '\s+', ' ', 'g')),
      'sha256'
    ),
    'hex'
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 9. Create trigger to auto-compute content_hash on insert/update
CREATE OR REPLACE FUNCTION auto_compute_content_hash()
RETURNS TRIGGER AS $$
BEGIN
  -- Compute hash based on text field if content_hash is not provided
  IF NEW.content_hash IS NULL THEN
    IF TG_TABLE_NAME = 'voice_checkins' AND NEW.text IS NOT NULL THEN
      NEW.content_hash := compute_content_hash(NEW.text);
    ELSIF TG_TABLE_NAME = 'thought_records' AND NEW.thought IS NOT NULL THEN
      NEW.content_hash := compute_content_hash(NEW.thought);
    ELSIF TG_TABLE_NAME = 'erp_sessions' AND NEW.notes IS NOT NULL THEN
      NEW.content_hash := compute_content_hash(NEW.notes);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
CREATE TRIGGER voice_checkins_content_hash_trigger
BEFORE INSERT OR UPDATE ON voice_checkins
FOR EACH ROW
EXECUTE FUNCTION auto_compute_content_hash();

CREATE TRIGGER thought_records_content_hash_trigger
BEFORE INSERT OR UPDATE ON thought_records
FOR EACH ROW
EXECUTE FUNCTION auto_compute_content_hash();

CREATE TRIGGER erp_sessions_content_hash_trigger
BEFORE INSERT OR UPDATE ON erp_sessions
FOR EACH ROW
EXECUTE FUNCTION auto_compute_content_hash();

-- 10. Create idempotent upsert functions
CREATE OR REPLACE FUNCTION upsert_voice_checkin(
  p_user_id UUID,
  p_text TEXT,
  p_mood INTEGER,
  p_trigger TEXT,
  p_confidence REAL,
  p_lang TEXT
)
RETURNS voice_checkins AS $$
DECLARE
  v_content_hash TEXT;
  v_result voice_checkins;
BEGIN
  -- Compute content hash
  v_content_hash := compute_content_hash(p_text);
  
  -- Try to insert or get existing
  INSERT INTO voice_checkins (
    user_id, text, mood, trigger, confidence, lang, content_hash
  ) VALUES (
    p_user_id, p_text, p_mood, p_trigger, p_confidence, p_lang, v_content_hash
  )
  ON CONFLICT (user_id, content_hash) 
  DO UPDATE SET
    updated_at = NOW(),
    confidence = GREATEST(voice_checkins.confidence, EXCLUDED.confidence)
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Add similar functions for other tables as needed

-- 11. Create cleanup function for expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ai_cache
  WHERE expires_at < NOW()
  RETURNING COUNT(*) INTO deleted_count;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 12. Create indexes for performance optimization
-- Index for finding recent entries by user
CREATE INDEX IF NOT EXISTS idx_voice_checkins_user_recent 
ON voice_checkins (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_thought_records_user_recent 
ON thought_records (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_erp_sessions_user_recent 
ON erp_sessions (user_id, created_at DESC);

-- Partial indexes for active/completed sessions
CREATE INDEX IF NOT EXISTS idx_erp_sessions_active 
ON erp_sessions (user_id, created_at DESC) 
WHERE completed = false;

CREATE INDEX IF NOT EXISTS idx_erp_sessions_completed 
ON erp_sessions (user_id, created_at DESC) 
WHERE completed = true;

-- Comments for documentation
COMMENT ON TABLE ai_cache IS 'Cache table for CoreAnalysisService results with TTL support';
COMMENT ON TABLE ai_telemetry IS 'Telemetry events for AI interactions and performance monitoring';
COMMENT ON COLUMN voice_checkins.content_hash IS 'SHA-256 hash of normalized text for deduplication';
COMMENT ON FUNCTION compute_content_hash IS 'Computes normalized SHA-256 hash for text content';
COMMENT ON FUNCTION upsert_voice_checkin IS 'Idempotent upsert for voice checkins using content hash';
