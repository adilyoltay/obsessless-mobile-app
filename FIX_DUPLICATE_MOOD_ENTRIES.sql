-- ===================================================================
-- DUPLICATE MOOD ENTRIES CLEANUP SCRIPT
-- Purpose: Clean up duplicate mood entries before adding unique constraint
-- Issue: Duplicate key error on (user_id, content_hash) combination
-- ===================================================================

-- 1. First, let's see what duplicates we have
SELECT 
    user_id,
    content_hash,
    COUNT(*) as duplicate_count,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM public.mood_entries 
WHERE content_hash IS NOT NULL
GROUP BY user_id, content_hash 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, user_id;

-- 2. Create a temporary table with the IDs to keep (most recent for each duplicate group)
CREATE TEMP TABLE entries_to_keep AS
SELECT DISTINCT ON (user_id, content_hash) 
    id as keep_id,
    user_id,
    content_hash,
    created_at
FROM public.mood_entries 
WHERE content_hash IS NOT NULL
ORDER BY user_id, content_hash, created_at DESC;

-- 3. Show what we're about to delete (for verification)
SELECT 
    me.id,
    me.user_id,
    me.content_hash,
    me.created_at,
    me.notes
FROM public.mood_entries me
WHERE me.content_hash IS NOT NULL
AND me.id NOT IN (SELECT keep_id FROM entries_to_keep)
ORDER BY me.user_id, me.content_hash, me.created_at;

-- 4. Delete duplicate entries (keeping the most recent one for each group)
DELETE FROM public.mood_entries 
WHERE content_hash IS NOT NULL
AND id NOT IN (SELECT keep_id FROM entries_to_keep);

-- 5. Show the cleanup results
DO $$ 
DECLARE
    remaining_count INTEGER;
    duplicate_count INTEGER;
BEGIN
    -- Count remaining entries
    SELECT COUNT(*) INTO remaining_count FROM public.mood_entries;
    
    -- Check for remaining duplicates
    SELECT COUNT(*) INTO duplicate_count 
    FROM (
        SELECT user_id, content_hash, COUNT(*) as cnt
        FROM public.mood_entries 
        WHERE content_hash IS NOT NULL
        GROUP BY user_id, content_hash 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE '✅ Cleanup completed!';
    RAISE NOTICE '✅ Total mood_entries remaining: %', remaining_count;
    RAISE NOTICE '✅ Duplicate groups remaining: %', duplicate_count;
    
    IF duplicate_count = 0 THEN
        RAISE NOTICE '✅ All duplicates cleaned up successfully!';
    ELSE
        RAISE NOTICE '❌ Still have % duplicate groups - manual cleanup needed', duplicate_count;
    END IF;
END $$;
