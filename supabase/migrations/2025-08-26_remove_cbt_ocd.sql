-- =============================================
-- Remove CBT/OCD schema objects (tables/views/columns)
-- Safe to run multiple times (IF EXISTS guards)
-- =============================================

BEGIN;

-- Drop views first to avoid dependency errors
DROP VIEW IF EXISTS public.daily_cbt_stats;
DROP VIEW IF EXISTS public.weekly_cbt_stats;
DROP VIEW IF EXISTS public.common_distortions;
DROP VIEW IF EXISTS public.daily_compulsion_stats;
DROP VIEW IF EXISTS public.weekly_therapy_stats;

-- Drop ERP sample/support tables
DROP TABLE IF EXISTS public.erp_exercise_categories CASCADE;

-- Remove OCD-related columns from user_profiles
ALTER TABLE IF EXISTS public.user_profiles DROP COLUMN IF EXISTS ocd_symptoms;
ALTER TABLE IF EXISTS public.user_profiles DROP COLUMN IF EXISTS daily_goal;
ALTER TABLE IF EXISTS public.user_profiles DROP COLUMN IF EXISTS ybocs_score;
ALTER TABLE IF EXISTS public.user_profiles DROP COLUMN IF EXISTS ybocs_severity;

-- Drop CBT thought records tables (handle both qualified/unqualified just in case)
DROP TABLE IF EXISTS public.thought_records CASCADE;
DROP TABLE IF EXISTS thought_records CASCADE;

-- Drop OCD compulsion table
DROP TABLE IF EXISTS public.compulsions CASCADE;

COMMIT;

-- Verification notices (non-blocking)
DO $$
BEGIN
  RAISE NOTICE '✅ CBT/OCD schema cleanup migration applied (views/tables/columns dropped where present)';
END $$;


