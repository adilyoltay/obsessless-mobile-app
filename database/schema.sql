-- ================================
-- OBSESSLESS SUPABASE DATABASE SCHEMA
-- ================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- USERS TABLE (extends auth.users)
-- ================================
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  provider TEXT DEFAULT 'email' CHECK (provider IN ('email', 'google')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- ================================
-- USER PROFILES TABLE (onboarding data)
-- ================================
CREATE TABLE public.user_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT unique_user_profile UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only see their own profile
CREATE POLICY "Users can manage own profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = user_id);

-- ================================
-- GAMIFICATION PROFILES TABLE
-- ================================
CREATE TABLE public.gamification_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  healing_points_total INTEGER DEFAULT 0 CHECK (healing_points_total >= 0),
  healing_points_today INTEGER DEFAULT 0 CHECK (healing_points_today >= 0),
  streak_count INTEGER DEFAULT 0 CHECK (streak_count >= 0),
  streak_last_update DATE DEFAULT CURRENT_DATE,
  level INTEGER DEFAULT 1 CHECK (level >= 1),
  achievements TEXT[] DEFAULT '{}',
  micro_rewards JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  CONSTRAINT unique_user_gamification UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.gamification_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own gamification profile
CREATE POLICY "Users can manage own gamification" ON public.gamification_profiles
  FOR ALL USING (auth.uid() = user_id);

-- ================================
-- FUNCTIONS AND TRIGGERS
-- ================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON public.users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON public.user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_gamification_profiles_updated_at 
  BEFORE UPDATE ON public.gamification_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- FUNCTIONS FOR DATA OPERATIONS
-- ================================

-- Function to create user profile after registration (IMPROVED)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  -- Log the trigger execution
  RAISE LOG 'handle_new_user trigger fired for user: %', NEW.id;
  
  -- Only create profiles for confirmed users
  IF NEW.email_confirmed_at IS NOT NULL THEN
    -- Insert user profile with error handling
    BEGIN
      INSERT INTO public.users (id, email, name, provider, created_at, updated_at)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
          NEW.raw_user_meta_data->>'name', 
          NEW.raw_user_meta_data->>'full_name',
          split_part(NEW.email, '@', 1)
        ),
        COALESCE(NEW.raw_user_meta_data->>'provider', 'email'),
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        updated_at = NOW();
        
      RAISE LOG 'User profile created/updated for: %', NEW.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error creating user profile for %: %', NEW.email, SQLERRM;
    END;
    
    -- Create gamification profile with error handling
    BEGIN
      INSERT INTO public.gamification_profiles (
        user_id, 
        streak_count, 
        healing_points, 
        level,
        created_at,
        updated_at
      )
      VALUES (
        NEW.id, 
        0, 
        0, 
        1,
        NOW(),
        NOW()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        updated_at = NOW();
        
      RAISE LOG 'Gamification profile created/updated for: %', NEW.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Error creating gamification profile for %: %', NEW.email, SQLERRM;
    END;
  ELSE
    RAISE LOG 'User % not confirmed yet, skipping profile creation', NEW.email;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

-- Create trigger for INSERT (signup)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create trigger for UPDATE (email confirmation)
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW 
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Enable logging for debugging
SET log_statement = 'all';
SET log_min_messages = 'log';

-- ================================
-- VIEWS FOR ANALYTICS
-- ================================

-- Daily compulsion stats view removed

-- Weekly therapy stats view removed

-- ================================
-- AI PROFILE & PLANS (ALIGN WITH APP)
-- ================================

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
CREATE POLICY "Users can manage own ai profiles" ON public.ai_profiles
  FOR ALL USING (auth.uid() = user_id);

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
CREATE POLICY "Users can manage own ai treatment plans" ON public.ai_treatment_plans
  FOR ALL USING (auth.uid() = user_id);

-- updated_at triggers
DROP TRIGGER IF EXISTS update_ai_profiles_updated_at ON public.ai_profiles;
CREATE TRIGGER update_ai_profiles_updated_at
  BEFORE UPDATE ON public.ai_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_treatment_plans_updated_at ON public.ai_treatment_plans;
CREATE TRIGGER update_ai_treatment_plans_updated_at
  BEFORE UPDATE ON public.ai_treatment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Optional telemetry tables (lightweight)
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  insights JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ai insights" ON public.ai_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own ai insights" ON public.ai_insights FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_telemetry (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.ai_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own ai telemetry" ON public.ai_telemetry FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE INDEX IF NOT EXISTS idx_ai_telemetry_user_time ON public.ai_telemetry(user_id, timestamp DESC);

-- CBT thought_records removed

-- ================================
-- SAMPLE DATA (for testing)
-- ================================

-- ERP sample data removed

-- ================================
-- SECURITY NOTES
-- ================================
-- 1. All tables have RLS enabled
-- 2. Users can only access their own data
-- 3. Auth triggers automatically create profiles
-- 4. Timestamps are in UTC
-- 5. Check constraints ensure data integrity
-- 6. Indexes improve query performance

-- ================================
-- AUTO USER CREATION TRIGGER
-- ================================

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, provider, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name', 
      NEW.raw_user_meta_data->>'full_name', 
      split_part(NEW.email, '@', 1)
    ),
    CASE 
      WHEN NEW.raw_app_meta_data->>'provider' = 'google' THEN 'google'
      WHEN NEW.raw_user_meta_data->>'provider' = 'google' THEN 'google'
      ELSE 'email'
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    provider = EXCLUDED.provider,
    updated_at = EXCLUDED.updated_at;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for auth.users update (for email confirmation)
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- ================================
-- UPDATED_AT TRIGGERS
-- ================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gamification_profiles_updated_at ON public.gamification_profiles;
CREATE TRIGGER update_gamification_profiles_updated_at
  BEFORE UPDATE ON public.gamification_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ================================
-- MANUAL USER CREATION (for existing users)
-- ================================

-- Create user entries for any auth.users that don't have corresponding public.users
INSERT INTO public.users (id, email, name, provider, created_at, updated_at)
SELECT 
  au.id,
  au.email,
  COALESCE(
    au.raw_user_meta_data->>'name', 
    au.raw_user_meta_data->>'full_name', 
    split_part(au.email, '@', 1)
  ) as name,
  CASE 
    WHEN au.raw_app_meta_data->>'provider' = 'google' THEN 'google'
    WHEN au.raw_user_meta_data->>'provider' = 'google' THEN 'google'
    ELSE 'email'
  END as provider,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
  AND au.email_confirmed_at IS NOT NULL;

-- ================================
-- VERIFICATION QUERIES
-- ================================

-- Check if triggers are created successfully
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_name = 'on_auth_user_created'
  ) THEN
    RAISE NOTICE '✅ User creation trigger installed successfully';
  ELSE
    RAISE NOTICE '❌ User creation trigger installation failed';
  END IF;
END $$;
