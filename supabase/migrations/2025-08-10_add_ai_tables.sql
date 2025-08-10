-- AI PROFILE & PLANS (SAFE MIGRATION)

-- AI Profiles table
CREATE TABLE IF NOT EXISTS public.ai_profiles (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  profile_data JSONB NOT NULL,
  cultural_context TEXT DEFAULT 'turkish',
  onboarding_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.ai_profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage own ai profiles" ON public.ai_profiles
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger for ai_profiles
DROP TRIGGER IF EXISTS update_ai_profiles_updated_at ON public.ai_profiles;
CREATE TRIGGER update_ai_profiles_updated_at
  BEFORE UPDATE ON public.ai_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI Treatment Plans table
CREATE TABLE IF NOT EXISTS public.ai_treatment_plans (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE PRIMARY KEY,
  plan_data JSONB NOT NULL,
  plan_type TEXT DEFAULT 'ai_generated',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.ai_treatment_plans ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can manage own ai treatment plans" ON public.ai_treatment_plans
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger for ai_treatment_plans
DROP TRIGGER IF EXISTS update_ai_treatment_plans_updated_at ON public.ai_treatment_plans;
CREATE TRIGGER update_ai_treatment_plans_updated_at
  BEFORE UPDATE ON public.ai_treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Optional AI Insights table
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  insights JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can view own ai insights" ON public.ai_insights FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert own ai insights" ON public.ai_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Optional AI Telemetry table
CREATE TABLE IF NOT EXISTS public.ai_telemetry (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL,
  occurred_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.ai_telemetry ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Users can insert own ai telemetry" ON public.ai_telemetry FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ai_telemetry_user_time ON public.ai_telemetry(user_id, occurred_at DESC);

-- Backward compatibility: rename column if previously created as "timestamp"
DO $$ BEGIN
  ALTER TABLE public.ai_telemetry RENAME COLUMN "timestamp" TO occurred_at;
EXCEPTION WHEN undefined_column THEN NULL; END $$;


