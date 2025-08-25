-- ===================================================================
-- Migration: Consolidate mood tables - Use mood_entries as canonical
-- Date: 2025-01-27  
-- Purpose: Migrate data from mood_tracking to mood_entries and deprecate mood_tracking
-- Issue: Multiple mood tables causing confusion and data inconsistency
-- ===================================================================

-- 1. First, ensure mood_entries table has all required columns
-- (This should have been done by previous migration, but ensure completeness)
ALTER TABLE public.mood_entries 
ADD COLUMN IF NOT EXISTS triggers TEXT[],
ADD COLUMN IF NOT EXISTS activities TEXT[],
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- 2. Create temporary backup of mood_tracking data
CREATE TEMP TABLE mood_tracking_backup AS 
SELECT * FROM public.mood_tracking 
WHERE EXISTS (SELECT 1 FROM public.mood_tracking);

-- 3. Migrate data from mood_tracking to mood_entries (if mood_tracking exists and has data)
DO $$ 
DECLARE
  tracking_count INTEGER;
  migrated_count INTEGER := 0;
BEGIN
  -- Check if mood_tracking table exists and has data
  SELECT COUNT(*) INTO tracking_count 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'mood_tracking';
  
  IF tracking_count > 0 THEN
    -- Get actual row count
    EXECUTE 'SELECT COUNT(*) FROM public.mood_tracking' INTO tracking_count;
    
    IF tracking_count > 0 THEN
      RAISE NOTICE 'Found % records in mood_tracking table, starting migration...', tracking_count;
      
      -- Insert mood_tracking data into mood_entries
      -- Handle potential ID conflicts by generating new UUIDs
      INSERT INTO public.mood_entries (
        user_id,
        mood_score, 
        energy_level,
        anxiety_level,
        notes,
        triggers,
        activities,
        created_at,
        updated_at,
        content_hash
      )
      SELECT 
        mt.user_id,
        LEAST(GREATEST(mt.mood_score * 10, 0), 100) as mood_score, -- Convert 1-10 to 0-100 scale
        mt.energy_level,
        mt.anxiety_level,
        mt.notes,
        mt.triggers,
        mt.activities,
        mt.created_at,
        COALESCE(mt.created_at, NOW()) as updated_at, -- Use created_at as updated_at fallback
        md5(
          mt.user_id::text || 
          (mt.mood_score * 10)::text || 
          mt.energy_level::text || 
          mt.anxiety_level::text || 
          COALESCE(mt.notes, '') || 
          mt.created_at::date::text
        ) as content_hash
      FROM public.mood_tracking mt
      WHERE NOT EXISTS (
        -- Avoid duplicates: don't insert if similar record already exists in mood_entries
        SELECT 1 FROM public.mood_entries me
        WHERE me.user_id = mt.user_id
        AND me.mood_score = LEAST(GREATEST(mt.mood_score * 10, 0), 100)
        AND me.energy_level = mt.energy_level 
        AND me.anxiety_level = mt.anxiety_level
        AND DATE(me.created_at) = DATE(mt.created_at)
      );
      
      GET DIAGNOSTICS migrated_count = ROW_COUNT;
      RAISE NOTICE 'Successfully migrated % records from mood_tracking to mood_entries', migrated_count;
    ELSE
      RAISE NOTICE 'mood_tracking table exists but is empty, no migration needed';
    END IF;
  ELSE
    RAISE NOTICE 'mood_tracking table does not exist, no migration needed';
  END IF;
END $$;

-- 4. Create a view for any code still referencing mood_tracking
CREATE OR REPLACE VIEW mood_tracking_deprecated AS
SELECT 
  id::text as id, -- Convert UUID to text to match old format
  user_id,
  CASE 
    WHEN mood_score <= 10 THEN mood_score -- Already 1-10 scale
    ELSE GREATEST(LEAST(mood_score / 10, 10), 1)::INTEGER -- Convert 0-100 to 1-10 scale
  END as mood_score,
  energy_level,
  anxiety_level,
  notes,
  triggers,
  activities,
  created_at
FROM public.mood_entries
ORDER BY created_at DESC;

-- Grant permissions on deprecated view
GRANT SELECT ON mood_tracking_deprecated TO authenticated;
GRANT SELECT ON mood_tracking_deprecated TO anon;

-- 5. Add warning comments for future developers
COMMENT ON VIEW mood_tracking_deprecated IS 
'DEPRECATED: This view provides backward compatibility for mood_tracking table. 
Use mood_entries table directly instead. This view will be removed in future versions.';

-- 6. Archive mood_tracking table (rename instead of drop for safety)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'mood_tracking'
  ) THEN
    -- Rename table to archive
    ALTER TABLE public.mood_tracking RENAME TO mood_tracking_archived_20250127;
    
    -- Add archival notice
    COMMENT ON TABLE mood_tracking_archived_20250127 IS 
    'ARCHIVED: Original mood_tracking table archived on 2025-01-27. 
    Data has been migrated to mood_entries table. 
    This table can be dropped after verifying migration success.';
    
    RAISE NOTICE 'mood_tracking table archived as mood_tracking_archived_20250127';
  ELSE
    RAISE NOTICE 'mood_tracking table does not exist, archival skipped';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'mood_tracking table does not exist, archival skipped';
END $$;

-- 7. Update any functions or triggers that might reference old table
-- (Add here if there are any stored procedures using mood_tracking)

-- 8. Create indexes on mood_entries for optimal performance
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_created_desc 
ON public.mood_entries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mood_entries_mood_score 
ON public.mood_entries (mood_score);

CREATE INDEX IF NOT EXISTS idx_mood_entries_date 
ON public.mood_entries (created_at::date);

-- 9. Log completion
DO $$ 
DECLARE
  final_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO final_count FROM public.mood_entries;
  
  RAISE NOTICE '✅ Mood table consolidation completed successfully';
  RAISE NOTICE '✅ mood_entries is now the canonical table with % total records', final_count;
  RAISE NOTICE '✅ mood_tracking table archived for safety';  
  RAISE NOTICE '✅ Created backward compatibility view: mood_tracking_deprecated';
  RAISE NOTICE '✅ Added performance indexes';
  RAISE NOTICE '⚠️  Update your code to use mood_entries table instead of mood_tracking';
END $$;
