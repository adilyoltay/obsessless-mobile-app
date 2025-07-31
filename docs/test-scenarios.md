# 🧪 ObsessLess Test Senaryoları - Kapsamlı Test Rehberi

## 📋 Genel Bakış

Bu doküman, ObsessLess uygulamasının tüm özelliklerinin eksiksiz test edilmesi için kapsamlı test senaryolarını içerir. Her senaryo, gerçek kullanım durumlarını simüle eder ve potansiyel hataları ortaya çıkarır.

## 🎯 Test Hedefleri

1. **Veri İzolasyonu**: Her kullanıcının verilerinin ayrı saklandığını doğrula
2. **Ödül Sistemi**: Gamification'ın kullanıcı bazlı çalıştığını kontrol et
3. **Kayıt Sistemi**: OKB ve ERP kayıtlarının doğru saklandığını test et
4. **Çoklu Kullanıcı**: Farklı kullanıcıların verilerinin karışmadığını doğrula
5. **UI/UX Akışı**: Master Prompt ilkelerine uygunluğu test et
6. **Performans**: Büyük veri setleriyle performansı test et
7. **Hata Yönetimi**: Edge case'leri ve hata durumlarını test et

---

## 🧪 Test Senaryoları

### **Senaryo 1: Yeni Kullanıcı - İlk Deneyim**

#### Adımlar:
1. **Kayıt Ol**
   - Email: `test1@example.com`
   - Şifre: `Test123!`
   - İsim: `Test Kullanıcı 1`
   - ❌ Hatalı email formatı dene
   - ❌ Kısa şifre dene (< 6 karakter)
   - ❌ Boş isim dene

2. **Onboarding Tamamla**
   - Semptom seç: Temizlik, Kontrol
   - Y-BOCS soruları: Orta seviye (3-3-3-3-3)
   - Günlük hedef: 3 egzersiz
   - ⏱️ Onboarding süresi ≤ 90 saniye olmalı
   - 🔄 Geri butonları test et
   - 📱 Ekran rotasyonu test et

