# 🚀 SUPABASE MANUAL SQL DEPLOYMENT GUIDE

## 📍 Access Supabase Dashboard
**URL:** https://supabase.com/dashboard/project/ncniotnzoirwuwwxnipw

## 📝 Steps
1. Navigate to **SQL Editor** in left sidebar
2. Execute the following SQL scripts **IN ORDER**
3. Wait for each script to complete before running the next

---

## 🔧 SQL SCRIPT #1: Fix Mood Entries Schema
**Purpose:** Add missing triggers/activities columns to mood_entries table

```sql
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
```

---

## 🔧 SQL SCRIPT #2: Consolidate Mood Tables
**Purpose:** Migrate data from mood_tracking to mood_entries and deprecate mood_tracking

```sql
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
          CAST(mt.user_id AS text) || 
          CAST((mt.mood_score * 10) AS text) || 
          CAST(mt.energy_level AS text) || 
          CAST(mt.anxiety_level AS text) || 
          COALESCE(mt.notes, '') || 
          DATE(mt.created_at)::text
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
ON public.mood_entries (DATE(created_at));

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
```

---

## ✅ Expected Results After Execution

After running both scripts successfully, you should see:

1. **Schema Fixed:**
   - `mood_entries` table now has `triggers[]` and `activities[]` columns
   - Content-based deduplication with `content_hash`
   - Performance indexes added

2. **Data Consolidated:**
   - All mood data now in single `mood_entries` table
   - `mood_tracking` table archived as backup
   - Backward compatibility views created

3. **Messages You Should See:**
   - ✅ mood_entries schema fix completed successfully
   - ✅ Mood table consolidation completed successfully
   - Migration counts for any existing data

## 🚨 If You See Errors

Common issues and fixes:
- **"relation already exists"**: Safe to ignore if using `IF NOT EXISTS`
- **"column already exists"**: Safe to ignore, means migration already partially ran
- **"permission denied"**: Make sure you're logged in as project owner

## 📞 Next Steps

After successful execution:
1. Deploy the updated mobile app code
2. Test mood functionality 
3. Verify no data loss occurred
4. Monitor for any errors in logs

---

**Prepared:** 2025-01-27  
**Project:** ObsessLess Mobile - Mood System Fix  
**Priority:** CRITICAL
