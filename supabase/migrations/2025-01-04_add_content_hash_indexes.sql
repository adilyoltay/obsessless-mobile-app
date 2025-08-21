-- Migration: Add content_hash and indexes for idempotency
-- Date: 2025-01-04
-- Purpose: Prevent duplicate entries and optimize queries for CoreAnalysisService v1

-- 1. Add content_hash column to voice_checkins (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_checkins') THEN
    ALTER TABLE voice_checkins 
    ADD COLUMN IF NOT EXISTS content_hash TEXT;
    
    -- Check if constraint doesn't exist before adding
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'voice_checkins_user_content_unique') THEN
      ALTER TABLE voice_checkins
      ADD CONSTRAINT voice_checkins_user_content_unique 
      UNIQUE (user_id, content_hash);
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_voice_checkins_hash 
    ON voice_checkins (content_hash);
    
    -- Index for user and created_at (will be used for date range queries)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_checkins' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_voice_checkins_user_created 
      ON voice_checkins (user_id, created_at);
    END IF;
  END IF;
END $$;

-- 2. Add content_hash column to thought_records (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'thought_records') THEN
    ALTER TABLE thought_records 
    ADD COLUMN IF NOT EXISTS content_hash TEXT;
    
    -- Check if constraint doesn't exist before adding
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'thought_records_user_content_unique') THEN
      ALTER TABLE thought_records
      ADD CONSTRAINT thought_records_user_content_unique 
      UNIQUE (user_id, content_hash);
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_thought_records_hash 
    ON thought_records (content_hash);
    
    -- Index for user and created_at (will be used for date range queries)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_thought_records_user_created 
      ON thought_records (user_id, created_at);
    END IF;
  END IF;
END $$;

-- 3. Add content_hash column to erp_sessions (if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'erp_sessions') THEN
    -- Add created_at column if it doesn't exist
    ALTER TABLE erp_sessions 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Add updated_at column if it doesn't exist
    ALTER TABLE erp_sessions 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Add content_hash column
    ALTER TABLE erp_sessions 
    ADD COLUMN IF NOT EXISTS content_hash TEXT;
    
    -- Check if constraint doesn't exist before adding
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'erp_sessions_user_content_unique') THEN
      ALTER TABLE erp_sessions
      ADD CONSTRAINT erp_sessions_user_content_unique 
      UNIQUE (user_id, content_hash);
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_erp_sessions_hash 
    ON erp_sessions (content_hash);
    
    -- Index for user and created_at (will be used for date range queries)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'erp_sessions' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_erp_sessions_user_created 
      ON erp_sessions (user_id, created_at);
    END IF;
  END IF;
END $$;

-- 4. Add content_hash column to mood_entries (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mood_entries') THEN
    -- Add created_at column if it doesn't exist
    ALTER TABLE mood_entries 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Add updated_at column if it doesn't exist
    ALTER TABLE mood_entries 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Add content_hash column
    ALTER TABLE mood_entries 
    ADD COLUMN IF NOT EXISTS content_hash TEXT;
    
    -- Check if constraint doesn't exist before adding
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'mood_entries_user_content_unique') THEN
      ALTER TABLE mood_entries
      ADD CONSTRAINT mood_entries_user_content_unique 
      UNIQUE (user_id, content_hash);
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_mood_entries_hash 
    ON mood_entries (content_hash);
    
    -- Index for user and created_at (will be used for date range queries)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mood_entries' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_mood_entries_user_created 
      ON mood_entries (user_id, created_at);
    END IF;
  END IF;
END $$;

-- 5. Add content_hash column to compulsion_records (if exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compulsion_records') THEN
    -- Add created_at column if it doesn't exist
    ALTER TABLE compulsion_records 
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Add updated_at column if it doesn't exist
    ALTER TABLE compulsion_records 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    
    -- Add content_hash column
    ALTER TABLE compulsion_records 
    ADD COLUMN IF NOT EXISTS content_hash TEXT;
    
    -- Check if constraint doesn't exist before adding
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compulsion_records_user_content_unique') THEN
      ALTER TABLE compulsion_records
      ADD CONSTRAINT compulsion_records_user_content_unique 
      UNIQUE (user_id, content_hash);
    END IF;
    
    CREATE INDEX IF NOT EXISTS idx_compulsion_records_hash 
    ON compulsion_records (content_hash);
    
    -- Index for user and created_at (will be used for date range queries)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compulsion_records' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_compulsion_records_user_created 
      ON compulsion_records (user_id, created_at);
    END IF;
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
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create trigger to calculate expires_at
CREATE OR REPLACE FUNCTION calculate_ai_cache_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at := NEW.computed_at + (NEW.ttl_hours * INTERVAL '1 hour');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to ai_cache table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'ai_cache_expires_at_trigger') THEN
    CREATE TRIGGER ai_cache_expires_at_trigger
    BEFORE INSERT OR UPDATE OF computed_at, ttl_hours ON ai_cache
    FOR EACH ROW
    EXECUTE FUNCTION calculate_ai_cache_expires_at();
  END IF;
END $$;

