# Veri Modeli (Supabase)

ObsessLess uygulamasının Supabase PostgreSQL veritabanı şeması ve tablo yapıları.

## Ana Tablolar

### user_profiles

Kullanıcı profili ve onboarding verilerinin merkezi tablosu.

**Kimlik ve Sistem Alanları:**
- `user_id` (UUID, PRIMARY KEY, REFERENCES auth.users)
- `created_at` (timestamp, default: now())
- `updated_at` (timestamp, updated by application)
- `onboarding_version` (integer, default: 2)
- `onboarding_completed_at` (timestamp)

**Kişisel Profil:**
- `age` (integer)
- `gender` (enum: 'female', 'male', 'non_binary', 'prefer_not_to_say')
- `locale` (text, default: 'tr')
- `timezone` (text)

**Onboarding Verileri:**
- `motivations` (text[]) - Kullanıcının motivasyon faktörleri
- `first_mood_score` (integer, 1-10 arası)
- `first_mood_tags` (text[]) - İlk ruh hali etiketleri

**Yaşam Tarzı:**
- `lifestyle_sleep_hours` (integer, 4-12 arası)
- `lifestyle_exercise` (enum: 'none', 'light', 'moderate', 'intense')
- `lifestyle_social` (enum: 'low', 'medium', 'high')

**Hatırlatıcılar:**
- `reminder_enabled` (boolean, default: false)
- `reminder_time` (text) - HH:MM formatında
- `reminder_days` (text[]) - Haftanın günleri

**Sistem Konfigürasyonu:**
- `feature_flags` (jsonb) - Özellik anahtarları
- `consent_accepted` (boolean)
- `consent_at` (timestamp)

### mood_entries

Kullanıcı ruh hali kayıtları.

**Temel Alanlar:**
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, REFERENCES user_profiles.user_id)
- `created_at` (timestamp, default: now())

**Ruh Hali Verileri:**
- `mood_score` (integer, 1-10 arası)
- `energy_level` (integer, 1-5 arası)
- `anxiety_level` (integer, 1-5 arası)
- `notes` (text, optional)
- `trigger` (text, optional)

**İndeksler:**
- `user_id, created_at` (composite index)
- `mood_score` (performance index)

### ai_profiles

AI bağlamı için kullanıcı profil verileri.

**Alanlar:**
- `user_id` (UUID, PRIMARY KEY, REFERENCES user_profiles.user_id)
- `profile_data` (jsonb) - AI işleme için optimize edilmiş veri
- `onboarding_completed` (boolean, default: false)
- `completed_at` (timestamp)
- `updated_at` (timestamp, default: now())

### ai_treatment_plans

AI tarafından oluşturulan tedavi planları.

**Alanlar:**
- `user_id` (UUID, PRIMARY KEY, REFERENCES user_profiles.user_id)
- `plan_data` (jsonb) - Plan detayları ve konfigürasyonu
- `status` (text, default: 'active')
- `updated_at` (timestamp, default: now())

## Validation Constraints

### CHECK Constraints

**Gender Validation:**
```sql
ALTER TABLE user_profiles 
ADD CONSTRAINT check_gender 
CHECK (gender IN ('female','male','non_binary','prefer_not_to_say'));
```

**Lifestyle Exercise:**
```sql
ALTER TABLE user_profiles 
ADD CONSTRAINT check_lifestyle_exercise 
CHECK (lifestyle_exercise IN ('none','light','moderate','intense'));
```

**Lifestyle Social:**
```sql
ALTER TABLE user_profiles 
ADD CONSTRAINT check_lifestyle_social 
CHECK (lifestyle_social IN ('low','medium','high'));
```

**Score Ranges:**
```sql
-- Mood score validation
ALTER TABLE mood_entries 
ADD CONSTRAINT check_mood_score 
CHECK (mood_score >= 1 AND mood_score <= 10);

-- Energy and anxiety levels
ALTER TABLE mood_entries 
ADD CONSTRAINT check_energy_level 
CHECK (energy_level >= 1 AND energy_level <= 5);

ALTER TABLE mood_entries 
ADD CONSTRAINT check_anxiety_level 
CHECK (anxiety_level >= 1 AND anxiety_level <= 5);
```

### Array Validation

**Motivations Array:**
```sql
ALTER TABLE user_profiles 
ADD CONSTRAINT check_motivations_not_empty 
CHECK (array_length(motivations, 1) > 0);
```

**Reminder Days:**
```sql
ALTER TABLE user_profiles 
ADD CONSTRAINT check_reminder_days_valid 
CHECK (
  reminder_days <@ ARRAY['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
);
```

## Sanitizasyon ve Güvenlik

### PII Sanitizasyon

Client-side sanitizasyon kuralları:
- **Email maskesi**: `user@domain.com` → `u***@***.com`
- **Telefon maskesi**: `+90532123456` → `+90***123***`
- **İsim normalizasyonu**: Büyük/küçük harf düzenlemesi
- **Özel karakter temizliği**: SQL injection önlemi

### Server-side Validation

```sql
-- Example: Safe text validation function
CREATE OR REPLACE FUNCTION validate_user_input(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove potentially harmful characters
  input_text := regexp_replace(input_text, '[<>&"\\'']', '', 'g');
  
  -- Limit length
  input_text := LEFT(input_text, 500);
  
  -- Trim whitespace
  input_text := TRIM(input_text);
  
  RETURN input_text;
END;
$$ LANGUAGE plpgsql;
```

