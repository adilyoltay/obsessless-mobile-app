-- Migration: Create missing tables for CoreAnalysisService
-- Date: 2025-01-04
-- Purpose: Create all necessary tables if they don't exist (voice_checkins, thought_records, mood_entries, compulsion_records)

-- 1. Create voice_checkins table if it doesn't exist
CREATE TABLE IF NOT EXISTS voice_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  mood INTEGER CHECK (mood >= 0 AND mood <= 100),
  trigger TEXT,
  confidence REAL CHECK (confidence >= 0 AND confidence <= 1),
  lang TEXT DEFAULT 'tr-TR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_checkins') THEN
    ALTER TABLE voice_checkins ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE voice_checkins ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Enable RLS on voice_checkins
ALTER TABLE voice_checkins ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for voice_checkins (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_checkins' 
    AND policyname = 'Users can only access their own voice checkins'
  ) THEN
    CREATE POLICY "Users can only access their own voice checkins" 
    ON voice_checkins FOR ALL 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create basic indexes (check if columns exist first)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_checkins' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_voice_checkins_user 
    ON voice_checkins (user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'voice_checkins' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_voice_checkins_created 
    ON voice_checkins (created_at DESC);
  END IF;
END $$;

-- 2. Create thought_records table if it doesn't exist
CREATE TABLE IF NOT EXISTS thought_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  thought TEXT,
  automatic_thought TEXT,
  evidence_for TEXT,
  evidence_against TEXT,
  distortions TEXT[],
  new_view TEXT,
  mood_before INTEGER CHECK (mood_before >= 0 AND mood_before <= 100),
  mood_after INTEGER CHECK (mood_after >= 0 AND mood_after <= 100),
  lang TEXT DEFAULT 'tr-TR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'thought_records') THEN
    ALTER TABLE thought_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE thought_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Enable RLS on thought_records
ALTER TABLE thought_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for thought_records (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'thought_records' 
    AND policyname = 'Users can only access their own thought records'
  ) THEN
    CREATE POLICY "Users can only access their own thought records" 
    ON thought_records FOR ALL 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create basic indexes (check if columns exist first)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_thought_records_user 
    ON thought_records (user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'thought_records' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_thought_records_created 
    ON thought_records (created_at DESC);
  END IF;
END $$;

-- 3. Create erp_sessions table if it doesn't exist
-- (Removed) ERP sessions table creation

-- (Removed) ERP sessions table column additions

-- (Removed) Enable RLS on erp_sessions

-- (Removed) Create RLS policy for erp_sessions

-- Create basic indexes (check if columns exist first)
DO $$ 
BEGIN
  -- (Removed) erp_sessions index creation commands
END $$;

-- 4. Create mood_entries table if it doesn't exist
CREATE TABLE IF NOT EXISTS mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  mood_score INTEGER CHECK (mood_score >= 0 AND mood_score <= 100),
  notes TEXT,
  triggers TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mood_entries') THEN
    ALTER TABLE mood_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE mood_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Enable RLS on mood_entries
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for mood_entries (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'mood_entries' 
    AND policyname = 'Users can only access their own mood entries'
  ) THEN
    CREATE POLICY "Users can only access their own mood entries" 
    ON mood_entries FOR ALL 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create basic indexes (check if columns exist first)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mood_entries' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_mood_entries_user 
    ON mood_entries (user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'mood_entries' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_mood_entries_created 
    ON mood_entries (created_at DESC);
  END IF;
END $$;

-- 5. Create compulsion_records table if it doesn't exist
CREATE TABLE IF NOT EXISTS compulsion_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  compulsion_type TEXT,
  description TEXT,
  intensity INTEGER CHECK (intensity >= 0 AND intensity <= 100),
  duration_minutes INTEGER,
  resisted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compulsion_records') THEN
    ALTER TABLE compulsion_records ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE compulsion_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Enable RLS on compulsion_records
ALTER TABLE compulsion_records ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for compulsion_records (if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'compulsion_records' 
    AND policyname = 'Users can only access their own compulsion records'
  ) THEN
    CREATE POLICY "Users can only access their own compulsion records" 
    ON compulsion_records FOR ALL 
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Create basic indexes (check if columns exist first)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compulsion_records' AND column_name = 'user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_compulsion_records_user 
    ON compulsion_records (user_id);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'compulsion_records' AND column_name = 'created_at') THEN
    CREATE INDEX IF NOT EXISTS idx_compulsion_records_created 
    ON compulsion_records (created_at DESC);
  END IF;
END $$;

-- 6. Add updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'voice_checkins')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_voice_checkins_updated_at') THEN
    CREATE TRIGGER update_voice_checkins_updated_at 
    BEFORE UPDATE ON voice_checkins 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'thought_records')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_thought_records_updated_at') THEN
    CREATE TRIGGER update_thought_records_updated_at 
    BEFORE UPDATE ON thought_records 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'erp_sessions')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_erp_sessions_updated_at') THEN
    CREATE TRIGGER update_erp_sessions_updated_at 
    BEFORE UPDATE ON erp_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mood_entries')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_mood_entries_updated_at') THEN
    CREATE TRIGGER update_mood_entries_updated_at 
    BEFORE UPDATE ON mood_entries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compulsion_records')
     AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_compulsion_records_updated_at') THEN
    CREATE TRIGGER update_compulsion_records_updated_at 
    BEFORE UPDATE ON compulsion_records 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 7. Grant permissions (optional, depending on your setup)
-- GRANT ALL ON voice_checkins TO authenticated;
-- GRANT ALL ON thought_records TO authenticated;
-- GRANT ALL ON erp_sessions TO authenticated;
-- GRANT ALL ON mood_entries TO authenticated;
-- GRANT ALL ON compulsion_records TO authenticated;
