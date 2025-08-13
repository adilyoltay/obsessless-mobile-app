# 🤝 Contributing & Setup Guide

## Kurulum
1. Node 20 / PNPM veya NPM
2. `cp .env.example .env` ve gerekli env değerlerini doldurun:
   - EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
   - EXPO_PUBLIC_GEMINI_API_KEY, EXPO_PUBLIC_GEMINI_MODEL
   - EXPO_PUBLIC_ENABLE_AI=true (master switch)
   - EXPO_PUBLIC_ENABLE_AI_CHAT=false (opsiyonel; şu an dormant)
3. Bağımlılıklar: `npm i`
4. Geliştirme: `npm run start`

## Feature Flags (Kısa Kılavuz)
- Kontrol: `FEATURE_FLAGS.isEnabled('AI_INSIGHTS')`
- Master switch: `EXPO_PUBLIC_ENABLE_AI=true`
- Opsiyonel: `EXPO_PUBLIC_ENABLE_AI_CHAT` (varsayılan kapalı, şu an devre dışı/dormant)
- Kritikleri: `AI_TELEMETRY`, `CONTENT_FILTERING`, `SAFETY_CHECKS` (varsayılan açık)
- Kriz: `AI_CRISIS_DETECTION=false` (kaldırıldı)
- Development’ta toggle: `FEATURE_FLAGS.setFlag(name, true)` (sadece __DEV__)

## Kod Standartları
- TypeScript strict, erken dönüşler, 2-3 seviye derinlik sınırı
- Yorumlar “neden”i açıklar; gereksiz yorum yok
- UI: erişilebilirlik propları (`accessibilityLabel`, `accessibilityRole`)
- Stil: `StyleSheet.create`

## Özellik Geliştirme
- Feature flags üzerinden koruma (aktif olmayanları render etme)
- Offline-first: önce AsyncStorage, sonra Supabase senkron
- Telemetry: `trackAIInteraction` ile enum’a uygun event’ler

## PR Süreci
- Küçük, odaklı PR’lar; anlamlı commit mesajları
- Lint/Type hatasız
- Gerekirse doküman güncellemesi ekleyin

## Güvenlik ve Gizlilik
- PII loglama yok; telemetry sanitize eder
- Kişisel veriler yalnız cihazda/şifreli aktarım

## Yardım
- Sorunlar için Issues açın
- Döngü: Repro → Log → Ekran görüntüsü → Versiyon bilgileri
