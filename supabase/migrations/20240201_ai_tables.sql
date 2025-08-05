-- AI Tables Migration
-- Tüm AI özelliklerini destekleyen veritabanı şeması

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- AI Conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    state TEXT CHECK (state IN ('idle', 'active', 'thinking', 'error', 'ended')) DEFAULT 'idle',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Messages table
CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536), -- For semantic search
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Insights table
CREATE TABLE IF NOT EXISTS ai_insights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('progress', 'pattern', 'trigger', 'coping', 'motivation', 'education', 'warning', 'celebration')),
    priority INTEGER CHECK (priority BETWEEN 1 AND 4) DEFAULT 2,
    content TEXT NOT NULL,
    confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
    clinical_relevance FLOAT CHECK (clinical_relevance BETWEEN 0 AND 1),
    actionable BOOLEAN DEFAULT false,
    actions JSONB DEFAULT '[]',
    related_patterns TEXT[] DEFAULT '{}',
    helpful BOOLEAN,
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pattern Analysis table
CREATE TABLE IF NOT EXISTS ai_pattern_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('temporal', 'trigger', 'behavioral', 'emotional', 'cognitive', 'social', 'environmental')),
    name TEXT NOT NULL,
    description TEXT,
    confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
    frequency INTEGER DEFAULT 0,
    severity INTEGER CHECK (severity BETWEEN 1 AND 10),
    triggers TEXT[] DEFAULT '{}',
    manifestations TEXT[] DEFAULT '{}',
    timeline JSONB DEFAULT '{}',
    recommendations TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Voice Sessions table
CREATE TABLE IF NOT EXISTS ai_voice_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    state TEXT CHECK (state IN ('idle', 'listening', 'processing', 'transcribing', 'error', 'completed')) DEFAULT 'idle',
    recordings JSONB DEFAULT '[]',
    transcriptions JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Crisis Events table (for safety tracking)
CREATE TABLE IF NOT EXISTS ai_crisis_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('none', 'low', 'moderate', 'high', 'critical')),
    types TEXT[] DEFAULT '{}',
    confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
    triggers TEXT[] DEFAULT '{}',
    message_content TEXT, -- Anonymized/redacted
    actions_taken JSONB DEFAULT '[]',
    resolved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Telemetry table
CREATE TABLE IF NOT EXISTS ai_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Can be null for anonymous
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User AI Profiles table
CREATE TABLE IF NOT EXISTS user_ai_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    symptom_severity INTEGER,
    preferred_language TEXT DEFAULT 'tr',
    trigger_words TEXT[] DEFAULT '{}',
    therapeutic_goals TEXT[] DEFAULT '{}',
    communication_style TEXT CHECK (communication_style IN ('supportive', 'direct', 'empathetic')) DEFAULT 'supportive',
    privacy_preferences JSONB DEFAULT '{"dataRetention": "standard", "analyticsConsent": true, "therapistSharing": false, "anonymizedDataUsage": true}',
    ocd_subtypes TEXT[] DEFAULT '{}',
    readiness_for_change FLOAT CHECK (readiness_for_change BETWEEN 0 AND 1),
    cultural_factors JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_session_id ON ai_conversations(session_id);
CREATE INDEX idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX idx_ai_messages_created_at ON ai_messages(created_at DESC);
CREATE INDEX idx_ai_insights_user_id ON ai_insights(user_id);
CREATE INDEX idx_ai_insights_category ON ai_insights(category);
CREATE INDEX idx_ai_insights_expires_at ON ai_insights(expires_at);
CREATE INDEX idx_ai_pattern_analysis_user_id ON ai_pattern_analysis(user_id);
CREATE INDEX idx_ai_pattern_analysis_pattern_type ON ai_pattern_analysis(pattern_type);
CREATE INDEX idx_ai_crisis_events_user_id ON ai_crisis_events(user_id);
CREATE INDEX idx_ai_crisis_events_level ON ai_crisis_events(level);
CREATE INDEX idx_ai_telemetry_event_type ON ai_telemetry(event_type);
CREATE INDEX idx_ai_telemetry_created_at ON ai_telemetry(created_at DESC);

-- RLS Policies
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_pattern_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_crisis_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_profiles ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view own conversations" ON ai_conversations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own conversations" ON ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON ai_conversations
    FOR UPDATE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages from own conversations" ON ai_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE ai_conversations.id = ai_messages.conversation_id
            AND ai_conversations.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create messages in own conversations" ON ai_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM ai_conversations
            WHERE ai_conversations.id = ai_messages.conversation_id
            AND ai_conversations.user_id = auth.uid()
        )
    );

-- Insights policies
CREATE POLICY "Users can view own insights" ON ai_insights
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own insights" ON ai_insights
    FOR UPDATE USING (auth.uid() = user_id);

-- Pattern analysis policies
CREATE POLICY "Users can view own patterns" ON ai_pattern_analysis
    FOR SELECT USING (auth.uid() = user_id);

-- Voice sessions policies
CREATE POLICY "Users can view own voice sessions" ON ai_voice_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own voice sessions" ON ai_voice_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Crisis events policies (restricted)
CREATE POLICY "Users cannot directly access crisis events" ON ai_crisis_events
    FOR SELECT USING (false);

-- Telemetry policies
CREATE POLICY "Anonymous telemetry allowed" ON ai_telemetry
    FOR INSERT WITH CHECK (true);

-- User AI profiles policies
CREATE POLICY "Users can view own AI profile" ON user_ai_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own AI profile" ON user_ai_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AI profile" ON user_ai_profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Functions for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_pattern_analysis_updated_at BEFORE UPDATE ON ai_pattern_analysis
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ai_profiles_updated_at BEFORE UPDATE ON user_ai_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column(); 