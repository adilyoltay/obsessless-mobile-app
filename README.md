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

# 🌟 ObsessLess Mobile App

## 📱 Genel Bakış

ObsessLess, OKB (Obsesif Kompulsif Bozukluk) ile yaşayan bireyler için tasarlanmış bir **"dijital sığınak"** uygulamasıdır. Kullanıcının OKB'nin getirdiği fırtınalı anlarda sığındığı, onu yargılamadan dinleyen, kanıta dayalı yöntemlerle güçlendiren ve kontrolü tekrar kendi eline almasına yardımcı olan dijital bir yol arkadaşıdır.

## 🎯 Temel Özellikler

### 🏛️ **4 Temel Yetenek**

1. **📋 Güvenli Tanışma ve Akıllı Kişiselleştirme**
   - 5 adımlı onboarding süreci
   - Y-BOCS Lite değerlendirmesi
   - Kişiselleştirilmiş hedef belirleme

2. **⚡ Yargısız & Anlık Kompulsiyon Kaydı**
   - FAB butonuyla hızlı erişim (< 15 saniye)
   - Grid layout ile kategori seçimi
   - Direnç seviyesi takibi

3. **🛡️ Kontrollü & Güvenli Yüzleşme (ERP)**
   - Rehberli maruz kalma egzersizleri
   - Gerçek zamanlı anksiyete takibi
   - Güvenli çıkış seçenekleri

4. **🏆 Anlamlı Oyunlaştırma ve Motivasyon**
   - Healing Points sistemi
   - Günlük seri takibi (Streak)
   - Terapötik kilometre taşları

## 🛠️ Teknoloji Stack

- **Framework:** React Native with Expo (~51.0.0)
- **Language:** TypeScript 5.1.3
- **State Management:** Zustand
- **Storage:** AsyncStorage (User-specific)
- **Navigation:** Expo Router (File-based)
- **Animations:** React Native Reanimated
- **UI Components:** Custom components following Master Prompt principles

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
cd obslessless-mobile-app

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
 