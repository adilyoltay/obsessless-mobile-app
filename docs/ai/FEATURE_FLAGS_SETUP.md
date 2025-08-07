# 🛡️ Feature Flags Setup Guide - FAZ 0

## 📋 Genel Bakış

Bu doküman, "Kapsamlı Yol Haritası" belgesindeki **FAZ 0: Güvenlik ve Stabilite Hazırlığı** fazının **Görev 0.0.1: Feature Flag Sistemi** gereksinimlerine uygun olarak oluşturulan feature flag sisteminin kurulum ve kullanım kılavuzudur.

## 🎯 Temel Prensipler

### ✅ Güvenlik-First Yaklaşım
- **Tüm AI özellikleri varsayılan olarak KAPALI**
- **Sadece explicit environment variable'lar ile aktif**
- **Emergency shutdown mekanizması mevcut**
- **Runtime'da güvenlik kontrolleri**

### 🔧 Environment-Based Configuration
- **Development**: `__DEV__ && process.env.EXPO_PUBLIC_ENABLE_* === 'true'`
- **Production**: Sadece test edilmiş özellikler
- **Emergency**: Global kill switch

## 🚀 Kurulum

### 1. Environment Variables Oluştur

`.env.local` dosyası oluşturun:

```bash
# 🤖 AI Feature Flags - DEFAULT: false
EXPO_PUBLIC_ENABLE_AI_CHAT=false
EXPO_PUBLIC_ENABLE_AI_ONBOARDING=false
EXPO_PUBLIC_ENABLE_AI_INSIGHTS=false
EXPO_PUBLIC_ENABLE_AI_VOICE=false
EXPO_PUBLIC_ENABLE_AI_CRISIS=false

# 🧪 Experimental Features
EXPO_PUBLIC_ENABLE_AI_ART_THERAPY=false
EXPO_PUBLIC_ENABLE_AI_VOICE_ERP=false

# 🔧 Development
EXPO_PUBLIC_MOCK_API=false
EXPO_PUBLIC_DEBUG_LOGS=false

# 📊 Telemetry
EXPO_PUBLIC_ENABLE_AI_TELEMETRY=false
```

### 2. Feature Flag Kullanımı

```typescript
import { FEATURE_FLAGS } from '@/constants/featureFlags';

// ✅ Doğru kullanım
if (FEATURE_FLAGS.isEnabled('AI_CHAT')) {
  // AI Chat özelliği aktif
}

// ❌ Yanlış kullanım
if (FEATURE_FLAGS.AI_CHAT) {
  // Bu şekilde kullanmayın - güvenlik kontrolleri bypass edilir
}
```

### 3. Component'larda Kullanım

```typescript
import React from 'react';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

export const AIChatButton: React.FC = () => {
  // Feature flag kontrolü
  if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
    return null; // Özellik aktif değilse render etme
  }

  return (
    <Button onPress={handleAIChat}>
      AI Chat
    </Button>
  );
};
```

## 🚨 Emergency Procedures

### Acil Durum Kapatma

```typescript
// Tüm AI özelliklerini anında kapat
FEATURE_FLAGS.disableAll();
```

### Development'ta Test

```typescript
// Sadece development'ta kullanılabilir
FEATURE_FLAGS.setFlag('AI_CHAT', true);
```

### Özellik Kullanım İstatistikleri

```typescript
// Hangi özelliklerin ne kadar kullanıldığını görün
const stats = FEATURE_FLAGS.getUsageStats();
console.log(stats); // { AI_CHAT: 15, AI_INSIGHTS: 8, ... }
```

## 🎛️ Available Feature Flags

### 🤖 Core AI Features
- `AI_CHAT` - AI destekli sohbet
- `AI_ONBOARDING` - Akıllı kullanıcı kaydı
- `AI_INSIGHTS` - Pattern tanıma ve içgörüler
- `AI_VOICE` - Sesli arayüz
- `AI_CRISIS_DETECTION` - Kriz tespiti

### 🧪 Experimental Features
- `AI_ART_THERAPY` - Sanat terapisi (FAZ 1)
- `AI_VOICE_ERP` - Sesli ERP rehberliği (FAZ 2)
- `AI_CONTEXT_INTELLIGENCE` - Bağlamsal zeka (FAZ 3)
- `AI_PREDICTIVE_INTERVENTION` - Tahmine dayalı müdahale (FAZ 3)

### 🔧 Development Features
- `DEBUG_MODE` - Geliştirme modu
- `MOCK_API_RESPONSES` - Sahte API yanıtları

### 📊 Telemetry Features
- `AI_TELEMETRY` - AI kullanım telemetrisi
- `PERFORMANCE_MONITORING` - Performans izleme
- `ERROR_REPORTING` - Hata raporlama

### 🚨 Safety Features (Always ON)
- `SAFETY_CHECKS` - Güvenlik kontrolleri
- `CONTENT_FILTERING` - İçerik filtreleme
- `RATE_LIMITING` - Hız sınırlama

## 📱 Platform-Specific Configuration

### iOS Development
```bash
# iOS simulator'da test için
EXPO_PUBLIC_ENABLE_AI_CHAT=true npx expo start -i
```

### Android Development
```bash
# Android emulator'da test için
EXPO_PUBLIC_ENABLE_AI_CHAT=true npx expo start -a
```

### Production Build
```bash
# Production build öncesi tüm flag'leri kontrol edin
# Sadece test edilmiş özellikler aktif olmalı
```

## 🔍 Monitoring ve Debugging

### Development Console Logs
```bash
🏳️ Feature Flag Check: AI_CHAT = false
🏳️ Feature Flag Check: AI_INSIGHTS = true
⚠️ AI features disabled: Safety checks are off
🚨 Emergency kill switch activated
```

### Production Monitoring
- Feature kullanım istatistikleri
- Emergency shutdown events
- Rate limiting violations
- Safety check failures

## 🛡️ Security Best Practices

### ✅ DO's
- Her zaman `FEATURE_FLAGS.isEnabled()` kullanın
- Production'da sadece test edilmiş özellikleri aktive edin
- Emergency shutdown'ı test edin
- Feature flag değişikliklerini logla
- Rate limiting'i aktif tutun

### ❌ DON'Ts
- Doğrudan `FEATURE_FLAGS.AI_*` kullanmayın
- Production'da denenmemiş özellikleri aktive etmeyin
- Safety check'leri bypass etmeyin
- Feature flag'leri production'da runtime'da değiştirmeyin

## 🚀 Future Roadmap Integration

Bu feature flag sistemi, yol haritasındaki gelecek fazlar için hazır:

### FAZ 1: İçgörü, Empatik Sohbet ve Terapötik Sanat
- `AI_CHAT`, `AI_INSIGHTS` özellikleri için hazır
- `AI_ART_THERAPY` experimental flag mevcut

### FAZ 2: Sesli ERP Koçu ve Gerçek Zamanlı Destek
- `AI_VOICE_ERP` flag tanımlı
- Biometric integration için genişletilebilir

### FAZ 3: Proaktif JITAI ve Bağlamsal Zeka
- `AI_CONTEXT_INTELLIGENCE` ve `AI_PREDICTIVE_INTERVENTION` flag'leri hazır
- Context-aware feature kontrolü implementasyonu mevcut

## 📞 Support

Sorunlar için:
1. Console loglarını kontrol edin
2. Environment variable'ları doğrulayın
3. Emergency shutdown prosedürünü uygulayın
4. Feature usage stats'ları inceleyin

---

*Bu doküman FAZ 0: Güvenlik ve Stabilite Hazırlığı kapsamında oluşturulmuştur.*
*Son güncelleme: Ocak 2025*