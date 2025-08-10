# AI Production Test Checklist

## Hazırlık
- [ ] app.json `extra` içinde gerçek API anahtarı: `EXPO_PUBLIC_GEMINI_API_KEY`
- [ ] `EXPO_PUBLIC_ENABLE_AI=true`, `EXPO_PUBLIC_AI_PROVIDER=gemini`
- [ ] Supabase URL/Anon key tanımlı (public): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Cihaz dili otomatik kullanılır (TR cihazlar için Türkçe, diğerleri İngilizce). Ayarlarda dil seçeneği yok.

## Onboarding Doğrulama
- [ ] Uygulama açılışında Supabase üzerinden onboarding kontrolü yapılıyor (fallback: AsyncStorage)
- [ ] `ai_profiles.onboarding_completed` = true olduğunda tekrar onboarding’e yönlendirme yapılmıyor
- [ ] Ağ kesilince local fallback çalışıyor, tekrar çevrimiçi olunca Supabase ile eşitleniyor

## AIContext Senkronizasyonu
- [ ] `contexts/AIContext.tsx` Supabase’den `ai_profiles.profile_data` ve `ai_treatment_plans.plan_data` çekiyor
- [ ] Cihazlar arası profil/plan güncellemeleri UI’a yansıyor (pull → persist local)
- [ ] ERP ekranında plan/profil AIContext’ten gelmezse AsyncStorage fallback ile görüntülenir

## Treatment Planning Engine (Gerçek AI)
- [ ] `treatmentPlanningEngine` externalAIService ile plan metnini/amaçlarını rafine ediyor
- [ ] Telemetry’de `AI_RESPONSE_GENERATED` event’inde provider/model/latency/token raporlanıyor
- [ ] Hata durumunda graceful fallback var

## ERP Önerileri (Gerçek AI)
- [ ] `erpRecommendationService` externalAIService ile aday egzersizleri rafine ediyor
- [ ] Başarısızlıkta heuristik fallback devrede
- [ ] Öneri kartları yalnızca öneri sayısı > 0 olduğunda görünür
- [ ] Log’da “AI ERP recommendations loaded: N” doğrulanır (N > 0 beklenir)

## Telemetry & Güvenlik
- [ ] Sağlayıcı health check event’leri: `AI_PROVIDER_HEALTH_CHECK`, başarısızlık: `AI_PROVIDER_FAILED`
- [ ] Tüm AI eventleri `trackAIInteraction/trackAIError` ile loglanıyor (PII yok)
- [ ] Production’da gereksiz log yok (`__DEV__` ile sınırlı)

## Insights Engine V2
- [ ] 60 saniye cooldown uygulanır; bu sürede gelen çağrılar cache’den döner
- [ ] Veri gereksinimi: Bugüne ait en az 1 ERP oturumu ve birkaç kompulsiyon kaydı içgörü üretimini artırır
- [ ] Veri azsa “0 insights” normaldir; hata değildir (telemetri `success` fakat içerik 0)
- [ ] Telemetri: `INSIGHTS_REQUESTED`, `INSIGHTS_DELIVERED` olayları userId ve counts ile görünür

## Supabase Senkronizasyonu
- [ ] Onboarding bittiğinde `ai_profiles` ve `ai_treatment_plans` upsert ediliyor
- [ ] Ağ hatasında RetryQueue devreye giriyor, bağlantı gelince otomatik senkron
- [ ] Farklı cihazda login: Supabase’ten çekilen profil/plan local’e yazılıp UI güncelleniyor

## Sonuç
- [ ] Y-BOCS yorumları ve tedavi planı metinleri LLM’den geliyor (demo değil)
- [ ] ERP ekranında AI önerileri görünüyor ve seçilebiliyor
 - [ ] Today ekranında içgörüler veri yeterliyse görünür; 60 sn kuralı ve cache çalışır

# ✅ **AI ÖZELLİKLERİ TEST CHECKLIST**

> **Test kullanıcıları için adım adım kontrol listesi**

---

## 📱 **TEST ÖNCESİ HAZIRLIK**

- [ ] Uygulamayı en son versiyona güncelleyin
- [ ] İnternet bağlantınızın stabil olduğundan emin olun
- [ ] Konum servislerini açın
- [ ] Bildirim izinlerini verin
- [ ] Test süresince not alacağınız bir doküman hazırlayın

---

## 🚀 **ONBOARDING TESTİ (İlk 30 Dakika)**

### **Y-BOCS Değerlendirmesi**
- [ ] 10 sorunun tamamını cevaplayın
- [ ] Geri dönüp cevap değiştirmeyi deneyin
- [ ] İlerleme çubuğunun doğru çalıştığını kontrol edin
- [ ] Sonuç ekranında OKB şiddet seviyenizi görün
- [ ] **Not Alın**: Sorular anlaşılır mıydı? Çeviri hataları var mı?

