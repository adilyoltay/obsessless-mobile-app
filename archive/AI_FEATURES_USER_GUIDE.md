Durum Notu (Ağustos 2025)\n\n- AI Chat: Kod tabanında UI/servis bulunmuyor (gelecek özellik).\n- Crisis Detection: Sistemden kaldırıldı (flag daima false).\n- Progress Analytics: PDF indirme ve bazı ileri raporlar plan/gelecek; mevcut temel metrikler aktif.\n\nGüncel Özellikler\n- Sesli Mood Check-in (STT, NLU, rota önerisi, PII maskeleme, Supabase senkron)\n- CBT Thought Record (taslak+kalıcı kayıt, i18n, reframe önerileri)\n- Breathwork (Pro UI, TTS/Haptik, seans kalıcılığı)\n- JITAI/Context Intelligence (temel, krizsiz)

# 🤖 **OBSESSLESS AI ÖZELLİKLERİ - KULLANICI TEST REHBERİ**

> **Bu doküman, ObsessLess uygulamasındaki AI destekli özellikleri test edecek kullanıcılar için hazırlanmıştır.**

---

## 📱 **GENEL BAKIŞ**

ObsessLess, OKB (Obsesif Kompulsif Bozukluk) ile mücadele eden bireyler için geliştirilmiş, **AI destekli** bir dijital terapi asistanıdır. Uygulama, modern yapay zeka teknolojilerini kullanarak kişiselleştirilmiş destek, gerçek zamanlı müdahaleler ve terapötik rehberlik sunar.

### **🎯 Test Amacı**
Bu test sürecinde, uygulamanın AI özelliklerinin:
- Kullanım kolaylığı
- Etkinliği
- Kişiselleştirme kalitesi
- Yanıt süreleri
- Kültürel uygunluğu değerlendirilecektir.

---

## 🚀 **AI DESTEKLİ ÖZELLİKLER**

### **1. 🧠 AI ONBOARDING (Akıllı Kayıt Süreci)**

#### **Ne İşe Yarar?**
Kayıt sürecinde AI, kullanıcıyı tanır ve kişiselleştirilmiş bir tedavi planı oluşturur.

#### **Nasıl Çalışır?**
1. **Y-BOCS Değerlendirmesi**: 10 soruluk OKB şiddet testi
2. **Profil Oluşturma**: Kişisel bilgiler, tercihler, kültürel faktörler
3. **AI Analizi**: Gemini AI kullanarak kişiselleştirilmiş profil
4. **Tedavi Planı**: Size özel hedefler ve stratejiler
5. **Güvenlik Planı**: Risk değerlendirmesi ve acil durum protokolleri

#### **Test Senaryosu**
```
1. Uygulamaya ilk girişte "AI Destekli Başla" butonuna tıklayın
2. Y-BOCS sorularına samimi cevaplar verin (5-10 dakika)
3. Profil bilgilerinizi girin (isim, yaş, meslek)
4. Kültürel tercihlerinizi belirtin
5. AI'nın oluşturduğu tedavi planını inceleyin
6. Güvenlik planını onaylayın
```

#### **Beklenen Sonuç**
- Kişiselleştirilmiş OKB profili
- 4 haftalık tedavi planı
- Günlük hedefler
- Acil durum protokolleri

---

### **2. 💬 AI CHAT (Terapötik Sohbet Asistanı)**

#### **Ne İşe Yarar?**
7/24 erişilebilir AI terapist ile anlık destek ve rehberlik alabilirsiniz.

#### **Nasıl Çalışır?**
- **CBT Teknikleri**: Bilişsel davranışçı terapi yöntemleri
- **Kriz Algılama**: Acil durum tespiti
- **Kültürel Duyarlılık**: Türk kültürüne uygun yanıtlar
- **Ses Desteği**: Sesli mesaj gönderme (yakında)

#### **Test Senaryosu**
```
1. Ana ekrandan "AI Asistan" butonuna tıklayın
2. Örnek mesajlar gönderin:
   - "Bugün çok kötü hissediyorum"
   - "Ellerimi yıkama dürtüsüne karşı koyamıyorum"
   - "Gece uyuyamıyorum, sürekli kontrol ediyorum"
3. AI'nın önerilerini uygulayın
4. Geri bildirim verin (👍/👎)
```

#### **Beklenen Sonuç**
- 2-3 saniye içinde yanıt
- Empatik ve yapıcı öneriler
- Pratik egzersiz yönergeleri
- Kriz durumunda acil yönlendirme

---

### **3. 🎯 ADAPTIVE INTERVENTIONS (Bağlama Duyarlı Müdahaleler)**

#### **Ne İşe Yarar?**
Bulunduğunuz yer, zaman ve ruh halinize göre otomatik öneri sistemi.