### Enum Normalizasyon

Application-level enum validation ve normalizasyon:

```typescript
// services/supabase.ts
const normalizeEnum = (value: string, allowedValues: string[], defaultValue: string) => {
  const normalized = value?.toLowerCase()?.trim();
  return allowedValues.includes(normalized) ? normalized : defaultValue;
};

const sanitizeUserProfile = (payload: any) => ({
  ...payload,
  gender: normalizeEnum(payload.gender, ['female','male','non_binary','prefer_not_to_say'], 'prefer_not_to_say'),
  lifestyle_exercise: normalizeEnum(payload.lifestyle_exercise, ['none','light','moderate','intense'], 'none'),
  lifestyle_social: normalizeEnum(payload.lifestyle_social, ['low','medium','high'], 'medium')
});
```

## Row Level Security (RLS)

### Temel Politikalar

**user_profiles Table:**
```sql
-- Users can only access their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);
```

**mood_entries Table:**
```sql
-- Users can manage their own mood entries
CREATE POLICY "Users can manage own mood entries" ON mood_entries
  FOR ALL USING (auth.uid() = user_id);
```

**ai_profiles & ai_treatment_plans:**
```sql
-- Similar user-based isolation
CREATE POLICY "Users can access own AI data" ON ai_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access own treatment plans" ON ai_treatment_plans
  FOR ALL USING (auth.uid() = user_id);
```

### RLS Aktivasyon

```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_treatment_plans ENABLE ROW LEVEL SECURITY;
```

## Migration Files

### Onboarding v2 Migration
**File**: `supabase/migrations/2025-08-27_add_onboarding_profile_v2.sql`

```sql
-- Add onboarding v2 columns
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS onboarding_version INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS motivations TEXT[],
ADD COLUMN IF NOT EXISTS first_mood_score INTEGER,
ADD COLUMN IF NOT EXISTS first_mood_tags TEXT[],
ADD COLUMN IF NOT EXISTS lifestyle_sleep_hours INTEGER,
ADD COLUMN IF NOT EXISTS lifestyle_exercise TEXT,
ADD COLUMN IF NOT EXISTS lifestyle_social TEXT,
ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_time TEXT,
ADD COLUMN IF NOT EXISTS reminder_days TEXT[],
ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS consent_accepted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS consent_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP;
```

### AI Tables Migration
**File**: `supabase/migrations/2025-08-10_add_ai_tables.sql`

```sql
-- Create AI-related tables
CREATE TABLE IF NOT EXISTS ai_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL DEFAULT '{}',
  onboarding_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_treatment_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_data JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'active',
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Mood Entries Migration
**File**: `supabase/migrations/20250120_create_mood_entries_table.sql`

```sql
CREATE TABLE IF NOT EXISTS mood_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mood_score INTEGER NOT NULL CHECK (mood_score >= 1 AND mood_score <= 10),
  energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
  anxiety_level INTEGER CHECK (anxiety_level >= 1 AND anxiety_level <= 5),
  notes TEXT,
  trigger TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_created 
ON mood_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mood_entries_score 
ON mood_entries(mood_score);
```

## Rollback Strategy

### Safe Rollback Pattern

```sql
-- Safe column addition (can be rolled back without data loss)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS new_column TEXT;

-- Safe rollback (dropping columns with IF EXISTS guard)
ALTER TABLE user_profiles DROP COLUMN IF EXISTS new_column;
```

### Migration Rollback Considerations

1. **ADD COLUMN** operations are safe and reversible
2. **DROP COLUMN** operations require careful data backup
3. **ALTER CONSTRAINT** changes should be tested thoroughly
4. **Index changes** are generally safe and reversible

### Legacy Cleanup

For removed features (e.g., CBT/OCD modules):
```sql
-- Safe cleanup with existence checks
DROP TABLE IF EXISTS cbt_thought_records CASCADE;
DROP TABLE IF EXISTS ocd_compulsion_logs CASCADE;
DROP FUNCTION IF EXISTS process_cbt_analysis(jsonb) CASCADE;
```

## Performance Considerations

### Index Strategy

**Critical Performance Indexes:**
- `user_profiles(user_id)` - Primary key, automatic
- `mood_entries(user_id, created_at)` - Time-series queries
- `mood_entries(mood_score)` - Analytics and reporting

### Query Optimization

**Efficient Queries:**
```sql
-- Good: Use composite index
SELECT * FROM mood_entries 
WHERE user_id = $1 AND created_at >= $2 
ORDER BY created_at DESC LIMIT 10;

-- Good: Leverage RLS policies
SELECT * FROM user_profiles WHERE user_id = auth.uid();
```

**Avoid:**
```sql
-- Bad: Full table scan without user_id filter
SELECT COUNT(*) FROM mood_entries WHERE mood_score > 7;

-- Bad: Complex JSONB operations without proper indexing
SELECT * FROM user_profiles WHERE feature_flags->>'complex_key' = 'value';
```

## İlgili Bölümler

- [**Onboarding v2**](./onboarding-v2.md) – Onboarding data flow details
- [**Architecture**](./architecture.md) – Overall system design
- [**Security & Privacy**](./security-privacy.md) – Security implementation
- [**Offline Sync**](./sync.md) – Data synchronization patterns
- [**Troubleshooting**](./troubleshooting.md) – Common database issues
