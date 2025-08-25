# 🚀 Supabase Edge Functions Setup

## API Key'leri Edge Functions'a Taşıma

### 1. Supabase CLI Kurulumu

```bash
# Supabase CLI'yi kurun (eğer henüz kurulu değilse)
npm install -g supabase

# Login olun
supabase login

# Mevcut projenizi link edin
supabase link --project-ref YOUR_PROJECT_REF
```

### 2. Secrets Konfigürasyonu

API key'lerinizi Supabase secrets olarak ayarlayın:

```bash
# Gemini API Key (AI analizi için)
supabase secrets set GEMINI_API_KEY=your_actual_gemini_api_key_here

# Google STT API Key (ses çevirisi için)
supabase secrets set GOOGLE_STT_API_KEY=your_actual_google_stt_api_key_here

# Gemini Model (opsiyonel, varsayılan: gemini-1.5-flash)
supabase secrets set GEMINI_MODEL=gemini-1.5-flash

# Supabase credentials (otomatik olarak mevcut olmalı)
# SUPABASE_URL ve SUPABASE_ANON_KEY otomatik olarak eklenir
```

### 3. Secrets'ı Kontrol Edin

```bash
# Mevcut secrets'ları listele
supabase secrets list
```

Çıktı şuna benzer olmalı:
```
GEMINI_API_KEY
GOOGLE_STT_API_KEY
GEMINI_MODEL  
SUPABASE_ANON_KEY
SUPABASE_URL
```

### 4. Functions Deploy Edin

```bash
# Tek function deploy et
supabase functions deploy analyze-voice  # Text analizi için
supabase functions deploy analyze-audio  # Audio STT + analizi için

# Tüm functions'ları deploy et
supabase functions deploy
```

### 5. Test Edin

**Text analizi için:**
```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/analyze-voice' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Bugün çok kaygılıyım",
    "userId": "test-user-id"
  }'
```

**Audio analizi için (STT + AI):**
```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/analyze-audio' \
  -H 'Authorization: Bearer YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "audioBase64": "BASE64_AUDIO_DATA",
    "userId": "test-user-id",
    "languageCode": "tr-TR"
  }'
```

## ⚠️ Önemli Notlar

1. **API Key'leri Client Tarafından Kaldırın**
   - `app.config.ts` dosyasından `EXPO_PUBLIC_GEMINI_API_KEY` kaldırın
   - Environment variables'dan `EXPO_PUBLIC_GOOGLE_STT_API_KEY` kaldırın
   - Tüm API key'ler artık Edge Functions'da güvenli şekilde saklanıyor  

2. **Güvenlik**
   - Edge Functions otomatik olarak authentication kontrol eder
   - Sadece yetkili kullanıcılar API'yi kullanabilir

3. **Rate Limiting**
   - Supabase otomatik rate limiting uygular
   - Gerekirse custom rate limiting ekleyebilirsiniz

4. **Monitoring**
   - Supabase dashboard'dan function logs'larını görüntüleyebilirsiniz
   - `supabase functions logs analyze-voice` komutuyla logs izleyebilirsiniz

## 🔄 Migration Checklist

- [ ] Supabase CLI kurulu
- [ ] Projede login yapıldı  
- [ ] Secrets ayarlandı (`supabase secrets set`)
- [ ] Edge function deploy edildi
- [ ] Client code edge function'ı çağırıyor
- [ ] Environment variables'dan API key'ler kaldırıldı
- [ ] Test edildi ve çalışıyor

## 📞 Test Edge Function'ı

Başarılı response örneği:
```json
{
  "success": true,
  "result": {
    "category": "MOOD",
    "confidence": 0.85,
    "summary": "Kullanıcı kaygı hissediyor",
    "suggestions": ["Nefes egzersizi yap", "Gevşeme tekniği dene"],
    "insights": {
      "mood": {
        "detectedMood": "kaygılı",
        "intensity": 7,
        "triggers": ["genel durum"]
      }
    }
  }
}
```
