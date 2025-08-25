# RLS (Row Level Security) Validation Guide

## 🛡️ **Row Level Security Doğrulama ve Drift Cleanup**

Bu doküman, ObsessLess uygulamasındaki Row Level Security (RLS) politikalarının doğrulanması ve şema drift temizliği için rehberdir.

## 📋 **Genel Durum**

### ✅ **RLS Politikaları Aktif**
- `mood_entries` - ✅ `auth.uid() = user_id` 
- `thought_records` - ✅ `auth.uid() = user_id`
- `voice_checkins` - ✅ `auth.uid() = user_id`
- `compulsions` - ✅ `auth.uid() = user_id`
- `ai_telemetry` - ✅ `auth.uid() = user_id`
- `ai_cache` - ✅ `auth.uid() = user_id`
- `user_profiles` - ✅ `auth.uid() = id`

### 📊 **Authoritative Schema Source**
- **Migrations**: `supabase/migrations/*.sql` - **AUTHORITATIVE**
- **Documentation**: `database/schema.sql` - Reference only, sync with migrations required

## 🧪 **Test Çalıştırma**

### **Gereksinimler**

Testlerin çalışması için aşağıdaki environment değişkenleri gereklidir:

```bash
# .env.test dosyasında
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
TEST_USER_ACCESS_TOKEN_1=jwt-token-for-test-user-1
TEST_USER_ACCESS_TOKEN_2=jwt-token-for-test-user-2
```

### **JWT Token Alma (Test Kullanıcıları için)**

```typescript
// Test kullanıcısı JWT token'ı almak için:
const { data: { session } } = await supabase.auth.signInWithPassword({
  email: 'test-user-1@example.com',
  password: 'test-password'
});

const accessToken = session?.access_token;
// Bu token'ı TEST_USER_ACCESS_TOKEN_1 olarak kaydet
```

### **Test Komutları**

```bash
# RLS testlerini çalıştır
npm test __tests__/security/rls.spec.ts

# Tüm güvenlik testleri
npm test __tests__/security/

# Environment eksikse testler skip edilir
npm test -- --verbose  # Skip sebeplerini görmek için
```

## 🔍 **Manuel RLS Doğrulama**

### **Kullanıcı İzolasyon Testi**

```sql
-- Test kullanıcısı olarak giriş yap, sonra:

-- 1. Sadece kendi kayıtları görmeli
SELECT COUNT(*) FROM mood_entries; -- Sadece kendi kayıtları

-- 2. Başka kullanıcının kayıtlarını görmemeli
SELECT COUNT(*) FROM mood_entries WHERE user_id != auth.uid(); -- 0 olmalı

-- 3. Farklı user_id ile insert denemesi başarısız olmalı
INSERT INTO mood_entries (user_id, mood_score, energy_level, anxiety_level) 
VALUES ('different-user-id', 5, 5, 5); -- RLS hatası vermeli
```

### **Cross-User Erişim Testi**

```sql
-- User A'nın kayıt ID'sini al
INSERT INTO mood_entries (user_id, mood_score, energy_level, anxiety_level) 
VALUES (auth.uid(), 7, 6, 5) RETURNING id;

-- User B olarak giriş yap ve User A'nın kaydını güncellemeye çalış
UPDATE mood_entries SET mood_score = 1 WHERE id = 'user-a-record-id';
-- RLS hatası vermeli
```

## 📈 **RLS Performance İzleme**

### **Sorgu Performansı**

```sql
-- RLS policy'lerinin performans etkisini kontrol et
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM mood_entries WHERE created_at >= NOW() - INTERVAL '7 days';

-- Index kullanımını kontrol et
EXPLAIN (ANALYZE) 
SELECT * FROM mood_entries WHERE user_id = auth.uid() AND created_at >= '2024-01-01';
```

### **Gerekli İndeksler**

```sql
-- User bazlı sorgular için kritik indeksler
CREATE INDEX IF NOT EXISTS idx_mood_entries_user_created ON mood_entries(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_thought_records_user_created ON thought_records(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_voice_checkins_user_created ON voice_checkins(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compulsions_user_created ON compulsions(user_id, created_at);
```

## 🔧 **Schema Drift Cleanup**

### **Migration vs Schema Sync**

```bash
# 1. Mevcut migration'ları kontrol et
ls -la supabase/migrations/

# 2. Database/schema.sql ile karşılaştır (manuel)
diff database/schema.sql <(supabase db dump --schema-only)

# 3. Drift varsa migration oluştur
supabase db diff --schema public --file new_migration

# 4. Migration'ı uygula
supabase db push
```

### **Otomatik Drift Kontrolü**

```bash
#!/bin/bash
# scripts/verify-schema-drift.sh

echo "🔍 Checking schema drift..."

# Compare current database with migrations
supabase db diff --linked

if [ $? -ne 0 ]; then
    echo "❌ Schema drift detected!"
    echo "📋 Create migration: supabase db diff --schema public --file fix_drift"
    exit 1
else
    echo "✅ Schema is in sync with migrations"
fi
```

## 🚨 **Güvenlik Kontrol Listesi**

### **RLS Policy Doğrulama**
- [ ] Tüm user-data tablolarında RLS aktif
- [ ] `auth.uid() = user_id` policy'si mevcut
- [ ] Cross-user erişim engelleniyor
- [ ] INSERT/UPDATE/DELETE işlemleri kontrol ediliyor

### **Storage RLS**
- [ ] `audio-temp` bucket owner policy aktif
- [ ] Kullanıcılar sadece kendi dosyalarına erişebiliyor
- [ ] Temporary files cleanup çalışıyor

### **Edge Function Güvenlik**
- [ ] Rate limiting aktif (F-10)
- [ ] JWT token validation çalışıyor
- [ ] CORS headers doğru ayarlanmış

## 📊 **İzleme ve Alertler**

### **RLS Violation İzleme**

```sql
-- RLS violation logları (varsa)
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%policy%' AND calls > 0 
ORDER BY total_exec_time DESC;

-- Başarısız auth denemelerini izle
SELECT event_name, count(*) 
FROM auth.audit_log_entries 
WHERE created_at >= NOW() - INTERVAL '1 hour'
AND event_name LIKE '%fail%'
GROUP BY event_name;
```

### **Performans Metrikleri**

```sql
-- RLS policy performance impact
SELECT schemaname, tablename, n_tup_ins, n_tup_upd, n_tup_del 
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC;
```

## 📝 **Troubleshooting**

### **Yaygın RLS Sorunları**

1. **Policy Bypass**: `security.bypass_rls` yetkisi kontrol et
2. **Performance**: User-based indeksler eksik olabilir
3. **JWT Issues**: Token expiry veya format sorunları
4. **Service Role**: Admin işlemler için service role kullan

### **Log Analizi**

```bash
# Supabase Dashboard'da RLS error'ları ara:
# Logs > Functions > Filter: "RLS" or "policy"

# Terminal'de:
supabase functions logs analyze-voice --follow
```

## 🔄 **Sürekli İyileştirme**

### **Otomatik Testler**
- RLS testleri CI/CD pipeline'da çalışsın
- Performance regression testleri ekle
- Schema drift kontrolü otomatik olsun

### **Monitoring Dashboard**
- RLS violation metrikleri
- Query performance trends  
- User access patterns

---

**Not**: Bu doküman F-07 düzeltmesi kapsamında oluşturulmuştur ve production güvenliğini sağlamak için düzenli olarak güncellenmelidir.
