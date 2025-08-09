# ObsessLess AI Analiz Sistemi - Mantıksal Akış Zihin Haritası

Bu doküman, ObsessLess uygulamasının AI tabanlı analiz sistemlerinin mantıksal veri akışını ve modüller arası etkileşimini bir zihin haritası formatında açıklamaktadır.

## 🌳 Kök: ObsessLess AI Core

Sistemin merkezi, tüm AI operasyonlarını yöneten ve koordine eden çekirdektir.

### 📥 Kullanıcı Veri Girişi
Tüm analiz süreçleri, kullanıcının sağladığı çeşitli veri noktaları ile başlar.

- **Metin Mesajları:** Anlık sohbet üzerinden gelen yazılı ifadeler.
- **Kompülsiyon Kayıtları:** Kullanıcının manuel olarak girdiği kompülsiyon ve başa çıkma verileri.
- **Ruh Hali Günlüğü:** Günlük veya anlık duygu durumu kayıtları.
- **ERP Egzersizleri:** Maruz bırakma ve tepki önleme egzersizlerinin sonuçları.
- **Y-BOCS Test Sonuçları:** Belirli aralıklarla yapılan standart OKB değerlendirme testi sonuçları.
- **Davranışsal Veriler:** Uygulama içi gezinme, özellik kullanım sıklığı gibi pasif olarak toplanan veriler.

---

###  Katman 1: Anlık Analiz Katmanı
Bu katman, verileri anlık olarak işleyerek acil durumlara ve belirgin kalıplara odaklanır.

#### 🚨 CRISIS DETECTION (Kriz Tespiti)
- **Çalışma Zamanı:** Konuşma anında, her mesajla tetiklenir.
- **Girdi (Input):** Kullanıcının yazdığı metin mesajları.
- **Süreç (Process):**
  - **Anahtar Kelime Tespiti:** Önceden tanımlanmış (intihar, kendine zarar vb.) kritik kelimeleri tarar.
  - **Bağlamsal Analiz:** Mesajın genel anlamını ve konuşma geçmişini değerlendirir.
- **Çıktı (Output):** Risk Seviyesi (`Low`, `Moderate`, `High`, `Critical`).
- **Aksiyon (Action):**
  - Yüksek risk durumunda **Acil Durum Protokolü** başlatır.
  - `ADAPTIVE INTERVENTIONS` modülünü tetikler.

#### 🔍 PATTERN RECOGNITION V2 (Patern Tanıma)
- **Çalışma Zamanı:** Sürekli veya periyodik olarak arka planda çalışır.
- **Girdi (Input):** Tüm kullanıcı verileri (mesajlar, kayıtlar, davranışlar vb.).
- **Süreç (Process):**
  - **Kural Tabanlı Paternler:** Basit ve önceden tanımlanmış kalıpları bulur (örn. "Her sabah X kompülsiyonu").
  - **İstatistiksel Analiz:** Verideki anormal yoğunlaşmaları ve korelasyonları tespit eder.
  - **ML Modeli ile Derin Analiz:** Karmaşık ve gizli kalıpları ortaya çıkarır.
  - **Harici AI ile Keşif:** Beklenmedik ve yeni paternleri keşfetmek için büyük dil modellerini kullanır.
- **Çıktı (Output):** Tespit Edilen Paternler (`Davranışsal`, `Duygusal`, `Zamansal`, `Tetikleyici` vb.).

---

###  Katman 2: Derin Analiz & Değerlendirme Katmanı
Bu katman, uzun vadeli trendleri ve derinlemesine içgörüleri ortaya çıkarmak için verileri birleştirir.

#### 📈 PROGRESS ANALYTICS (İlerleme Analizi)
- **Çalışma Zamanı:** Periyodik olarak (örn. haftalık/aylık) çalışır.
- **Girdi (Input):**
  - `PATTERN RECOGNITION` sonuçları.
  - Y-BOCS skorları, kompülsiyon sıklığı gibi nicel veriler.
  - CBT beceri kullanım verileri.
