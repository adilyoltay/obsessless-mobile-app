## Feature Flags ve Onboarding Davranışı

Onboarding her zaman aktiftir ve en kapsamlı akış olan `OnboardingFlowV3` kullanılır. AI flag’leri onboarding’i kapatmaz; yalnızca ek AI modüllerini (analiz/telemetry) kontrol eder.

- Onboarding akışı: Her zaman `/(auth)/onboarding` rotası.
- AI runtime modülleri: `AI_RUNTIME_MODULES` flag’i ile kontrol edilir (default: master ile aynı).
- Ek modüller (AI açık olduğunda devreye girenler):
  - `AI_YBOCS_ANALYSIS`
  - `AI_USER_PROFILING`
  - `AI_TREATMENT_PLANNING`
  - `AI_RISK_ASSESSMENT`
  - `AI_TELEMETRY`

Notlar:
- `AI_ONBOARDING_V2` her zaman true’dur. Onboarding hiçbir flag ile kapatılmaz.
- Eski `/(auth)/ai-onboarding` rotası kaldırıldı; tek giriş `/(auth)/onboarding`.
  - Today ekranındaki AI CTA, Settings → AI Onboarding devam butonu ve NavigationGuard/app giriş yönlendirmeleri güncellenmiştir.
  - Onboarding tamamlanmadıysa otomatik yönlendirme `/(auth)/onboarding`'edir; tamamlandıysa CTA gizlenir.

# 🌟 ObsessLess Mobile App

## 📱 Genel Bakış

ObsessLess, OKB (Obsesif Kompulsif Bozukluk) ile yaşayan bireyler için tasarlanmış bir **"dijital sığınak"** uygulamasıdır. Kullanıcının OKB'nin getirdiği fırtınalı anlarda sığındığı, onu yargılamadan dinleyen, kanıta dayalı yöntemlerle güçlendiren ve kontrolü tekrar kendi eline almasına yardımcı olan dijital bir yol arkadaşıdır.

## 🚀 Son Güncellemeler (Ocak 2025)

### ✨ Yeni Özellikler
- **🎤 Unified Voice Analysis**: Merkezi ses analizi sistemi (Gemini API)
- **🧠 CBT Düşünce Kaydı**: 4-adımlı bilişsel terapi formu
- **🎨 Master Prompt Uyumlu Tasarım**: Sakinlik, güç, zahmetsizlik ilkeleri
- **📱 BottomSheet Standardizasyonu**: Tutarlı kullanıcı deneyimi
- **⚡ Otomatik Yönlendirme**: Ses analizi ile akıllı sayfa yönlendirmesi

## 🎯 Temel Özellikler

### 🏛️ **5 Ana Modül**

1. **🎤 Akıllı Ses Analizi (YENİ)**
   - Merkezi ses girişi (Today screen)
   - AI destekli tip tespiti (Mood/CBT/OCD/ERP/Breathwork)
   - Otomatik sayfa yönlendirmesi
   - Heuristik fallback sistemi

2. **🧠 CBT Düşünce Kaydı (YENİ)**
   - 4-adımlı terapötik form
   - AI destekli çarpıtma analizi
   - Yeniden çerçeveleme önerileri
   - Offline-first veri saklama

3. **📋 OCD Takip Sistemi**
   - Kompulsiyon kaydı ve analizi
   - Direnç seviyesi takibi
   - Pattern recognition
   - İstatistiksel insights

4. **🛡️ ERP Egzersizleri**
   - Rehberli maruz kalma
   - AI destekli egzersiz önerileri
   - Gerçek zamanlı anksiyete takibi
   - Güvenli çıkış protokolleri

5. **🌬️ Nefes Egzersizleri**
   - Guided breathing sessions
   - Çeşitli teknikler (4-7-8, Box Breathing)
   - Progress tracking
   - Ses analizi entegrasyonu

## 🛠️ Teknoloji Stack

- **Framework:** React Native with Expo (SDK 51)
- **Language:** TypeScript 5.x
- **State Management:** Zustand + React Query
- **Storage:** AsyncStorage (User-specific) + Supabase (sync)
- **Navigation:** Expo Router (File-based)
- **Animations:** React Native Reanimated + Lottie
- **UI Components:** Custom components following Master Prompt principles
- **AI Provider:** Gemini-only (AI Chat devre dışı, Crisis Detection kaldırıldı)

## 🎨 Tasarım İlkeleri

### 🌿 **Sakinlik Her Şeyden Önce Gelir**
- Minimalist tasarım
- #10B981 yeşil tema rengi
- Yumuşak animasyonlar ve geçişler

### 💪 **Güç Kullanıcıdadır**
- Şeffaf süreçler
- Kişiselleştirilebilir deneyim
- Kullanıcı kontrolü

### ⚡ **Zahmetsizlik Esastır**
- Minimum bilişsel yük
- 1-2 tıkla erişim
- Büyük dokunma alanları (min. 48x48px)

## 🚀 Kurulum

### Gereksinimler
- Node.js (18+)
- npm veya yarn
- Expo CLI
- iOS Simulator veya Android Emulator

### Kurulum Adımları

```bash
# Repository'yi klonla
git clone https://github.com/adilyoltay/obsessless-mobile-app.git
cd obsessless-mobile-app

# Bağımlılıkları yükle
npm install

# iOS için CocoaPods yükle
cd ios && pod install && cd ..

# Metro server'ı başlat
npm start

# iOS'da çalıştır
npm run ios

npx eas build --platform ios --profile development

# Android'de çalıştır
npm run android
```

## 📱 Test Durumu

### ✅ **Çalışan Özellikler**
- **Authentication:** Email/Password sistemi
- **Biometric Support:** FaceID/TouchID entegrasyonu
- **Onboarding:** 5 adımlı kurulum süreci
- **OKB Takip:** Kompulsiyon kayıt sistemi
- **ERP System:** Egzersiz takip sistemi
- **Gamification:** Puan sistemi ve streak counter
- **User-Specific Storage:** Kullanıcı bazlı veri yönetimi

### 📊 **Test Metrikleri**
- **Build Success:** ✅ iOS gerçek cihazda çalışıyor
- **Authentication:** ✅ Login/logout fonksiyonel
- **Onboarding:** ✅ 5 adım tamamlanıyor  
- **Compulsion Recording:** ✅ Toast mesajları çalışıyor
- **ERP Sessions:** ✅ Egzersizler mevcut ve çalışıyor

## 📖 Dokümentasyon

- [`docs/obsessless-flow.md`](docs/obsessless-flow.md) - Uygulama akışları ve teknik detaylar
- [`docs/obsessless-ui.md`](docs/obsessless-ui.md) - UI mockups ve tasarım rehberi
- [`docs/test-scenarios.md`](docs/test-scenarios.md) - Test senaryoları ve validasyon

## 🔧 Konfigürasyon

### Bundle Identifier
- **iOS:** `com.adilyoltay.obslesstest`
- **Android:** `com.adilyoltay.obslesstest`
- **URL Scheme:** `obslesstest://`

### Desteklenen Platformlar
- **iOS:** 15.0+
- **Android:** API Level 21+

## 🤝 Katkıda Bulunma

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakınız.

## 👨‍💻 Geliştirici

**Adil Yoltay**
- GitHub: [@adilyoltay](https://github.com/adilyoltay)
- Email: adil.yoltay@gmail.com

## 🙏 Teşekkürler

Bu uygulama, OKB ile yaşayan bireylerin deneyimlerinden ilham alınarak geliştirilmiştir. Tüm geri bildirimler ve katkılar değerlidir.

---

**ObsessLess - Dijital Sığınak 🌟** 
 