### **Profil Oluşturma**
- [ ] Temel bilgileri girin (ad, yaş, cinsiyet, meslek)
- [ ] Tercihleri belirleyin (sabah/akşam, egzersiz türleri)
- [ ] Kültürel faktörleri seçin (dini pratikler, aile desteği)
- [ ] AI analiz süresini ölçün (kaç saniye?)
- [ ] **Not Alın**: Form alanları yeterli mi? Eksik seçenekler var mı?

### **Tedavi Planı İnceleme**
- [ ] Oluşturulan planı okuyun
- [ ] Hedeflerin gerçekçi olduğunu değerlendirin
- [ ] Önerilen egzersizleri kontrol edin
- [ ] Planı onaylayın veya düzenleme isteyin
- [ ] **Not Alın**: Plan kişiselleştirilmiş mi? Kültürel uygunluk var mı?

---

## 💬 **AI CHAT TESTİ (45 Dakika)**

### **Temel Konuşmalar**
- [ ] "Merhaba" ile başlayın
- [ ] Günlük durumunuzu anlatın
- [ ] Bir kompulsiyon deneyimi paylaşın
- [ ] Yardım isteyin
- [ ] **Not Alın**: Yanıt süresi, anlama kalitesi, empati seviyesi

### **Kriz Senaryoları**
- [ ] "Çok kötüyüm" yazın
- [ ] "Dayanamıyorum" mesajı gönderin
- [ ] Panik atak belirtileri tanımlayın
- [ ] AI'nın kriz algılama tepkisini gözlemleyin
- [ ] **Not Alın**: Acil yönlendirmeler yapıldı mı? Uygun mu?

### **Egzersiz Talepleri**
- [ ] "Nefes egzersizi öğret" deyin
- [ ] "Şu an sakinleşmem lazım" yazın
- [ ] Önerilen egzersizi uygulayın
- [ ] Geri bildirim verin (işe yaradı/yaramadı)
- [ ] **Not Alın**: Egzersiz açıklamaları net mi? Uygulanabilir mi?

### **Kültürel Hassasiyet**
- [ ] Dini/manevi destek isteyin
- [ ] Aile ile ilgili sorun paylaşın
- [ ] Kültürel bir tabu konusuna değinin
- [ ] AI'nın yaklaşımını değerlendirin
- [ ] **Not Alın**: Kültürel duyarlılık var mı? Yargılayıcı mı?

---

## 🎯 **ADAPTIVE INTERVENTIONS TESTİ (30 Dakika)**

### **Farklı Zamanlarda**
- [ ] Sabah 07:00 - Güne başlangıç önerisi alın
- [ ] Öğlen 12:00 - Ara verme egzersizi isteyin
- [ ] Akşam 19:00 - Tetikleyici saat uyarısı kontrol edin
- [ ] Gece 23:00 - Uyku öncesi rutin önerin
- [ ] **Not Alın**: Zamana uygun öneriler mi?

### **Farklı Lokasyonlarda**
- [ ] Evde iken öneri alın
- [ ] Dışarıda iken farklı öneri geldi mi?
- [ ] İş yerinde uygulanabilir egzersizler var mı?
- [ ] Toplu taşımada yapılabilecek teknikler önerildi mi?
- [ ] **Not Alın**: Lokasyon tespiti doğru mu? Öneriler uygun mu?

### **Egzersiz Etkinliği**
- [ ] 4-7-8 Nefes tekniğini deneyin
- [ ] 5-4-3-2-1 Topraklama yapın
- [ ] Çay meditasyonunu uygulayın
- [ ] Her egzersiz için 1-5 puan verin
- [ ] **Not Alın**: Hangi egzersiz en etkili? Neden?

---

## 📊 **PROGRESS ANALYTICS TESTİ (7 Gün Sonra)**

### **Veri Görselleştirme**
- [ ] Günlük grafikleri inceleyin
- [ ] Haftalık trendi kontrol edin
- [ ] En yoğun saatleri tespit edin
- [ ] İyileşme oranını görün
- [ ] **Not Alın**: Grafikler anlaşılır mı? Veriler doğru mu?

### **Pattern Analizi**
- [ ] Tespit edilen pattern'leri okuyun
- [ ] Tetikleyiciler mantıklı mı?
- [ ] Önerilen stratejileri değerlendirin
- [ ] En az bir öneriyi uygulayın
- [ ] **Not Alın**: Pattern'ler gerçekçi mi? Öneriler işe yarar mı?

### **Tahminler**
- [ ] Gelecek hafta risk tahminini görün
- [ ] Milestone tarihini kontrol edin
- [ ] Hedef ayarlamalarını inceleyin
- [ ] Motivasyon mesajlarını okuyun
- [ ] **Not Alın**: Tahminler gerçekçi mi? Motive edici mi?

