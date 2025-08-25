-- ===================================================================
-- Migration Success Verification Script
-- Purpose: Verify all mood system migrations completed successfully
-- ===================================================================

-- 1. Check if all required columns exist
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'mood_entries' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check for any remaining duplicates
SELECT 'Duplicate Check' as test_name,
    COUNT(*) as duplicate_groups,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ No duplicates found'
        ELSE '❌ Duplicates still exist'
    END as status
FROM (
    SELECT user_id, content_hash, COUNT(*) as cnt
    FROM public.mood_entries 
    WHERE content_hash IS NOT NULL
    GROUP BY user_id, content_hash 
    HAVING COUNT(*) > 1
) duplicates;

-- 3. Check data integrity
SELECT 
    'Data Integrity' as test_name,
    COUNT(*) as total_entries,
    COUNT(content_hash) as entries_with_hash,
    COUNT(triggers) as entries_with_triggers,
    COUNT(activities) as entries_with_activities,
    CASE 
        WHEN COUNT(content_hash) = COUNT(*) THEN '✅ All entries have content_hash'
        ELSE CONCAT('❌ Missing content_hash: ', COUNT(*) - COUNT(content_hash), ' entries')
    END as hash_status
FROM public.mood_entries;

-- 4. Check constraints
SELECT 
    constraint_name,
    constraint_type,
    CASE 
        WHEN constraint_name = 'mood_entries_user_content_unique' THEN '✅ Deduplication constraint active'
        ELSE constraint_name
    END as status
FROM information_schema.table_constraints 
WHERE table_name = 'mood_entries' 
AND table_schema = 'public'
AND constraint_type = 'UNIQUE';

-- 5. Check indexes
SELECT 
    indexname,
    indexdef,
    CASE 
        WHEN indexname LIKE '%triggers%' THEN '✅ Triggers index active'
        WHEN indexname LIKE '%activities%' THEN '✅ Activities index active'
        WHEN indexname LIKE '%content_hash%' THEN '✅ Content hash index active'
        ELSE 'Standard index'
    END as purpose
FROM pg_indexes 
WHERE tablename = 'mood_entries' 
AND schemaname = 'public'
ORDER BY indexname;

-- 6. Check trigger function
SELECT 
    routine_name,
    routine_type,
    CASE 
        WHEN routine_name = 'generate_mood_entry_hash' THEN '✅ Hash generation function active'
        ELSE routine_name
    END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%mood%';

-- 7. Sample data verification
SELECT 
    'Sample Data' as test_name,
    id,
    user_id,
    mood_score,
    CASE 
        WHEN triggers IS NOT NULL THEN CONCAT('✅ Triggers: ', cardinality(triggers), ' items')
        ELSE '❌ No triggers array'
    END as triggers_status,
    CASE 
        WHEN content_hash IS NOT NULL THEN '✅ Has content_hash'
        ELSE '❌ Missing content_hash'
    END as hash_status,
    created_at
FROM public.mood_entries 
ORDER BY created_at DESC 
LIMIT 3;

-- 8. Final summary
DO $$ 
DECLARE
    total_entries INTEGER;
    duplicate_count INTEGER;
    missing_hash_count INTEGER;
    constraint_count INTEGER;
    index_count INTEGER;
BEGIN
    -- Get counts
    SELECT COUNT(*) INTO total_entries FROM public.mood_entries;
    
    SELECT COUNT(*) INTO duplicate_count 
    FROM (
        SELECT user_id, content_hash, COUNT(*) as cnt
        FROM public.mood_entries 
        WHERE content_hash IS NOT NULL
        GROUP BY user_id, content_hash 
        HAVING COUNT(*) > 1
    ) duplicates;
    
    SELECT COUNT(*) INTO missing_hash_count 
    FROM public.mood_entries 
    WHERE content_hash IS NULL;
    
    SELECT COUNT(*) INTO constraint_count 
    FROM information_schema.table_constraints 
    WHERE table_name = 'mood_entries' 
    AND constraint_name = 'mood_entries_user_content_unique';
    
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE tablename = 'mood_entries' 
    AND indexname IN ('idx_mood_entries_triggers', 'idx_mood_entries_activities', 'idx_mood_entries_content_hash');
    
    -- Summary
    RAISE NOTICE '=== MIGRATION SUCCESS SUMMARY ===';
    RAISE NOTICE '✅ Total mood entries: %', total_entries;
    RAISE NOTICE '✅ Duplicate groups: %', duplicate_count;
    RAISE NOTICE '✅ Missing content_hash: %', missing_hash_count;
    RAISE NOTICE '✅ Unique constraint: % (should be 1)', constraint_count;
    RAISE NOTICE '✅ New indexes: %/3 (should be 3)', index_count;
    
    IF duplicate_count = 0 AND missing_hash_count = 0 AND constraint_count = 1 AND index_count = 3 THEN
        RAISE NOTICE '🎉 ALL MIGRATIONS COMPLETED SUCCESSFULLY!';
        RAISE NOTICE '🚀 Mood system is fully operational';
    ELSE
        RAISE NOTICE '⚠️ Some issues detected - check individual results above';
    END IF;
END $$;