#### **Nasıl Çalışır?**
- **Konum Analizi**: Ev/iş/dışarıda farklı öneriler
- **Zaman Duyarlılığı**: Sabah/akşam/gece özel egzersizler
- **Aktivite Takibi**: Son kompulsiyonlara göre müdahale

#### **Test Senaryosu**
```
1. Konum iznini verin
2. Farklı zamanlarda uygulamayı açın:
   - Sabah 07:00: "Güne başlangıç rutini"
   - Öğlen 12:00: "İş arası rahatlama"
   - Akşam 19:00: "Tetikleyici saatler için önlemler"
   - Gece 23:00: "Uyku öncesi sakinleşme"
3. Önerilen egzersizleri deneyin
4. Etkinlik puanı verin
```

#### **Önerilen Egzersizler**
- **4-7-8 Nefes Tekniği**: Anksiyete için
- **5-4-3-2-1 Topraklama**: Panik için
- **Çay Meditasyonu**: Türk kültürüne özel
- **Dua/Zikir**: Manevi destek

---

### **4. 📊 PROGRESS ANALYTICS (İlerleme Analitiği)**

#### **Ne İşe Yarar?**
AI, verilerinizi analiz ederek ilerlemenizi takip eder ve tahminler yapar.

#### **Nasıl Çalışır?**
- **Trend Analizi**: 7/30/90 günlük grafikler
- **Pattern Tanıma**: Tetikleyici zamanlar ve durumlar
- **Tahminler**: "Önümüzdeki hafta riskli"
- **Hedef Ayarlama**: Otomatik zorluk düzenlemesi

#### **Test Senaryosu**
```
1. En az 7 gün düzenli veri girin
2. "İstatistikler" sekmesine gidin
3. AI analizlerini inceleyin:
   - "Akşam 19:00-21:00 arası %40 artış"
   - "Hafta sonları daha iyi"
   - "Uyku kalitesi düştükçe kompulsiyon artıyor"
4. Önerilen hedefleri kontrol edin
5. Haftalık raporu PDF olarak indirin
```

#### **Görüntülenecek Metrikler**
- Kompulsiyon sıklığı
- Direnç oranı
- Ruh hali skorları
- Egzersiz tamamlama
- Uyku kalitesi

---

### **5. 🚨 CRISIS DETECTION (Kriz Algılama)**

#### **Ne İşe Yarar?**
AI, davranış pattern'lerinizi izleyerek potansiyel kriz durumlarını önceden tespit eder.

#### **Nasıl Çalışır?**
- **Background Monitoring**: 15 dakikada bir analiz
- **Risk Skorlama**: 6 gösterge üzerinden değerlendirme
- **Otomatik Müdahale**: Risk seviyesine göre aksiyon

#### **Test Senaryosu**
```
1. Ayarlar > Güvenlik > Acil Kişiler'e gidin
2. En az 1 acil durum kişisi ekleyin:
   - Terapist
   - Aile üyesi
   - Yakın arkadaş
3. "Otomatik Bildirim" seçeneğini açın
4. Test için artan kompulsiyon verisi girin
5. AI'nın uyarılarını takip edin
```

#### **Risk Seviyeleri**
- **KRİTİK**: Acil müdahale, 112 hatırlatması
- **YÜKSEK**: Terapist bildirimi
- **ORTA**: Destekleyici mesaj
- **DÜŞÜK**: Önleyici egzersiz önerisi

---

### **6. 🎨 ART THERAPY (Sanat Terapisi)**

#### **Ne İşe Yarar?**
AI rehberliğinde sanat aktiviteleri ile duygusal ifade ve rahatlama.

#### **Nasıl Çalışır?**
- **Terapötik Yönergeler**: Adım adım sanat egzersizleri
- **Duygu Analizi**: Çizimlerinizden duygu tespiti
- **Kültürel Motifler**: Geleneksel Türk desenleri

#### **Test Senaryosu**
```
1. Ana ekrandan "Sanat Terapisi" seçin
2. Günlük ruh halinizi seçin
3. Önerilen aktiviteyi seçin:
   - Serbest çizim
   - Mandala boyama
   - Duygu haritası
   - Nefes görselleştirme
4. 10-15 dakika aktiviteyi tamamlayın
5. AI analizini inceleyin
```

---

### **7. 🔍 PATTERN RECOGNITION (Davranış Tanıma)**

#### **Ne İşe Yarar?**
AI, kompulsiyon pattern'lerinizi tanıyarak tetikleyicileri belirler.

#### **Nasıl Çalışır?**
- **Temporal Patterns**: Zaman bazlı tekrarlar
- **Environmental**: Çevre tetikleyicileri
- **Emotional**: Duygu durumu bağlantıları
- **Cultural**: Kültürel faktörler

