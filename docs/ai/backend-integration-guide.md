# Backend Integration Guide

## 🔌 AI Backend Integration

Bu doküman, ObsessLess AI özelliklerinin backend entegrasyonunu açıklar.

### 📋 Gereksinimler

1. **Supabase Projesi**
   - PostgreSQL veritabanı
   - Edge Functions aktif
   - Vector extension (pgvector)

2. **API Keys**
   - OpenAI API Key
   - Supabase Service Role Key

### 🗄️ Veritabanı Kurulumu

1. **Migration'ı Çalıştırın**
   ```sql
   -- supabase/migrations/20240201_ai_tables.sql dosyasını çalıştırın
   ```

2. **Vector Extension**
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

### ⚡ Edge Functions Kurulumu

1. **Supabase CLI Kurulumu**
   ```bash
   npm install -g supabase
   ```

2. **Edge Functions Deploy**
   ```bash
   # AI Chat
   supabase functions deploy ai-chat

   # Pattern Analysis
   supabase functions deploy ai-patterns

   # Insights Generation
   supabase functions deploy ai-insights
   ```

3. **Environment Variables (Secrets)**
   ```bash
   # OpenAI API Key
   supabase secrets set OPENAI_API_KEY=your_key

   # Diğer secrets
   supabase secrets set ANTHROPIC_API_KEY=your_key
   ```

### 🔧 Frontend Konfigürasyonu

1. **Environment Variables**
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

2. **Feature Flags**
   ```typescript
   // constants/featureFlags.ts
   export const FEATURE_FLAGS = {
     AI_CHAT: true, // Production'da aktif
     AI_ONBOARDING: false, // Test aşamasında
     // ...
   }
   ```

### 📡 API Endpoints

#### 1. AI Chat
```typescript
POST /functions/v1/ai-chat
Authorization: Bearer {user_token}

{
  "message": "string",
  "conversationId": "uuid",
  "userId": "uuid",
  "context": {}
}
```

#### 2. Pattern Analysis
```typescript
POST /functions/v1/ai-patterns
Authorization: Bearer {user_token}

{
  "userId": "uuid",
  "timeframe": 30,
  "includeInsights": true
}
```

#### 3. Speech to Text
```typescript
POST /functions/v1/ai-voice-stt
Authorization: Bearer {user_token}

{
  "audio": "base64_encoded_audio",
  "language": "tr"
}
```

### 🔒 Güvenlik

1. **Row Level Security (RLS)**
   - Tüm AI tablolarında RLS aktif
   - Kullanıcılar sadece kendi verilerini görebilir

2. **API Rate Limiting**
   ```typescript
   // Edge Function'da rate limiting
   const rateLimit = {
     chat: 20, // dakikada 20 mesaj
     patterns: 5, // saatte 5 analiz
     voice: 10 // dakikada 10 STT isteği
   }
   ```

3. **Data Privacy**
   - Hassas veriler şifrelenir
   - Crisis events anonim olarak loglanır
   - Telemetri verileri anonimleştirilir

### 📊 Monitoring

1. **Supabase Dashboard**
   - Edge Functions logs
   - Database metrics
   - API usage

2. **Custom Telemetry**
   ```sql
   SELECT 
     event_type,
     COUNT(*) as count,
     DATE_TRUNC('hour', created_at) as hour
   FROM ai_telemetry
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY event_type, hour
   ORDER BY hour DESC;
   ```

3. **Error Tracking**
   ```typescript
   // Frontend'de Sentry entegrasyonu
   Sentry.captureException(error, {
     tags: {
       ai_feature: 'chat',
       user_id: userId
     }
   });
   ```

### 🚀 Production Checklist

- [ ] Tüm API key'ler güvenli şekilde saklanıyor
- [ ] Rate limiting aktif
- [ ] Error handling tamamlandı
- [ ] Monitoring kuruldu
- [ ] Backup stratejisi belirlendi
- [ ] Privacy policy güncellendi
- [ ] A/B test grupları tanımlandı
- [ ] Rollback planı hazır

### 🆘 Troubleshooting

#### "AI servisi kullanılamıyor" hatası
1. Feature flag'leri kontrol edin
2. API key'lerin doğru olduğundan emin olun
3. Edge Function loglarını inceleyin

#### Yavaş yanıt süreleri
1. Edge Function region'ını kontrol edin
2. Database index'lerini gözden geçirin
3. Caching stratejisi uygulayın

#### Crisis detection false positive
1. Keyword listesini günceleyin
2. Confidence threshold'u ayarlayın
3. Context-aware analiz ekleyin 