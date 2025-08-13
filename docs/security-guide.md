# 🔐 Security Guide

## API Key Güvenliği

### ⚠️ ÖNEMLİ UYARILAR

1. **API key'lerinizi ASLA paylaşmayın**
   - GitHub'a yüklemeyin
   - Mesajlarda göndermeyin
   - Public ortamlarda kullanmayın

2. **Environment Variables Kullanın**
   ```bash
   # .env.local dosyası oluşturun
   EXPO_PUBLIC_SUPABASE_URL=your_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key
   EXPO_PUBLIC_GEMINI_API_KEY=your_key
   EXPO_PUBLIC_GEMINI_MODEL=gemini-1.5-flash
   ```

3. **Git'e Eklemeyin**
   ```bash
   # .gitignore dosyasına ekleyin
   .env.local
   .env*.local
   ```

### 🛡️ Güvenlik Kontrol Listesi

- [ ] .env.local dosyası .gitignore'da
- [ ] API key'ler environment variable'da
- [ ] Hassas bilgiler hardcode edilmemiş
- [ ] Production key'leri farklı
- [ ] Rate limiting aktif
- [ ] HTTPS kullanılıyor

### 🚨 API Key Sızdırması Durumunda

1. **Hemen iptal edin**
   - Gemini / Google AI Studio → API Keys → Revoke
   - Supabase Dashboard → Settings → API

2. **Yeni key oluşturun**
   - Güvenli bir ortamda
   - Sadece .env.local'de saklayın

3. **Logları kontrol edin**
   - Anormal kullanım var mı?
   - Yetkisiz erişim var mı?

### 🔒 Supabase RLS (Row Level Security)

```sql
-- Kullanıcılar sadece kendi verilerini görebilir
CREATE POLICY "Users can only see own data" ON table_name
FOR SELECT USING (auth.uid() = user_id);
```

### 🔑 Edge Function Secrets

```bash
# Supabase CLI ile secret ekleyin
supabase secrets set GEMINI_API_KEY=your_key

# ASLA Edge Function kodunda hardcode etmeyin
const apiKey = Deno.env.get('GEMINI_API_KEY')
```

### 📱 Mobile App Security

1. **Secure Storage**
   ```typescript
   // Hassas verileri SecureStore'da saklayın
   import * as SecureStore from 'expo-secure-store';
   
   await SecureStore.setItemAsync('api_key', value);
   ```

2. **Certificate Pinning**
   - Production'da SSL certificate pinning kullanın
   - Man-in-the-middle saldırılarını önleyin

3. **Obfuscation**
   - Production build'lerde kod obfuscation
   - API endpoint'lerini gizleyin

### 🔍 Security Monitoring

1. **Sentry Integration**
   ```typescript
   Sentry.init({
     dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
     environment: __DEV__ ? 'development' : 'production',
   });
   ```

2. **API Usage Monitoring**
   - Anormal trafik pattern'leri
   - Rate limit aşımları
   - Başarısız authentication denemeleri

### 📋 Best Practices

1. **Principle of Least Privilege**
   - Minimum yetki verin
   - Service-specific key'ler kullanın

2. **Regular Rotation**
   - API key'leri düzenli değiştirin
   - Eski key'leri iptal edin

3. **Audit Trail**
   - Tüm API çağrılarını logla
   - Anomali tespiti yapın

4. **Encryption**
   - Data in transit: HTTPS
   - Data at rest: Encrypted storage
   - Sensitive fields: Field-level encryption

### 🚀 Production Checklist

- [ ] Tüm development key'leri değiştirildi
- [ ] Environment variables production'da set edildi
- [ ] Rate limiting aktif
- [ ] Monitoring kuruldu
- [ ] Security headers eklendi
- [ ] CORS policy'leri ayarlandı
- [ ] Input validation yapılıyor
- [ ] SQL injection koruması var
- [ ] XSS koruması var
- [ ] CSRF token'ları kullanılıyor 