---

## 🚫 **CRISIS DETECTION TESTİ (Kaldırıldı)**
Bu sürümde kriz tespiti runtime’dan kaldırılmıştır. İlgili testler uygulanmaz.

---

## 🎨 **ART THERAPY TESTİ (20 Dakika)**

### **Aktivite Seçimi**
- [ ] Mevcut ruh halinizi seçin
- [ ] Önerilen 3 aktiviteyi inceleyin
- [ ] Birini seçip başlayın
- [ ] Yönergeleri takip edin
- [ ] **Not Alın**: Aktiviteler ruh haline uygun mu?

### **Tamamlama**
- [ ] 10-15 dakika aktiviteyi yapın
- [ ] Sonuç analizini okuyun
- [ ] Duygusal değerlendirmeyi kontrol edin
- [ ] İlerleme puanınızı görün
- [ ] **Not Alın**: Analiz anlamlı mı? Terapötik değeri var mı?

---

## 🔍 **PATTERN RECOGNITION TESTİ (14 Gün Sonra)**

### **Veri Kalitesi**
- [ ] En az 14 günlük veri olduğunu doğrulayın
- [ ] Eksik günleri tamamlayın
- [ ] Farklı saatlerde veri girin
- [ ] Çeşitli kompulsiyon türleri ekleyin
- [ ] **Not Alın**: Veri girişi kolay mı? Eksik alanlar var mı?

### **Analiz Sonuçları**
- [ ] Temporal pattern'leri inceleyin
- [ ] Environmental faktörleri kontrol edin
- [ ] Behavioral bağlantıları değerlendirin
- [ ] Cultural pattern'leri (varsa) görün
- [ ] **Not Alın**: Analizler sizinle örtüşüyor mu?

---

## 🐛 **BUG VE SORUN TESPİTİ**

### **Performans**
- [ ] Uygulama açılış süresi: _____ saniye
- [ ] AI yanıt süresi: _____ saniye
- [ ] Sayfa geçiş hızı: Hızlı / Normal / Yavaş
- [ ] Pil tüketimi: Düşük / Normal / Yüksek
- [ ] İnternet kullanımı: Az / Normal / Çok

### **Hatalar**
- [ ] Uygulama çökmesi yaşandı mı? (Nerede/Ne zaman)
- [ ] Hata mesajları aldınız mı? (Ekran görüntüsü alın)
- [ ] Donma/takılma oldu mu? (Hangi ekranda)
- [ ] Veri kaybı yaşandı mı? (Ne tür veri)
- [ ] Senkronizasyon sorunları var mı?

### **Kullanılabilirlik**
- [ ] Anlaşılmayan butonlar/metinler var mı?
- [ ] Erişilemeyen özellikler var mı?
- [ ] Kafa karıştıran akışlar var mı?
- [ ] Eksik açıklamalar var mı?
- [ ] Çeviri hataları var mı?

---

## 📝 **GENEL DEĞERLENDİRME**

### **1-10 Puan Verin**
- [ ] AI yanıt kalitesi: _____/10
- [ ] Kişiselleştirme: _____/10
- [ ] Kültürel uygunluk: _____/10
- [ ] Kullanım kolaylığı: _____/10
- [ ] Güven verme: _____/10
- [ ] Etkinlik: _____/10
- [ ] Hız/Performans: _____/10
- [ ] Genel memnuniyet: _____/10

### **En Beğendiğiniz 3 Özellik**
1. _________________________________
2. _________________________________
3. _________________________________

### **En Çok Geliştirilmesi Gereken 3 Alan**
1. _________________________________
2. _________________________________
3. _________________________________

### **Uygulamayı Tavsiye Eder misiniz?**
- [ ] Kesinlikle evet
- [ ] Evet
- [ ] Kararsızım
- [ ] Hayır
- [ ] Kesinlikle hayır

**Neden?** _________________________________

---

## 💡 **ÖNERİLER VE FİKİRLER**

**Eklemek istediğiniz özellikler:**
_________________________________
_________________________________
_________________________________

**Değiştirilmesini istediğiniz şeyler:**
_________________________________
_________________________________
_________________________________

**Diğer yorumlar:**
_________________________________
_________________________________
_________________________________

---

## 📤 **TEST SONUÇLARINI GÖNDERME**

Test tamamlandığında lütfen:
1. Bu formu doldurun
2. Ekran görüntülerini ekleyin
3. Hata loglarını (varsa) ekleyin
4. support@obsessless.app adresine gönderin

**Test kodu:** TEST_2025_AI_V1
**Test tarihi:** _______________
**Cihaz modeli:** _______________
**iOS/Android versiyon:** _______________

---

**Test katılımınız için teşekkür ederiz! 🙏**

*Geri bildirimleriniz ObsessLess'i daha iyi hale getirmemize yardımcı olacak.*
