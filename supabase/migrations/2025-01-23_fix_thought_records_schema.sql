-- ================================
-- FIX THOUGHT RECORDS SCHEMA CONFLICTS
-- ================================
-- Bu migration CBT thought records tablosundaki field name conflicts'ini çözer
-- Problem: Farklı migrations automatic_thought vs thought, new_view vs reframe kullanmış
-- Çözüm: Unified schema'ya normalize et

-- 1. Check current table structure and add missing columns
DO $$ 
BEGIN
  -- Add thought column if it doesn't exist (rename from automatic_thought if needed)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'automatic_thought')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'thought') THEN
    -- Rename automatic_thought to thought
    ALTER TABLE thought_records RENAME COLUMN automatic_thought TO thought;
    RAISE NOTICE 'Renamed automatic_thought to thought in thought_records table';
  END IF;
  
  -- Add reframe column if it doesn't exist (rename from new_view if needed)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'new_view')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'reframe') THEN
    -- Rename new_view to reframe
    ALTER TABLE thought_records RENAME COLUMN new_view TO reframe;
    RAISE NOTICE 'Renamed new_view to reframe in thought_records table';
  END IF;
  
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'thought') THEN
    ALTER TABLE thought_records ADD COLUMN thought TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added thought column to thought_records table';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'reframe') THEN
    ALTER TABLE thought_records ADD COLUMN reframe TEXT NOT NULL DEFAULT '';
    RAISE NOTICE 'Added reframe column to thought_records table';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'distortions') THEN
    ALTER TABLE thought_records ADD COLUMN distortions TEXT[] DEFAULT '{}';
    RAISE NOTICE 'Added distortions column to thought_records table';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'evidence_for') THEN
    ALTER TABLE thought_records ADD COLUMN evidence_for TEXT;
    RAISE NOTICE 'Added evidence_for column to thought_records table';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'evidence_against') THEN
    ALTER TABLE thought_records ADD COLUMN evidence_against TEXT;
    RAISE NOTICE 'Added evidence_against column to thought_records table';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'mood_before') THEN
    ALTER TABLE thought_records ADD COLUMN mood_before INTEGER NOT NULL DEFAULT 5 CHECK (mood_before >= 1 AND mood_before <= 10);
    RAISE NOTICE 'Added mood_before column to thought_records table';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'mood_after') THEN
    ALTER TABLE thought_records ADD COLUMN mood_after INTEGER NOT NULL DEFAULT 5 CHECK (mood_after >= 1 AND mood_after <= 10);
    RAISE NOTICE 'Added mood_after column to thought_records table';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'trigger') THEN
    ALTER TABLE thought_records ADD COLUMN trigger TEXT;
    RAISE NOTICE 'Added trigger column to thought_records table';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'notes') THEN
    ALTER TABLE thought_records ADD COLUMN notes TEXT;
    RAISE NOTICE 'Added notes column to thought_records table';
  END IF;
  
  -- Remove legacy columns after data migration is complete (optional)
  -- IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'lang') THEN
  --   ALTER TABLE thought_records DROP COLUMN lang;
  --   RAISE NOTICE 'Removed legacy lang column from thought_records table';
  -- END IF;
  
END $$;

-- 2. Update NOT NULL constraints to be more flexible
DO $$
BEGIN
  -- Make thought column NOT NULL if it has data
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'thought') THEN
    -- First update empty thoughts with placeholder
    UPDATE thought_records SET thought = 'İsimsiz düşünce' WHERE thought IS NULL OR thought = '';
    
    -- Then make it NOT NULL
    ALTER TABLE thought_records ALTER COLUMN thought SET NOT NULL;
    RAISE NOTICE 'Made thought column NOT NULL in thought_records table';
  END IF;
  
  -- Make reframe column NOT NULL if it has data
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'reframe') THEN
    -- First update empty reframes with placeholder
    UPDATE thought_records SET reframe = 'Henüz yeniden çerçevelenmemiş' WHERE reframe IS NULL OR reframe = '';
    
    -- Then make it NOT NULL
    ALTER TABLE thought_records ALTER COLUMN reframe SET NOT NULL;
    RAISE NOTICE 'Made reframe column NOT NULL in thought_records table';
  END IF;
END $$;

-- 3. Ensure correct indexes exist
CREATE INDEX IF NOT EXISTS idx_thought_records_user_id ON thought_records(user_id);
CREATE INDEX IF NOT EXISTS idx_thought_records_created_at ON thought_records(created_at);
CREATE INDEX IF NOT EXISTS idx_thought_records_mood_improvement ON thought_records((mood_after - mood_before));

-- 4. Fix trigger function to handle the correct schema
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

-- 5. Ensure RLS policies exist and are correct
ALTER TABLE thought_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to recreate with correct names)
DROP POLICY IF EXISTS "Users can manage own thought records" ON thought_records;
DROP POLICY IF EXISTS "Users can view own thought records" ON thought_records;
DROP POLICY IF EXISTS "Users can insert own thought records" ON thought_records;
DROP POLICY IF EXISTS "Users can update own thought records" ON thought_records;
DROP POLICY IF EXISTS "Users can delete own thought records" ON thought_records;

-- Create comprehensive RLS policies
CREATE POLICY "Users can view own thought records" ON thought_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own thought records" ON thought_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own thought records" ON thought_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own thought records" ON thought_records
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Add updated_at trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_thought_records_updated_at ON thought_records;
CREATE TRIGGER update_thought_records_updated_at
  BEFORE UPDATE ON thought_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. Verification and summary
DO $$ 
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'THOUGHT RECORDS SCHEMA FIX COMPLETED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Expected columns: user_id, thought, reframe, distortions, evidence_for, evidence_against, mood_before, mood_after, trigger, notes, created_at, updated_at, content_hash';
  RAISE NOTICE 'Triggers: auto_compute_content_hash (content_hash), update_updated_at_column (updated_at)';
  RAISE NOTICE 'RLS: Enabled with user-specific policies';
  RAISE NOTICE '========================================';
END $$;
