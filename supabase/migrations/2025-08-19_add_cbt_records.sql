-- CBT Thought Records Table
CREATE TABLE IF NOT EXISTS thought_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thought TEXT NOT NULL,
  distortions TEXT[], -- Array of cognitive distortion types
  evidence_for TEXT,
  evidence_against TEXT,
  reframe TEXT NOT NULL,
  mood_before INTEGER CHECK (mood_before >= 0 AND mood_before <= 100),
  mood_after INTEGER CHECK (mood_after >= 0 AND mood_after <= 100),
  trigger TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_thought_records_user_id ON thought_records(user_id);
CREATE INDEX idx_thought_records_created_at ON thought_records(created_at DESC);

-- Enable RLS
ALTER TABLE thought_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own thought records" ON thought_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own thought records" ON thought_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own thought records" ON thought_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own thought records" ON thought_records
  FOR DELETE USING (auth.uid() = user_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thought_records_updated_at
  BEFORE UPDATE ON thought_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
