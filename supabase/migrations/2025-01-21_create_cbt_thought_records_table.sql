-- ================================
-- CBT THOUGHT RECORDS TABLE
-- ================================
-- Bu migration CBT thought record kayıtları için gerekli tabloyu oluşturur

CREATE TABLE IF NOT EXISTS public.thought_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  thought TEXT NOT NULL,
  distortions TEXT[] DEFAULT '{}',
  evidence_for TEXT,
  evidence_against TEXT,
  reframe TEXT NOT NULL,
  mood_before INTEGER NOT NULL CHECK (mood_before >= 1 AND mood_before <= 10),
  mood_after INTEGER NOT NULL CHECK (mood_after >= 1 AND mood_after <= 10),
  trigger TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_thought_records_user_id ON public.thought_records(user_id);
CREATE INDEX IF NOT EXISTS idx_thought_records_created_at ON public.thought_records(created_at);
CREATE INDEX IF NOT EXISTS idx_thought_records_mood_improvement ON public.thought_records((mood_after - mood_before));

-- Enable RLS (Row Level Security)
ALTER TABLE public.thought_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only manage their own thought records
CREATE POLICY "Users can manage own thought records" ON public.thought_records
  FOR ALL USING (auth.uid() = user_id);

-- Specific policies for better granularity
CREATE POLICY "Users can view own thought records" ON public.thought_records
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own thought records" ON public.thought_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own thought records" ON public.thought_records
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own thought records" ON public.thought_records
  FOR DELETE USING (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_thought_records_updated_at
  BEFORE UPDATE ON public.thought_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON public.thought_records TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- ================================
-- CBT ANALYTICS VIEWS
-- ================================

-- Daily CBT progress view
CREATE OR REPLACE VIEW public.daily_cbt_stats AS
SELECT 
  user_id,
  DATE(created_at) as date,
  COUNT(*) as total_records,
  AVG(mood_after - mood_before) as avg_mood_improvement,
  AVG(array_length(distortions, 1)) as avg_distortions_per_record,
  array_agg(DISTINCT unnest(distortions)) as unique_distortions
FROM public.thought_records
GROUP BY user_id, DATE(created_at);

-- Weekly CBT progress view
CREATE OR REPLACE VIEW public.weekly_cbt_stats AS
SELECT 
  user_id,
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as total_records,
  AVG(mood_after - mood_before) as avg_mood_improvement,
  COUNT(DISTINCT DATE(created_at)) as active_days,
  (COUNT(DISTINCT DATE(created_at)) * 1.0 / 7.0) as consistency_rate
FROM public.thought_records
GROUP BY user_id, DATE_TRUNC('week', created_at);

-- Most common distortions view
CREATE OR REPLACE VIEW public.common_distortions AS
SELECT 
  user_id,
  unnest(distortions) as distortion,
  COUNT(*) as frequency,
  AVG(mood_after - mood_before) as avg_improvement_when_present
FROM public.thought_records
WHERE distortions IS NOT NULL AND array_length(distortions, 1) > 0
GROUP BY user_id, unnest(distortions)
ORDER BY frequency DESC;

-- Grant view permissions
GRANT SELECT ON public.daily_cbt_stats TO authenticated;
GRANT SELECT ON public.weekly_cbt_stats TO authenticated;
GRANT SELECT ON public.common_distortions TO authenticated;

-- ================================
-- VERIFICATION
-- ================================

-- Verify table creation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'thought_records'
  ) THEN
    RAISE NOTICE '✅ thought_records table created successfully';
  ELSE
    RAISE NOTICE '❌ thought_records table creation failed';
  END IF;
  
  -- Verify RLS is enabled
  IF EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE c.relname = 'thought_records' 
    AND n.nspname = 'public' 
    AND c.relrowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS enabled on thought_records';
  ELSE
    RAISE NOTICE '❌ RLS not enabled on thought_records';
  END IF;
END $$;
