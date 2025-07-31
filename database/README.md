# ObsessLess Database Schema

## 🏗️ **Database Setup Guide**

### **1. Initial Setup**

#### **Supabase Dashboard**
1. Go to **SQL Editor**
2. Run the complete `schema.sql` file
3. Verify triggers are installed correctly

#### **Environment Variables**
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### **2. Schema Overview**

#### **Core Tables**
- `users` - User accounts (from auth.users)
- `user_profiles` - Onboarding data (Y-BOCS, symptoms, goals)
- `compulsions` - OCD compulsion records
- `erp_sessions` - ERP exercise sessions
- `gamification_profiles` - User progress & achievements

#### **Relationships**
```
auth.users (Supabase Auth)
    ↓ (trigger)
public.users
    ↓ (foreign key)
user_profiles, compulsions, erp_sessions, gamification_profiles
```

### **3. Auto-Triggers**

#### **User Creation**
- **Trigger**: `on_auth_user_created`
- **When**: New user registers
- **Action**: Creates entry in `public.users`

#### **Email Confirmation**
- **Trigger**: `on_auth_user_updated`
- **When**: Email confirmed
- **Action**: Ensures user entry exists

#### **Timestamp Updates**
- **Trigger**: `update_*_updated_at`
- **When**: Record updated
- **Action**: Updates `updated_at` field

### **4. Data Flow**

#### **New User Registration**
```
1. Supabase Auth Registration
2. ✅ Auto: users table entry (trigger)
3. ✅ Auto: gamification_profiles entry (app)
4. Manual: user_profiles entry (onboarding)
```

#### **User Actions**
```
1. OCD Compulsion → AsyncStorage + Database
2. ERP Session → AsyncStorage + Database
3. Onboarding Complete → AsyncStorage + Database
4. Gamification Update → AsyncStorage + Database
```

### **5. Troubleshooting**

#### **Foreign Key Errors**
If you see `"Key is not present in table 'users'"`:

```sql
-- Check if user exists
SELECT * FROM public.users WHERE id = 'user_id_here';

-- If not, create manually
INSERT INTO public.users (id, email, name, provider)
SELECT id, email, 
       COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1)),
       CASE WHEN app_metadata->>'provider' = 'google' THEN 'google' ELSE 'email' END
FROM auth.users 
WHERE id = 'user_id_here';
```

#### **Trigger Verification**
```sql
-- Check if triggers exist
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' OR event_object_schema = 'auth';
```

#### **Data Cleanup**
```sql
-- Remove test data
DELETE FROM gamification_profiles WHERE user_id = 'test_user_id';
DELETE FROM user_profiles WHERE user_id = 'test_user_id';
DELETE FROM compulsions WHERE user_id = 'test_user_id';
DELETE FROM erp_sessions WHERE user_id = 'test_user_id';
DELETE FROM users WHERE id = 'test_user_id';
```

### **6. Row Level Security (RLS)**

All tables have RLS enabled with policies:
- Users can only access their own data
- `auth.uid()` matches `user_id` field

### **7. Performance Optimizations**

#### **Indexes**
- `users(id)` - Primary key
- `user_profiles(user_id)` - Foreign key
- `compulsions(user_id, timestamp)` - Queries
- `erp_sessions(user_id, timestamp)` - Queries
- `gamification_profiles(user_id)` - Foreign key

#### **Views**
- `daily_compulsion_stats` - Daily summaries
- `weekly_erp_stats` - Weekly ERP analytics

### **8. Backup & Migration**

#### **Export Data**
```sql
-- Export user data
COPY (SELECT * FROM users) TO 'users.csv' CSV HEADER;
COPY (SELECT * FROM user_profiles) TO 'profiles.csv' CSV HEADER;
COPY (SELECT * FROM compulsions) TO 'compulsions.csv' CSV HEADER;
COPY (SELECT * FROM erp_sessions) TO 'erp_sessions.csv' CSV HEADER;
```

#### **Schema Migrations**
1. Always backup before schema changes
2. Test migrations on staging first
3. Use transactions for complex updates
4. Update app code before schema changes

---

## 🛡️ **Security Checklist**

- ✅ RLS enabled on all tables
- ✅ Foreign key constraints
- ✅ Check constraints on data ranges
- ✅ Triggers for automatic user creation
- ✅ Secure functions with SECURITY DEFINER
- ✅ No direct access to auth schema

## 📊 **Monitoring**

Check these regularly:
- Trigger execution logs
- Foreign key violations
- RLS policy effectiveness
- Query performance
- Storage usage

---

*Last updated: January 2025* 