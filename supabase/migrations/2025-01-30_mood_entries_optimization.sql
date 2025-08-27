-- ========================================================================
-- Mood Entries Optimization Migration
-- Date: 2025-01-30
-- Purpose: 
--   1. Add content_hash uniqueness constraint
--   2. Create mood_tracking as view (not table)
--   3. Add device_id for better duplicate prevention
--   4. Improve indexes for performance
-- ========================================================================

-- Step 1: Add device_id column if not exists
ALTER TABLE mood_entries 
ADD COLUMN IF NOT EXISTS device_id TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Step 2: Create or update content hash function
CREATE OR REPLACE FUNCTION compute_mood_content_hash(
  p_user_id UUID,
  p_mood_score INTEGER,
  p_energy_level INTEGER,
  p_anxiety_level INTEGER,
  p_notes TEXT,
  p_created_at TIMESTAMP
) RETURNS TEXT AS $$
DECLARE
  v_day_key TEXT;
  v_content TEXT;
BEGIN
  -- Use UTC date as part of key (day granularity)
  v_day_key := DATE(p_created_at AT TIME ZONE 'UTC')::TEXT;
  
  -- Create content string (excluding triggers/activities for now)
  v_content := COALESCE(p_user_id::TEXT, '') || '|' ||
               v_day_key || '|' ||
               COALESCE(p_mood_score::TEXT, '0') || '|' ||
               COALESCE(p_energy_level::TEXT, '0') || '|' ||
               COALESCE(p_anxiety_level::TEXT, '0') || '|' ||
               COALESCE(LEFT(p_notes, 100), ''); -- First 100 chars of notes
  
  -- Return MD5 hash
  RETURN MD5(v_content);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 3: Update existing rows to have content_hash if missing
UPDATE mood_entries
SET content_hash = compute_mood_content_hash(
  user_id,
  mood_score,
  energy_level,
  anxiety_level,
  notes,
  created_at
)
WHERE content_hash IS NULL;

-- Step 4: Create unique constraint on (user_id, content_hash) if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'mood_entries_user_content_unique'
  ) THEN
    ALTER TABLE mood_entries 
    ADD CONSTRAINT mood_entries_user_content_unique 
    UNIQUE (user_id, content_hash);
  END IF;
END $$;

-- Step 5: Create trigger to auto-set content_hash on insert
CREATE OR REPLACE FUNCTION set_mood_content_hash()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content_hash IS NULL THEN
    NEW.content_hash := compute_mood_content_hash(
      NEW.user_id,
      NEW.mood_score,
      NEW.energy_level,
      NEW.anxiety_level,
      NEW.notes,
      NEW.created_at
    );
  END IF;
  
  -- Also update updated_at
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS mood_entries_content_hash_trigger ON mood_entries;

-- Create new trigger
CREATE TRIGGER mood_entries_content_hash_trigger
BEFORE INSERT OR UPDATE ON mood_entries
FOR EACH ROW
EXECUTE FUNCTION set_mood_content_hash();

-- Step 6: Drop mood_tracking table if it exists (will replace with view)
DROP TABLE IF EXISTS mood_tracking CASCADE;

-- Step 7: Create mood_tracking as a VIEW for backward compatibility
CREATE OR REPLACE VIEW mood_tracking AS
SELECT 
  id,
  user_id,
  mood_score AS mood,
  energy_level AS energy,
  anxiety_level AS anxiety,
  notes,
  COALESCE(triggers[1], '') AS trigger, -- Legacy single trigger field
  triggers, -- Array field
  activities,
  created_at AS timestamp,
  created_at,
  updated_at,
  content_hash
FROM mood_entries;

-- Step 8: Grant appropriate permissions on the view
GRANT SELECT ON mood_tracking TO authenticated;
GRANT SELECT ON mood_tracking TO anon;

-- IMPORTANT: No INSERT/UPDATE/DELETE on view to prevent writes
-- All writes should go through mood_entries table

-- Step 9: Optimize indexes
-- Drop redundant indexes if they exist
DROP INDEX IF EXISTS idx_mood_entries_created_at;
DROP INDEX IF EXISTS idx_mood_entries_user_id;

-- Create optimized composite indexes
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_created 
ON mood_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mood_entries_user_hash 
ON mood_entries(user_id, content_hash);

CREATE INDEX IF NOT EXISTS idx_mood_entries_device 
ON mood_entries(device_id) WHERE device_id IS NOT NULL;

-- Performance index for analytics queries
CREATE INDEX IF NOT EXISTS idx_mood_entries_analytics 
ON mood_entries(user_id, created_at DESC) 
INCLUDE (mood_score, energy_level, anxiety_level);

-- Step 10: Add comments for documentation
COMMENT ON TABLE mood_entries IS 'Primary table for mood tracking data. All writes go here.';
COMMENT ON VIEW mood_tracking IS 'Legacy compatibility view. READ-ONLY. Do not write to this view.';
COMMENT ON COLUMN mood_entries.content_hash IS 'MD5 hash of core mood data for duplicate prevention';
COMMENT ON COLUMN mood_entries.device_id IS 'Optional device identifier for multi-device duplicate prevention';

-- Step 11: Data cleanup - remove old duplicates (keep newest)
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, 
                   DATE(created_at AT TIME ZONE 'UTC'),
                   mood_score,
                   energy_level,
                   anxiety_level
      ORDER BY created_at DESC
    ) AS rn
  FROM mood_entries
  WHERE content_hash IS NOT NULL
)
DELETE FROM mood_entries
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Step 12: Update RLS policies for mood_entries if needed
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;

-- Ensure users can only access their own data
DROP POLICY IF EXISTS "Users can manage own mood entries" ON mood_entries;
CREATE POLICY "Users can manage own mood entries" ON mood_entries
FOR ALL USING (auth.uid() = user_id);

-- Step 13: Create function to check for duplicates before insert (optional helper)
CREATE OR REPLACE FUNCTION check_mood_duplicate(
  p_user_id UUID,
  p_mood_score INTEGER,
  p_energy_level INTEGER,
  p_anxiety_level INTEGER,
  p_notes TEXT,
  p_created_at TIMESTAMP
) RETURNS BOOLEAN AS $$
DECLARE
  v_hash TEXT;
  v_exists BOOLEAN;
BEGIN
  v_hash := compute_mood_content_hash(
    p_user_id,
    p_mood_score,
    p_energy_level,
    p_anxiety_level,
    p_notes,
    p_created_at
  );
  
  SELECT EXISTS(
    SELECT 1 FROM mood_entries 
    WHERE user_id = p_user_id 
    AND content_hash = v_hash
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$ LANGUAGE plpgsql;

-- Step 14: Add telemetry tracking for duplicates prevented (optional)
CREATE TABLE IF NOT EXISTS mood_duplicate_prevention_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content_hash TEXT NOT NULL,
  prevented_at TIMESTAMP DEFAULT NOW(),
  device_id TEXT
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_duplicate_log_cleanup 
ON mood_duplicate_prevention_log(prevented_at);

-- Auto-cleanup old logs after 30 days
CREATE OR REPLACE FUNCTION cleanup_old_duplicate_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM mood_duplicate_prevention_log
  WHERE prevented_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Mood entries optimization completed successfully!';
  RAISE NOTICE '- Content hash uniqueness enforced';
  RAISE NOTICE '- mood_tracking is now a READ-ONLY view';
  RAISE NOTICE '- Duplicates cleaned up';
  RAISE NOTICE '- Performance indexes optimized';
END $$;