- **Süreç (Process):**
  - **Kategori Bazlı Puanlama:** `Belirti Şiddeti`, `Bilişsel Esneklik`, `Yaşam Kalitesi` gibi alanlarda puanlama yapar.
  - **Genel İlerleme Skoru ve Trend:** Genel bir iyileşme skoru ve trendi (`Artıyor`, `Azalıyor`, `Sabit`) hesaplar.
  - **Geleceğe Yönelik Tahminler:** Potansiyel riskleri, koruyucu faktörleri ve etkili olabilecek müdahaleleri tahmin eder.
- **Çıktı (Output):** Kullanıcıya sunulan kapsamlı ilerleme raporu.

#### 🎨 ART THERAPY ENGINE (Sanat Terapisi Motoru)
- **Çalışma Zamanı:** Kullanıcı bir sanat terapisi seansı başlattığında çalışır.
- **Girdi (Input):**
  - Kullanıcının seçtiği duygu (`kaygı`, `huzur` vb.) ve terapötik hedef.
  - Kullanıcının dijital tuval üzerinde oluşturduğu sanat eseri.
- **Süreç (Process):**
  - **Görsel Analiz:** Renk psikolojisi, fırça darbeleri, şekiller ve kompozisyonu analiz eder.
  - **Duygusal İmza Tespiti:** Eserden baskın duyguyu, yoğunluğu ve enerjiyi (`pozitif`/`negatif`) çıkarır.
  - **Terapötik Göstergeleri Değerlendirme:** Kontrol, serbest bırakma, kaos gibi terapötik kavramları değerlendirir.
- **Çıktı (Output):** Sanat eserinin derinlemesine analizini içeren terapötik rapor.

---

###  Katman 3: Müdahale & Çıktı Katmanı
Bu katman, analiz sonuçlarını eyleme geçirerek kullanıcıya kişiselleştirilmiş destek sunar.

#### ⚡ ADAPTIVE INTERVENTIONS (JITAI - Duruma Özel Anlık Uyarlanabilir Müdahaleler)
- **Çalışma Zamanı:** Anlık bir tetikleyiciyle veya planlanmış olarak çalışır.
- **Girdi (Input):**
  - `CRISIS DETECTION`'dan gelen yüksek risk uyarıları.
  - `PATTERN RECOGNITION`'dan gelen müdahale fırsatları.
  - `Background Crisis Monitor`'den gelen davranışsal risk artışı sinyalleri.
  - Anlık Kullanıcı Bağlamı (Stres seviyesi, aktivite durumu, konum vb.).
- **Süreç (Process):**
  - **İhtiyaç ve Aciliyet Belirleme:** Anlık duruma en uygun müdahale ihtiyacını belirler.
  - **Optimal Müdahale Seçimi:** Yüzlerce müdahale arasından en uygun olanı seçer (örn. `Nefes Egzersizi`, `Bilişsel Yeniden Yapılandırma Sorusu`, `Dikkati Başka Yöne Çekme`).
  - **İçerik Kişiselleştirme:** Müdahalenin dilini ve sunumunu kullanıcı profiline göre ayarlar.
- **Çıktı (Output):** Kişiselleştirilmiş anlık müdahale (Bildirim, uygulama içi kart, sesli yönlendirme vb.).

#### 🛡️ Background Crisis Monitor (Arka Plan Kriz Monitörü)
- **Çalışma Zamanı:** Uygulama arka plandayken sürekli ve sessizce çalışır.
- **Girdi (Input):** Pasif olarak toplanan veriler (uyku düzeni, uygulama kullanım sıklığı, kompülsiyon girme hızı vb.).
- **Süreç (Process):** Zaman içindeki davranışsal değişimleri analiz ederek yavaş gelişen kriz risklerini tespit eder.
- **Çıktı (Output):** Riskli bir patern tespit ettiğinde `ADAPTIVE INTERVENTIONS` modülünü proaktif olarak tetikler.