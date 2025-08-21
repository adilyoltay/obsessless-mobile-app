-- Migration: Create missing tables for CoreAnalysisService
-- Date: 2025-01-04
-- Purpose: Create voice_checkins and thought_records tables if they don't exist

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

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_voice_checkins_user 
ON voice_checkins (user_id);

CREATE INDEX IF NOT EXISTS idx_voice_checkins_created 
ON voice_checkins (created_at DESC);

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

-- Create basic indexes
CREATE INDEX IF NOT EXISTS idx_thought_records_user 
ON thought_records (user_id);

CREATE INDEX IF NOT EXISTS idx_thought_records_created 
ON thought_records (created_at DESC);

-- 3. Add updated_at trigger function
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
END $$;

-- 4. Grant permissions (optional, depending on your setup)
-- GRANT ALL ON voice_checkins TO authenticated;
-- GRANT ALL ON thought_records TO authenticated;