3. **İlk Kompulsiyon Kaydı**
   - FAB butonuna bas
   - Tip: Temizlik (grid'den seç)
   - Direnç: 7/10 (slider kullan)
   - Not: "İlk test kaydı"
   - ⏱️ Kayıt süresi ≤ 15 saniye olmalı

4. **İlk ERP Oturumu**
   - FAB butonuna bas
   - Kategori: Bulaşma (grid'den seç)
   - Egzersiz: El Yıkama Direnci
   - Başlat ve 2 dakika bekle
   - Anksiyete güncellemeleri yap (8→6→4)
   - Tamamla

#### Beklenen Sonuçlar:
- ✅ Profil `ocd_profile_[userId]` anahtarıyla saklanmalı
- ✅ Kompulsiyon `compulsions_[userId]` anahtarıyla saklanmalı
- ✅ ERP oturumu `erp_sessions_[userId]_[date]` anahtarıyla saklanmalı
- ✅ Gamification profili `gamification_[userId]` anahtarıyla saklanmalı
- ✅ İlk rozet kazanılmalı: "İlk Adım"
- ✅ Healing Points: +20
- ✅ Mikro ödül animasyonu görünmeli

---

### **Senaryo 2: Mevcut Kullanıcı - Günlük Rutin**

#### Adımlar:
1. **Sabah Girişi**
   - Login: `test1@example.com`
   - Ana sayfada streak kontrolü
   - Bugünkü hedef görünmeli (3 egzersiz)

2. **Gün İçi Kayıtlar**
   - 09:00 - Kompulsiyon: Temizlik (Direnç: 8/10)
   - 11:30 - Kompulsiyon: Kontrol (Direnç: 5/10)
   - 14:00 - ERP: Kapı Kontrolü (15 dakika)
   - 16:00 - Kompulsiyon: Simetri (Direnç: 9/10)
   - 18:00 - ERP: Dokunma Egzersizi (10 dakika)

3. **Akşam Kontrolü**
   - OKB Takip: Bugün 3 kayıt
   - ERP: Bugün 2 oturum
   - Ortalama direnç: 7.3/10
   - Healing Points günlük toplam kontrol

#### Beklenen Sonuçlar:
- ✅ Günlük hedef tamamlandı bildirimi
- ✅ "Direnç Duvarı" rozeti (5 yüksek direnç)
- ✅ Streak +1 artmalı
- ✅ Healing Points doğru hesaplanmalı
- ✅ Tüm kayıtlar kronolojik sırada

---

### **Senaryo 3: Çoklu Kullanıcı - Aile Senaryosu**

#### Adımlar:
1. **Anne Hesabı**
   - Login: `anne@example.com`
   - 5 kompulsiyon kaydı
   - 3 ERP oturumu
   - Ayarlar: Türkçe, Bildirimler açık
   - Logout

2. **Çocuk Hesabı**
   - Login: `cocuk@example.com`
   - Veri kontrolü (boş olmalı)
   - 2 kompulsiyon kaydı
   - 1 ERP oturumu
   - Ayarlar: İngilizce, Bildirimler kapalı
   - Logout

3. **Baba Hesabı (Yeni)**
   - Signup: `baba@example.com`
   - Hızlı onboarding (< 60 saniye)
   - 1 kompulsiyon kaydı
   - Logout

4. **Çapraz Kontrol**
   - Anne hesabına gir: 5 kompulsiyon, 3 ERP
   - Çocuk hesabına gir: 2 kompulsiyon, 1 ERP
   - Baba hesabına gir: 1 kompulsiyon, 0 ERP

#### Beklenen Sonuçlar:
- ✅ Her kullanıcının verileri tamamen izole
- ✅ Ayarlar kullanıcıya özel
- ✅ Dil tercihleri korunmalı
- ✅ Gamification profilleri ayrı

---

### **Senaryo 4: Stres Testi - Yoğun Kullanım**

#### Adımlar:
1. **Hızlı Veri Girişi**
   - 30 saniyede 10 kompulsiyon kaydı
   - Her biri farklı tip ve direnç
   - Notlar ekle/ekleme

2. **Uzun ERP Oturumu**
   - 30 dakikalık oturum başlat
   - Her 2 dakikada anksiyete güncelle
   - Pause/Resume test et
   - Arka plana al/geri getir

3. **Veri Görüntüleme**
   - OKB Takip: 50+ kayıt ile performans
   - Haftalık/Aylık görünüm geçişleri
   - "Daha Fazla Göster" pagination
   - Scroll performansı

#### Beklenen Sonuçlar:
- ✅ UI donmamalı
- ✅ Kayıtlar kaybolmamalı
- ✅ Animasyonlar akıcı olmalı
- ✅ Bellek kullanımı stabil kalmalı

---

### **Senaryo 5: Edge Case'ler ve Hata Durumları**

#### A. Ağ Bağlantısı Kesik
1. Airplane mode aç
2. Kompulsiyon kaydet
3. ERP oturumu tamamla
4. Ağı tekrar aç

**Beklenen:** Veriler local'de saklanmalı

#### B. Uygulama Crash
1. ERP oturumu başlat
2. Uygulamayı force quit yap
3. Tekrar aç

**Beklenen:** Oturum kaybolmamalı veya güvenli şekilde sonlanmalı

#### C. Bellek Dolu
1. Cihaz belleğini %95 doldur
2. Büyük notlarla kayıt eklemeye çalış

**Beklenen:** Uygun hata mesajı gösterilmeli

#### D. Zaman Değişimi
1. Cihaz saatini 1 gün ileri al
2. Streak kontrolü yap
3. Saati geri al

**Beklenen:** Streak mantıklı şekilde korunmalı

---

### **Senaryo 6: UI/UX ve Master Prompt Uyumluluğu**

#### A. Sakinlik Testi
1. Tüm ekranları gez
2. Animasyon hızlarını kontrol et
3. Renk geçişlerini gözlemle
4. Haptic feedback'leri test et

**Kontrol Listesi:**
- [ ] Agresif renkler yok
- [ ] Yumuşak geçişler
- [ ] Cömert beyaz alanlar
- [ ] Minimal metin

#### B. Kontrol Testi
1. Her eylemde iptal seçeneği
2. Veri silme onayları
3. Oturum pause/resume
4. Geri alma seçenekleri

**Kontrol Listesi:**
- [ ] Her eylem geri alınabilir
- [ ] Onay diyalogları var
- [ ] Kullanıcı kontrolde

#### C. Zahmetsizlik Testi
1. Kompulsiyon kaydı süresi (< 15 sn)
2. ERP başlatma süresi (< 30 sn)
3. Tab geçiş hızları
4. Form doldurma kolaylığı

**Kontrol Listesi:**
- [ ] Minimum dokunuş
- [ ] Akıllı varsayılanlar
- [ ] Hızlı erişim

---

### **Senaryo 7: Gamification Derinlemesine Test**

#### A. Rozet Kazanma
1. **İlk Adım**: İlk ERP tamamla
2. **Habitüasyon Gözlemcisi**: Anksiyete %50+ düşür
3. **ERP Savaşçısı**: 10 ERP tamamla
4. **Direnç Duvarı**: 5 yüksek direnç
5. **Farkındalık Ustası**: 7 gün streak

#### B. Healing Points Hesaplama
1. Kompulsiyon kaydı: +5 HP
2. Yüksek direnç: +10 HP
3. ERP tamamlama: +15 HP
4. Günlük hedef: +20 HP
5. Haftalık bonus: +50 HP

#### C. Streak Mekanikleri
1. Gün 1-3: Tohum 🌱
2. Gün 4-7: Fidan 🌿
3. Gün 8-14: Ağaç 🌳
4. Gün 15-30: Orman 🌲
5. Gün 31+: Usta 🧘

**Test Edilecekler:**
- [ ] Streak kesintisi ve sıfırlama
- [ ] Level geçişleri
- [ ] Bildirim zamanlaması
- [ ] Motivasyon mesajları

---

### **Senaryo 8: Erişilebilirlik ve Lokalizasyon**

#### A. Erişilebilirlik
1. VoiceOver/TalkBack ile navigasyon
2. Büyük metin boyutu ayarı
3. Renk körü modları
4. Tek elle kullanım

#### B. Lokalizasyon
1. Türkçe ↔ İngilizce geçiş
2. Tarih/saat formatları
3. Sayı formatları
4. Rozet açıklamaları

**Kontrol Listesi:**
- [ ] Tüm metinler çevrilmiş
- [ ] Tarihler doğru formatta
- [ ] RTL desteği (gelecek)
- [ ] Kültürel uygunluk

---

### **Senaryo 9: Veri Güvenliği ve Gizlilik**

#### A. Hassas Veri Koruması
1. Logout sonrası bellek kontrolü
2. Screenshot engelleme (hassas ekranlar)
3. Uygulama arka planda iken blur
4. Biometric login test

#### B. Veri İhracı
1. Kullanıcı verilerini dışa aktar
2. CSV/JSON format kontrolü
3. Veri silme talebi
4. KVKK/GDPR uyumluluğu

---

### **Senaryo 10: Performans Metrikleri**

#### Ölçülecek Metrikler:
1. **Uygulama Başlangıç**: < 3 saniye
2. **Ekran Geçişleri**: < 300ms
3. **Veri Kaydetme**: < 500ms
4. **Liste Yükleme**: < 1 saniye
5. **Bellek Kullanımı**: < 150MB
6. **Pil Tüketimi**: Minimal

#### Test Araçları:
- React Native Performance Monitor
- Flipper
- Chrome DevTools
- Xcode Instruments

---

## 🔧 Otomatik Test Araçları

### Test Runner Script
```javascript
// utils/testRunner.js
export const TestRunner = {
  async runAllTests() {
    const results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      details: []
    };
    
    // Test 1: User Isolation
    try {
      await this.testUserIsolation();
      results.passed++;
    } catch (error) {
      results.failed++;
      results.details.push({ test: 'User Isolation', error });
    }
    
    // Test 2: Data Persistence
    try {
      await this.testDataPersistence();
      results.passed++;
    } catch (error) {
      results.failed++;
      results.details.push({ test: 'Data Persistence', error });
    }
    
    // Test 3: Gamification
    try {
      await this.testGamification();
      results.passed++;
    } catch (error) {
      results.failed++;
      results.details.push({ test: 'Gamification', error });
    }
    
    return results;
  },
  
  async testUserIsolation() {
    // Implementation
  },
  
  async testDataPersistence() {
    // Implementation
  },
  
  async testGamification() {
    // Implementation
  }
};
```

### Debug Console Commands
```javascript
// Konsol'da kullanılacak komutlar

// Test Suite Çalıştır
await TestRunner.runAllTests()

// Spesifik Test
await TestRunner.testUserIsolation()

// Veri Kontrolü
await DebugHelper.viewAllKeys()
await DebugHelper.viewUserData('userId')
await DebugHelper.checkDataIsolation('user1', 'user2')

// Performans Kontrolü
performance.measure('app-startup')
performance.measure('screen-transition')

// Bellek Kullanımı
console.log(performance.memory)
```

---

## ✅ Master Test Kontrol Listesi

### 🔐 Kimlik Doğrulama
- [ ] Email/şifre ile kayıt
- [ ] Email/şifre ile giriş
- [ ] Biometric login
- [ ] Logout işlemi
- [ ] Şifre validasyonu
- [ ] Email validasyonu
- [ ] Oturum persistence

### 📝 Onboarding
- [ ] 5 adım akışı
- [ ] ≤ 90 saniye süre
- [ ] Geri butonları
- [ ] İlerleme göstergesi
- [ ] Veri kaydetme
- [ ] Skip seçeneği (yoksa eklenmeli)

### 💊 OKB Takip
- [ ] FAB butonu erişimi
- [ ] Hızlı kayıt (≤ 15 sn)
- [ ] Kategori grid'i
- [ ] Direnç slider'ı
- [ ] Not alanı
- [ ] Kayıt listesi
- [ ] Tarih filtreleme
- [ ] Silme işlemi
- [ ] Pagination

### 🛡️ ERP Takip
- [ ] FAB butonu erişimi
- [ ] Kategori seçimi
- [ ] Egzersiz seçimi
- [ ] Oturum başlatma
- [ ] Zamanlayıcı
- [ ] Anksiyete takibi
- [ ] Pause/Resume
- [ ] Oturum tamamlama
- [ ] Veri kaydetme

### 🏆 Gamification
- [ ] Streak takibi
- [ ] Rozet kazanma
- [ ] Healing Points
- [ ] Mikro ödüller
- [ ] Level sistemi
- [ ] Animasyonlar
- [ ] Bildirimler

### ⚙️ Ayarlar
- [ ] Dil değiştirme
- [ ] Bildirim tercihleri
- [ ] Biometric toggle
- [ ] Veri dışa aktarma
- [ ] Hesap bilgileri
- [ ] Logout

### 📊 Performans
- [ ] Başlangıç süresi
- [ ] Ekran geçişleri
- [ ] Liste scroll'u
- [ ] Animasyon FPS
- [ ] Bellek kullanımı
- [ ] Pil tüketimi

### 🎨 UI/UX
- [ ] Master Prompt uyumu
- [ ] Responsive tasarım
- [ ] Haptic feedback
- [ ] Loading durumları
- [ ] Error handling
- [ ] Empty states
- [ ] Accessibility

### 🔒 Güvenlik
- [ ] Veri izolasyonu
- [ ] Secure storage
- [ ] Session yönetimi
- [ ] Input sanitization
- [ ] Error logging

---

## 🚨 Kritik Kontrol Noktaları

1. **Her AsyncStorage anahtarı userId içermeli**
   ```javascript
   const keys = await AsyncStorage.getAllKeys();
   const invalidKeys = keys.filter(key => 
     !key.includes('_') && 
     !['profileCompleted', 'currentUser'].includes(key)
   );
   console.assert(invalidKeys.length === 0, 'Invalid keys found:', invalidKeys);
   ```

2. **Logout sonrası veriler temizlenmemeli**
   ```javascript
   const beforeLogout = await DebugHelper.viewUserData(userId);
   await logout();
   const afterLogout = await DebugHelper.viewUserData(userId);
   console.assert(
     JSON.stringify(beforeLogout) === JSON.stringify(afterLogout),
     'Data was modified during logout!'
   );
   ```

3. **Farklı kullanıcılar aynı cihazda sorunsuz çalışmalı**
   ```javascript
   await DebugHelper.checkDataIsolation(user1Id, user2Id);
   ```

4. **Tarih bazlı veriler doğru filtrelenmeli**
   ```javascript
   const todayData = await getDataForTimeRange('today');
   const weekData = await getDataForTimeRange('week');
   console.assert(
     todayData.length <= weekData.length,
     'Today data exceeds week data!'
   );
   ```

5. **Gamification profili günlük sıfırlanmalı**
   ```javascript
   const profile = await getGamificationProfile(userId);
   const lastActivityDate = new Date(profile.lastActivityDate);
   const today = new Date();
   if (lastActivityDate.toDateString() !== today.toDateString()) {
     console.assert(
       profile.healingPointsToday === 0,
       'Daily points not reset!'
     );
   }
   ```

---

## 📈 Test Sonuç Raporu Şablonu

```markdown
# ObsessLess Test Raporu - [Tarih]

## Özet
- **Toplam Test:** X
- **Başarılı:** Y
- **Başarısız:** Z
- **Atlandı:** W

## Detaylı Sonuçlar

### ✅ Başarılı Testler
1. Test Adı - Süre - Notlar

### ❌ Başarısız Testler
1. Test Adı - Hata - Çözüm Önerisi

### ⚠️ Uyarılar
1. Performans uyarıları
2. UI/UX önerileri

## Metrikler
- Ortalama başlangıç süresi: X ms
- Ortalama ekran geçiş: Y ms
- Bellek kullanımı: Z MB
- Test coverage: %W

## Öneriler
1. Öncelikli düzeltmeler
2. Performans iyileştirmeleri
3. UX geliştirmeleri
```

---

*Son güncelleme: Aralık 2024* 