-- Create indexes for ai_cache
CREATE INDEX IF NOT EXISTS idx_ai_cache_user 
ON ai_cache (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_cache_key 
ON ai_cache (cache_key);

CREATE INDEX IF NOT EXISTS idx_ai_cache_expires 
ON ai_cache (expires_at);

-- Enable RLS on ai_cache
ALTER TABLE ai_cache ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_cache (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_cache' 
    AND policyname = 'Users can only access their own cache entries'
  ) THEN
    CREATE POLICY "Users can only access their own cache entries" 
    ON ai_cache FOR ALL 
    USING (auth.uid() = user_id);
  END IF;
END $$;

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

-- Ensure missing columns exist for legacy tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_telemetry') THEN
    -- Add session_id if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'ai_telemetry' AND column_name = 'session_id'
    ) THEN
      ALTER TABLE ai_telemetry ADD COLUMN session_id TEXT;
    END IF;
  END IF;
END $$;

-- Create indexes for ai_telemetry
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_telemetry' AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ai_telemetry_user 
    ON ai_telemetry (user_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_telemetry' AND column_name = 'event_type'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ai_telemetry_event 
    ON ai_telemetry (event_type);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_telemetry' AND column_name = 'session_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ai_telemetry_session 
    ON ai_telemetry (session_id);
  END IF;

  -- Support both legacy "timestamp" and newer "occurred_at"
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_telemetry' AND column_name = 'timestamp'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ai_telemetry_timestamp 
    ON ai_telemetry ("timestamp");
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_telemetry' AND column_name = 'occurred_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_ai_telemetry_occurred_at 
    ON ai_telemetry (occurred_at);
  END IF;
END $$;

-- Enable RLS on ai_telemetry
ALTER TABLE ai_telemetry ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_telemetry (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'ai_telemetry' 
    AND policyname = 'Users can only access their own telemetry'
  ) THEN
    CREATE POLICY "Users can only access their own telemetry" 
    ON ai_telemetry FOR ALL 
    USING (auth.uid() = user_id);
  END IF;
END $$;

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

-- Apply trigger to tables (only if they exist, have content_hash column, and trigger doesn't exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_checkins')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_checkins' AND column_name = 'content_hash')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'voice_checkins_content_hash_trigger') THEN
    CREATE TRIGGER voice_checkins_content_hash_trigger
    BEFORE INSERT OR UPDATE ON voice_checkins
    FOR EACH ROW
    EXECUTE FUNCTION auto_compute_content_hash();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'thought_records')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'content_hash')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'thought_records_content_hash_trigger') THEN
    CREATE TRIGGER thought_records_content_hash_trigger
    BEFORE INSERT OR UPDATE ON thought_records
    FOR EACH ROW
    EXECUTE FUNCTION auto_compute_content_hash();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'erp_sessions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'erp_sessions' AND column_name = 'content_hash')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'erp_sessions_content_hash_trigger') THEN
    CREATE TRIGGER erp_sessions_content_hash_trigger
    BEFORE INSERT OR UPDATE ON erp_sessions
    FOR EACH ROW
    EXECUTE FUNCTION auto_compute_content_hash();
  END IF;
END $$;

-- 10. Create idempotent upsert functions (only if table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_checkins') THEN
    CREATE OR REPLACE FUNCTION upsert_voice_checkin(
      p_user_id UUID,
      p_text TEXT,
      p_mood INTEGER,
      p_trigger TEXT,
      p_confidence REAL,
      p_lang TEXT
    )
    RETURNS voice_checkins AS $FUNC$
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
    $FUNC$ LANGUAGE plpgsql;
  END IF;
END $$;

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

-- 12. Create indexes for performance optimization (only if tables exist and have created_at column)
DO $$ 
BEGIN
  -- Index for finding recent entries by user
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_checkins') 
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_checkins' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_voice_checkins_user_recent 
    ON voice_checkins (user_id, created_at DESC);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'thought_records')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_thought_records_user_recent 
    ON thought_records (user_id, created_at DESC);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'erp_sessions')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'erp_sessions' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_erp_sessions_user_recent 
    ON erp_sessions (user_id, created_at DESC);
    
    -- Partial indexes for active/completed sessions
    CREATE INDEX IF NOT EXISTS idx_erp_sessions_active 
    ON erp_sessions (user_id, created_at DESC) 
    WHERE completed = false;
    
    CREATE INDEX IF NOT EXISTS idx_erp_sessions_completed 
    ON erp_sessions (user_id, created_at DESC) 
    WHERE completed = true;
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE ai_cache IS 'Cache table for CoreAnalysisService results with TTL support';
COMMENT ON TABLE ai_telemetry IS 'Telemetry events for AI interactions and performance monitoring';
COMMENT ON FUNCTION compute_content_hash IS 'Computes normalized SHA-256 hash for text content';

-- Comments for columns and functions (only if tables exist)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_checkins') THEN
    COMMENT ON COLUMN voice_checkins.content_hash IS 'SHA-256 hash of normalized text for deduplication';
  END IF;
  
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'upsert_voice_checkin') THEN
    COMMENT ON FUNCTION upsert_voice_checkin IS 'Idempotent upsert for voice checkins using content hash';
  END IF;
END $$;
