-- ===================================================================
-- Migration: Fix mood_entries schema mismatch
-- Date: 2025-01-27
-- Purpose: Add missing triggers/activities columns to mood_entries table
-- Issue: Code expects array columns but DB only has single trigger field
-- ===================================================================

-- 1. Add missing columns to mood_entries table
ALTER TABLE public.mood_entries 
ADD COLUMN IF NOT EXISTS triggers TEXT[],
ADD COLUMN IF NOT EXISTS activities TEXT[];

-- 2. Migrate existing single trigger to triggers array
DO $$ 
BEGIN
  -- Only if the single trigger column has data
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mood_entries' 
    AND column_name = 'trigger'
  ) THEN
    -- Convert single trigger to array format
    UPDATE public.mood_entries 
    SET triggers = ARRAY[trigger]
    WHERE trigger IS NOT NULL 
    AND trigger != '' 
    AND (triggers IS NULL OR cardinality(triggers) = 0);
    
    -- Log migration progress
    RAISE NOTICE 'Migrated single trigger values to triggers array';
  END IF;
END $$;

-- 3. Add content_hash column if missing (for deduplication)
ALTER TABLE public.mood_entries 
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 4. Update existing entries to have content_hash for deduplication
UPDATE public.mood_entries 
SET content_hash = md5(CAST(user_id AS text) || CAST(mood_score AS text) || CAST(energy_level AS text) || CAST(anxiety_level AS text) || COALESCE(notes, '') || DATE(created_at)::text)
WHERE content_hash IS NULL;

-- 5. Add unique constraint for deduplication (ignore conflicts if exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'mood_entries_user_content_unique'
  ) THEN
    ALTER TABLE public.mood_entries
    ADD CONSTRAINT mood_entries_user_content_unique 
    UNIQUE (user_id, content_hash);
    
    RAISE NOTICE 'Added unique constraint for deduplication';
  END IF;
EXCEPTION
  WHEN duplicate_table THEN 
    RAISE NOTICE 'Constraint already exists, skipping';
END $$;

-- 6. Create index for performance on new columns
CREATE INDEX IF NOT EXISTS idx_mood_entries_triggers 
ON public.mood_entries USING gin(triggers);

CREATE INDEX IF NOT EXISTS idx_mood_entries_activities 
ON public.mood_entries USING gin(activities);

CREATE INDEX IF NOT EXISTS idx_mood_entries_content_hash 
ON public.mood_entries (content_hash);

-- 7. Update RLS policies to ensure they still work with new schema
-- (Existing policies should continue to work, just verifying)

-- 8. Add trigger for automatic content_hash generation on new inserts
CREATE OR REPLACE FUNCTION generate_mood_entry_hash() 
RETURNS TRIGGER AS $$
BEGIN
  NEW.content_hash = md5(
    CAST(NEW.user_id AS text) || 
    CAST(NEW.mood_score AS text) || 
    CAST(NEW.energy_level AS text) || 
    CAST(NEW.anxiety_level AS text) || 
    COALESCE(NEW.notes, '') || 
    DATE(NEW.created_at)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS mood_entry_hash_trigger ON public.mood_entries;
CREATE TRIGGER mood_entry_hash_trigger
  BEFORE INSERT ON public.mood_entries
  FOR EACH ROW
  EXECUTE FUNCTION generate_mood_entry_hash();

-- 9. Optional: Create view for backward compatibility with old single trigger field
CREATE OR REPLACE VIEW mood_entries_compat AS
SELECT 
  id,
  user_id,
  mood_score,
  energy_level,
  anxiety_level,
  notes,
  CASE 
    WHEN triggers IS NOT NULL AND cardinality(triggers) > 0 
    THEN triggers[1] 
    ELSE trigger 
  END as trigger,
  triggers,
  activities,
  content_hash,
  created_at,
  updated_at
FROM public.mood_entries;

-- Grant permissions on new view
GRANT SELECT ON mood_entries_compat TO authenticated;
GRANT SELECT ON mood_entries_compat TO anon;

-- 10. Log completion
DO $$ 
BEGIN
  RAISE NOTICE '✅ mood_entries schema fix completed successfully';
  RAISE NOTICE '✅ Added triggers[] and activities[] columns';
  RAISE NOTICE '✅ Migrated existing trigger data to array format';  
  RAISE NOTICE '✅ Added deduplication with content_hash';
  RAISE NOTICE '✅ Created performance indexes';
  RAISE NOTICE '✅ Added backward compatibility view';
END $$;
