-- Create mood_entries table
CREATE TABLE IF NOT EXISTS public.mood_entries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    mood_score INTEGER NOT NULL CHECK (mood_score >= 0 AND mood_score <= 100),
    energy_level INTEGER NOT NULL CHECK (energy_level >= 1 AND energy_level <= 10),
    anxiety_level INTEGER NOT NULL CHECK (anxiety_level >= 1 AND anxiety_level <= 10),
    notes TEXT,
    trigger TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_id ON public.mood_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_entries_created_at ON public.mood_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_created ON public.mood_entries(user_id, created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE public.mood_entries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own mood entries
CREATE POLICY "Users can view own mood entries" ON public.mood_entries
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own mood entries
CREATE POLICY "Users can insert own mood entries" ON public.mood_entries
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own mood entries
CREATE POLICY "Users can update own mood entries" ON public.mood_entries
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own mood entries
CREATE POLICY "Users can delete own mood entries" ON public.mood_entries
    FOR DELETE
    USING (auth.uid() = user_id);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at column
CREATE TRIGGER update_mood_entries_updated_at 
    BEFORE UPDATE ON public.mood_entries 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.mood_entries TO authenticated;
GRANT SELECT ON public.mood_entries TO anon;
