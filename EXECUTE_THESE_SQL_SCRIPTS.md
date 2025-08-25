# 🚀 Supabase SQL Scripts - Manual Execution

## 📍 Access URL
**Supabase Dashboard:** https://supabase.com/dashboard/project/ncniotnzoirwuwwxnipw/sql

## 🔥 CRITICAL: Execute These Scripts in Order

### Script 1: Add Missing Columns
```sql
-- Add missing triggers and activities columns
ALTER TABLE public.mood_entries 
ADD COLUMN IF NOT EXISTS triggers TEXT[],
ADD COLUMN IF NOT EXISTS activities TEXT[];

-- Add content_hash for deduplication
ALTER TABLE public.mood_entries 
ADD COLUMN IF NOT EXISTS content_hash TEXT;
```

### Script 2: Migrate Existing Data
```sql
-- Migrate single trigger to triggers array
DO $$ 
BEGIN
  -- Convert single trigger to array format
  UPDATE public.mood_entries 
  SET triggers = ARRAY[trigger]
  WHERE trigger IS NOT NULL 
  AND trigger != '' 
  AND (triggers IS NULL OR cardinality(triggers) = 0);
  
  RAISE NOTICE 'Migrated trigger data to array format';
END $$;
```

### Script 3: Generate Content Hash
```sql
-- Update existing entries with content_hash
UPDATE public.mood_entries 
SET content_hash = md5(
  CAST(user_id AS text) || 
  CAST(mood_score AS text) || 
  CAST(energy_level AS text) || 
  CAST(anxiety_level AS text) || 
  COALESCE(notes, '') || 
  DATE(created_at)::text
)
WHERE content_hash IS NULL;
```

### Script 4A: Clean Up Duplicates FIRST
```sql
-- CRITICAL: Clean up duplicate entries before adding constraint
-- Single transaction to clean duplicates
DO $$ 
DECLARE
    deleted_count INTEGER;
    duplicate_count INTEGER;
BEGIN
    -- Delete duplicates, keeping only the most recent entry for each (user_id, content_hash)
    WITH entries_to_keep AS (
        SELECT DISTINCT ON (user_id, content_hash) 
            id as keep_id,
            user_id,
            content_hash,
            created_at
        FROM public.mood_entries 
        WHERE content_hash IS NOT NULL
        ORDER BY user_id, content_hash, created_at DESC
    )
    DELETE FROM public.mood_entries 
    WHERE content_hash IS NOT NULL
    AND id NOT IN (SELECT keep_id FROM entries_to_keep);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % duplicate entries', deleted_count;
    
    -- Verify cleanup
    SELECT COUNT(*) INTO duplicate_count 
    FROM (
        SELECT user_id, content_hash, COUNT(*) as cnt
        FROM public.mood_entries 
        WHERE content_hash IS NOT NULL
        GROUP BY user_id, content_hash 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Duplicate cleanup completed. Remaining duplicates: %', duplicate_count;
    
    IF duplicate_count = 0 THEN
        RAISE NOTICE '✅ All duplicates successfully cleaned up!';
    ELSE
        RAISE NOTICE '❌ Warning: % duplicate groups still remain', duplicate_count;
    END IF;
END $$;
```

### Script 4B: Add Deduplication Constraint
```sql
-- Now add unique constraint (after cleaning duplicates)
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
  ELSE
    RAISE NOTICE 'Constraint already exists';
  END IF;
EXCEPTION
  WHEN OTHERS THEN 
    RAISE NOTICE 'Error adding constraint: %', SQLERRM;
END $$;
```

### Script 5: Add Performance Indexes
```sql
-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mood_entries_triggers 
ON public.mood_entries USING gin(triggers);

CREATE INDEX IF NOT EXISTS idx_mood_entries_activities 
ON public.mood_entries USING gin(activities);

CREATE INDEX IF NOT EXISTS idx_mood_entries_content_hash 
ON public.mood_entries (content_hash);
```

### Script 6: Add Auto Hash Function
```sql
-- Create function for automatic content_hash generation
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

-- Create trigger for new inserts
DROP TRIGGER IF EXISTS mood_entry_hash_trigger ON public.mood_entries;
CREATE TRIGGER mood_entry_hash_trigger
  BEFORE INSERT ON public.mood_entries
  FOR EACH ROW
  EXECUTE FUNCTION generate_mood_entry_hash();
```

### Script 7: Add Compatibility View
```sql
-- Create backward compatibility view
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

-- Grant permissions
GRANT SELECT ON mood_entries_compat TO authenticated;
GRANT SELECT ON mood_entries_compat TO anon;
```

### Script 8: Table Consolidation (Optional)
```sql
-- Check if mood_tracking table exists and migrate data if needed

```

### Script 9: Final Verification
```sql
-- Verify migration success
DO $$ 
DECLARE
  final_count INTEGER;
  columns_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO final_count FROM public.mood_entries;
  
  SELECT COUNT(*) INTO columns_count 
  FROM information_schema.columns 
  WHERE table_name = 'mood_entries' 
  AND column_name IN ('triggers', 'activities', 'content_hash');
  
  -- Check for any remaining duplicates
  SELECT COUNT(*) INTO duplicate_count 
  FROM (
      SELECT user_id, content_hash, COUNT(*) as cnt
      FROM public.mood_entries 
      WHERE content_hash IS NOT NULL
      GROUP BY user_id, content_hash 
      HAVING COUNT(*) > 1
  ) duplicates;
  
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '✅ Total mood_entries records: %', final_count;
  RAISE NOTICE '✅ New columns added: %/3', columns_count;
  RAISE NOTICE '✅ Duplicate entries remaining: %', duplicate_count;
  
  IF columns_count = 3 THEN
    RAISE NOTICE '✅ All required columns are present';
  ELSE
    RAISE NOTICE '❌ Some columns are missing, please rerun relevant scripts';
  END IF;
  
  IF duplicate_count = 0 THEN
    RAISE NOTICE '✅ No duplicate entries found';
  ELSE
    RAISE NOTICE '❌ Still have duplicate entries - constraint may fail';
  END IF;
END $$;
```

## 🚨 Instructions:

1. **Go to Supabase Dashboard SQL Editor**
2. **Copy and paste each script ONE BY ONE**
3. **Run them in the exact order shown above**
4. **Wait for each script to complete before running the next**
5. **Check for any error messages**

## ✅ Expected Messages:
- "Migrated trigger data to array format"
- "Added unique constraint for deduplication"  
- "Migration completed successfully!"
- "All required columns are present"

## 🔧 After Completion:
- Test mood functionality in the mobile app
- Verify data integrity
- Check that no records were lost

**Created:** 2025-01-27  
**Priority:** CRITICAL - Execute ASAP
