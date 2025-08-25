-- ===================================================================
-- Sync Consistency Check
-- Purpose: Compare Supabase vs LocalStorage mood entries count
-- Check if sync is working properly
-- ===================================================================

-- 1. Get total count in Supabase mood_entries
SELECT 
    '📊 SUPABASE MOOD_ENTRIES COUNT' as source,
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') as last_7_days,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as last_24_hours,
    COUNT(*) FILTER (WHERE content_hash IS NOT NULL) as with_content_hash,
    COUNT(*) FILTER (WHERE triggers IS NOT NULL AND cardinality(triggers) > 0) as with_triggers,
    COUNT(*) FILTER (WHERE activities IS NOT NULL AND cardinality(activities) > 0) as with_activities
FROM public.mood_entries;

-- 2. Get entries by user (to see distribution)
SELECT 
    '👤 BY USER BREAKDOWN' as analysis,
    user_id,
    COUNT(*) as entry_count,
    MIN(created_at) as first_entry,
    MAX(created_at) as last_entry,
    COUNT(*) FILTER (WHERE content_hash IS NOT NULL) as synced_entries,
    ROUND(AVG(mood_score)::numeric, 1) as avg_mood,
    ROUND(AVG(energy_level)::numeric, 1) as avg_energy,
    ROUND(AVG(anxiety_level)::numeric, 1) as avg_anxiety
FROM public.mood_entries 
GROUP BY user_id
ORDER BY entry_count DESC;

-- 3. Check for potential sync issues
SELECT 
    '🔍 POTENTIAL SYNC ISSUES' as check_type,
    COUNT(*) FILTER (WHERE content_hash IS NULL) as missing_content_hash,
    COUNT(*) FILTER (WHERE triggers IS NULL) as missing_triggers_array,
    COUNT(*) FILTER (WHERE activities IS NULL) as missing_activities_array,
    COUNT(*) FILTER (WHERE created_at > updated_at) as inconsistent_timestamps,
    COUNT(*) FILTER (WHERE mood_score < 0 OR mood_score > 100) as invalid_mood_scores,
    COUNT(*) FILTER (WHERE energy_level < 1 OR energy_level > 10) as invalid_energy,
    COUNT(*) FILTER (WHERE anxiety_level < 1 OR anxiety_level > 10) as invalid_anxiety
FROM public.mood_entries;

-- 4. Show recent entries (what should be in localStorage)
SELECT 
    '📅 RECENT ENTRIES (SHOULD BE IN LOCALSTORAGE)' as info,
    id,
    user_id,
    mood_score,
    energy_level,
    anxiety_level,
    CASE 
        WHEN triggers IS NOT NULL AND cardinality(triggers) > 0 
        THEN CONCAT(cardinality(triggers), ' triggers')
        ELSE 'No triggers'
    END as triggers_info,
    CASE 
        WHEN content_hash IS NOT NULL THEN '✅ Synced'
        ELSE '❌ Not synced'
    END as sync_status,
    created_at,
    EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 as hours_ago
FROM public.mood_entries 
WHERE created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- 5. Check for duplicates that might cause sync issues
SELECT 
    '🔄 DUPLICATE CHECK' as check_type,
    user_id,
    content_hash,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as duplicate_ids,
    MIN(created_at) as first_created,
    MAX(created_at) as last_created
FROM public.mood_entries 
WHERE content_hash IS NOT NULL
GROUP BY user_id, content_hash 
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 6. Final summary with localStorage sync expectations
DO $$ 
DECLARE
    total_db_entries INTEGER;
    recent_entries INTEGER;
    synced_entries INTEGER;
    current_user_entries INTEGER;
    main_user_id UUID;
BEGIN
    -- Get totals
    SELECT COUNT(*) INTO total_db_entries FROM public.mood_entries;
    SELECT COUNT(*) INTO recent_entries FROM public.mood_entries WHERE created_at >= NOW() - INTERVAL '30 days';
    SELECT COUNT(*) INTO synced_entries FROM public.mood_entries WHERE content_hash IS NOT NULL;
    
    -- Get main user (most entries)
    SELECT user_id, COUNT(*) INTO main_user_id, current_user_entries
    FROM public.mood_entries 
    GROUP BY user_id 
    ORDER BY COUNT(*) DESC 
    LIMIT 1;
    
    RAISE NOTICE '=== SYNC CONSISTENCY SUMMARY ===';
    RAISE NOTICE '📊 Total entries in Supabase: %', total_db_entries;
    RAISE NOTICE '📅 Recent entries (last 30 days): %', recent_entries;
    RAISE NOTICE '✅ Synced entries (with content_hash): %', synced_entries;
    RAISE NOTICE '👤 Main user entries: % (user: %)', current_user_entries, main_user_id;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎯 EXPECTED LOCALSTORAGE COUNT:';
    RAISE NOTICE '   - For main user: % entries should be in localStorage', current_user_entries;
    RAISE NOTICE '   - Recent entries: % entries should be cached locally', recent_entries;
    
    IF synced_entries = total_db_entries THEN
        RAISE NOTICE '✅ ALL ENTRIES ARE PROPERLY SYNCED';
    ELSE
        RAISE NOTICE '⚠️  % entries missing sync data', total_db_entries - synced_entries;
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 CHECK YOUR APP CONSOLE FOR:';
    RAISE NOTICE '   - "totalEntries": % (should match main user count)', current_user_entries;
    RAISE NOTICE '   - "duplicatesRemoved": should be 0';
    RAISE NOTICE '   - "syncSuccess": should be true';
    
END $$;