#### **Test Senaryosu**
```
1. "Takip" ekranına gidin
2. En az 14 gün veri girin
3. "AI Pattern Analizi" butonuna tıklayın
4. Tespit edilen pattern'leri inceleyin:
   - "İş stresli günlerde %60 artış"
   - "Yalnız kalınca tetikleniyor"
   - "Sosyal etkinlik sonrası azalma"
5. Önerilen stratejileri uygulayın
```

---

## 🧪 **TEST SÜRECİ İÇİN ÖNEMLİ NOKTALAR**

### **✅ Test Edilmesi Gereken Durumlar**

1. **Farklı Saatlerde Kullanım**
   - Sabah rutini
   - İş saatleri
   - Akşam tetikleyici saatler
   - Gece/uyku öncesi

2. **Farklı Ruh Halleri**
   - Sakin dönemler
   - Stresli anlar
   - Kompulsiyon sonrası
   - Direnç başarısı sonrası

3. **Farklı Lokasyonlar**
   - Ev ortamı
   - İş yeri
   - Toplu taşıma
   - Sosyal ortamlar

4. **Kültürel Özellikler**
   - Türkçe dil kalitesi
   - Kültürel hassasiyetler
   - Dini/manevi öneriler
   - Geleneksel yaklaşımlar

### **📝 Geri Bildirim Alanları**

Test sürecinde şu konularda geri bildirim bekliyoruz:

1. **AI Yanıt Kalitesi**
   - Anlayış düzeyi
   - Öneri uygunluğu
   - Empati seviyesi
   - Kültürel duyarlılık

2. **Performans**
   - Yanıt süreleri
   - Uygulama hızı
   - Pil tüketimi
   - İnternet kullanımı

3. **Kullanılabilirlik**
   - Arayüz anlaşılırlığı
   - Navigasyon kolaylığı
   - Özellik erişimi
   - Hata mesajları

4. **Etkinlik**
   - Önerilerin işe yaraması
   - İlerleme hissi
   - Motivasyon artışı
   - Güven duygusu

---

## 🔒 **GİZLİLİK VE GÜVENLİK**

### **Verileriniz Güvende**
- Tüm kişisel veriler şifrelenir
- AI analizleri anonim yapılır
- Lokasyon verisi sadece cihazda kalır
- Acil kişiler sadece kriz durumunda bilgilendirilir

### **Kontrol Sizdedir**
- Tüm AI özelliklerini kapatabilirsiniz
- Verilerinizi istediğiniz zaman silebilirsiniz
- Hangi verilerin paylaşılacağını siz belirlersiniz

---

## 📞 **DESTEK**

Test sürecinde karşılaştığınız sorunlar için:

- **Uygulama İçi**: Ayarlar > Yardım > Sorun Bildir
- **E-posta**: support@obsessless.app
- **WhatsApp**: +90 XXX XXX XX XX (Test süresince aktif)

### **Sık Sorulan Sorular**

**S: AI özelliklerini nasıl kapatırım?**
C: Ayarlar > AI Özellikleri > Ana Anahtar

**S: Verilerim nerede saklanıyor?**
C: Hassas veriler cihazınızda, diğerleri şifreli bulutta

**S: AI yanlış öneri verirse ne yapmalıyım?**
C: Mesajın altındaki 👎 butonuna tıklayıp geri bildirim verin

**S: Kriz durumunda AI ne yapar?**
C: Acil kişileri bilgilendirir ve 112'yi aramanızı önerir

---

## 🎯 **TEST HEDEFLERİ**

Bu test sürecinde hedefimiz:
1. AI özelliklerinin gerçek hayatta işe yaradığını doğrulamak
2. Kültürel uygunluğu test etmek
3. Performans sorunlarını tespit etmek
4. Kullanıcı deneyimini iyileştirmek
5. Güvenlik açıklarını bulmak

**Katılımınız için teşekkür ederiz! Geri bildirimleriniz ObsessLess'i daha iyi hale getirmemize yardımcı olacak.** 💙

📱 Test Adımları:
1. İLK KONTROL:
Settings → Geliştirici Araçları → "AI Profil Durumunu Görüntüle"
2. FRESH START:
Settings → Geliştirici Araçları → "AI Onboarding'i Yeniden Başlat"
Uygulama yeniden yüklenecek ve onboarding'e yönlendirecek
3. ONBOARDİNG TESTİ:
13 Adımlık OnboardingFlowV3 → Master Prompt ilkeleriyle tek card design
Y-BOCS-10 Değerlendirmesi → 10 soru, slider ile tek aksiyon
Profil Oluşturma → Demographics, History, Symptoms, Culture, Goals
AI Tedavi Planı → Otomatik oluşturulacak
Safety Plan → Acil durum protokolleri
4. SONUÇ KONTROLÜ:
Settings → "AI Profil Durumunu Görüntüle" → ✅ Profil ve tedavi planı mevcut olmalı