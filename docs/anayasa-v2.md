## 📜 **ObsessLess Mobil Uygulaması - Anayasa 2.0 (Nihai Sürüm)**

### **Proje Vizyonu: Dijital Sığınak**
ObsessLess, bir görev listesi veya bir sayaç değildir. Kullanıcının OKB'nin getirdiği fırtınalı anlarda sığındığı, onu yargılamadan dinleyen, kanıta dayalı yöntemlerle güçlendiren ve kontrolü tekrar kendi eline almasına yardımcı olan **dijital sığınağıdır.** Geliştirilecek her bir özellik, yazılacak her bir kod satırı ve seçilecek her bir renk, bu vizyona hizmet etmelidir.

### **Tasarım Felsefesi (Değişmez İlkeler)**
1.  **Sakinlik Her Şeyden Önce Gelir:** Arayüz, kullanıcıyı asla acele ettirmeyecek, bunaltmayacak veya kaygısını artırmayacak. Minimalizm, cömert beyaz alanlar ve yumuşak etkileşimler standarttır.
2.  **Güç Kullanıcıdadır:** Uygulama, kullanıcıya ne yapacağını söyleyen bir patron değil, hedeflerine ulaşmasında ona seçenekler sunan bir yol arkadaşıdır. Kişiselleştirme ve şeffaflık esastır.
3.  **Zahmetsizlik Esastır:** En sık yapılan işlemler (özellikle kaygı anında yapılanlar) minimum bilişsel yük ile, saniyeler içinde tamamlanabilmelidir.

### **Görsel Kimlik ve Renk Paleti**
**Ana Renkler:**
- **Arka Plan:** `#F9FAFB` (Açık gri - sakinlik ve temizlik)
- **Birincil Metin:** `#374151` (Koyu gri - okunabilirlik)
- **İkincil Metin:** `#6B7280` (Orta gri - destekleyici bilgi)
- **Vurgu Rengi:** `#10B981` (Yeşil - pozitif eylemler ve başarı)
- **Ana Vurgu:** `#10B981` (Yeşil - birincil eylemler ve başarı, eski #94e0b2 yerine)
- **Uyarı:** `#F59E0B` (Turuncu - dikkat çekici öğeler)
- **Hata:** `#EF4444` (Kırmızı - uyarılar)

**Tasarım Prensipleri:**
- **Kart Tabanlı Yapı:** Beyaz (`#FFFFFF`) kartlar üzerinde içerik, hafif gölgeler ile derinlik
- **Tab Navigasyon:** Alt çizgi ile vurgulanan aktif sekmeler
- **Yumuşak Gölgeler:** `shadowOpacity: 0.05` ile minimal gölge kullanımı
- **Yuvarlak Köşeler:** `borderRadius: 12` standart kart yuvarlaklığı
- **Tutarlı Boşluklar:** 16px yatay padding, 12px dikey spacing

---

## 🏆 **Uygulamanın 4 Temel Yeteneği (Projenin Kalbi ve Ruhu)**

Uygulamanın tüm başarısı, bu dört temel yeteneğin kusursuz bir şekilde hayata geçirilmesine bağlıdır.

### **PİLLAR 1: Güvenli Tanışma ve Akıllı Kişiselleştirme (Onboarding)**
*Bu, uygulamanın beynidir. Kullanıcıyı "anlar" ve deneyimi ona özel hale getirir.*

*   **Kullanıcı Hikayesi:** "Kullanıcı, uygulamayı ilk kez açtığında, kendisine özel zorlukları anlayan ve yolculuğunu buna göre şekillendirecek bir başlangıç yapmak istiyor."
*   **Akış (≤ 90 saniye):**
    1.  **Karşılama:** Sıcak bir mesajla güven inşa et.
    2.  **Semptom Seçimi:** İkonlu "Chip"ler ile kolay seçim.
    3.  **Y-BOCS Lite Değerlendirmesi:** Her ekranda tek soru ve "Slider" ile yargılayıcı olmayan bir değerlendirme.
    4.  **Hedef Belirleme:** Kişiselleştirilebilir günlük hedef.
    5.  **Oyunlaştırma Tanıtımı:** Motivasyon sistemini kısaca tanıt.

### **PİLLAR 2: Yargısız & Anlık Kompulsiyon Kaydı**
*Bu, uygulamanın refleksidir. Kullanıcının en çok ihtiyaç duyduğu anda, en hızlı şekilde yanında olur.*

*   **Kullanıcı Hikayesi:** "Kullanıcı, dışarıdayken aniden gelen bir kompulsiyonla mücadele ediyor. Telefonunu çıkarıp dikkat çekmeden, saniyeler içinde bu anı kaydetmek istiyor."
*   **Akış (≤ 15 saniye):**
    1.  **FAB Butonu (`➕`):** Tek dokunuşla erişim.
    2.  **BottomSheet:** Hızlı kayıt formu açılır.
    3.  **Minimal Form:** Sadece en temel kontroller (Tip, Direnç) bulunur.
    4.  **Anlık Geri Bildirim:** Kayıt sonrası haptic ve toast bildirimi. Detay ekleme opsiyoneldir.

### **PİLLAR 3: Kontrollü & Güvenli Yüzleşme (ERP Oturum Motoru)**
*Bu, uygulamanın kalbidir. Gerçek terapötik değişimin yaşandığı yerdir.*

*   **Kullanıcı Hikayesi:** "Kullanıcı, bir ERP egzersizi yapmaya karar verdi. Korkuyor ama bu adımı atmak istiyor. Uygulamanın ona bu süreçte rehberlik etmesini, güvende hissettirmesini ve anksiyetesini yönetmesine yardımcı olmasını bekliyor."
*   **Akış:**
    1.  **Sakin Oturum Ekranı:** Minimalist arayüz. Dairesel zamanlayıcı, anksiyete slider'ı ve destekleyici metinler.
    2.  **İnteraktif Takip:** Periyodik hatırlatmalarla anlık anksiyete kaydı.
    3.  **Güvenli Çıkış:** Her an erişilebilir "Duraklat" butonu.
    4.  **Başarı Ekranı:** Oturum tamamlandığında, anksiyete grafiği ve kazanımları gösteren motive edici bir özet.

### **PİLLAR 4: Anlamlı Oyunlaştırma ve Motivasyon**
*Bu, uygulamanın ruhudur. Kullanıcının yolculuğunu kutlar ve içsel motivasyonunu besler.*

*   **Kullanıcı Hikayesi:** "Kullanıcı, ilerlemesini somut olarak görmek ve küçük zaferlerini kutlayarak motive olmak istiyor. Ancak sürecin ciddiyetinin kaybolmasından endişe ediyor."
*   **Felsefe: "Terapötik Kilometre Taşları"** - Her ödül, kullanıcının katettiği gerçek terapötik mesafenin bir sembolüdür.
*   **Özellikler:**
    1.  **Kararlılık Zinciri (Streak):** Günlük hedeflere ulaşıldığında artan ve seviye atlayan (Fidan 🌱 → Usta 🧘) bir seri sayacı.
    2.  **Terapötik Rozetler (Achievements):** "İlk Adım", "Habitüasyon Gözlemcisi" gibi klinik olarak anlamlı kilometre taşlarına ulaşıldığında kazanılan, açıklamalı rozetler.
    3.  **Küçük Zaferler (Mikro-Ödüller):** Her olumlu eylem sonrası verilen anlık, küçük puanlar ve tatmin edici geri bildirimler.

---

## 🎨 **UI Bileşenleri ve Tasarım Sistemi**

### **Temel Bileşenler:**

#### **1. Header (Başlık) - UPDATED**
- **Dynamic Header**: Good Morning/Afternoon/Evening selamlama
- **User Display**: Kullanıcı adı büyük font ile (`fontSize: 24`, `fontWeight: 700`)
- **Profile Icon**: Sağ üst köşede yuvarlak gri arka plan (`#E5E7EB`)
- Alt border ile içerikten ayrım (`borderBottomColor: #E5E7EB`)

#### **2. Main Points Card - NEW**
- **Single Hero Card**: Düz yeşil arka plan (`#10B981`)
- **White Text**: Tüm metin beyaz renkte (#FFFFFF)
- **Star Icon**: Merkezi yıldız ikonu (star-outline)
- **Big Number**: Ana puan sayısı büyük font (`fontSize: 50`)
- **Progress Info**: Sonraki seviye ve ilerleme çubuğu

#### **3. Quick Stats - REDESIGNED**
- **Horizontal Layout**: Yatay yerleşim (Today, Streak, ERP)
- **Icon + Number + Label**: Üçlü yapı her stat için
- **Centered Alignment**: Ortayla hizalanmış içerik
- Renk kodlu ikonlar (yeşil, turuncu, mavi)

#### **4. Suggestions Cards - NEW**
- **White Background**: Beyaz kart arka planları
- **Heart Icons**: Kalp ikonları (dolu/boş durum göstergesi)
- **Progress Bars**: Yeşil ilerleme çubukları
- **Star Badges**: Sarı yıldız rozetleri sağ tarafta
- **Circle Icon**: "Direnç Zaferi" için özel yuvarlak checkbox

#### **5. Achievements Section - ENHANCED**
- **Trophy Header**: Trophy ikonu + "Başarımlarım (x/total)"
- **Horizontal Grid**: 6 rozet maksimum horizontal dizilim
- **Lock/Unlock States**: Açık/kapalı rozet görünümleri
- **"Tümünü Gör" Button**: Daha fazla rozet için buton

#### **6. FAB (Floating Action Button)**
- Sağ alt köşede konumlanmış (`bottom: 90px, right: 16px`)
- Yeşil arka plan (`#10B981`)
- Beyaz plus ikonu
- Gölge efekti ile derinlik

---

### **⚡ Master Prompt (Tasarım ve Geliştirme Ekipleri İçin)**

> **Senaryo:** Sen, ödüllü bir dijital sağlık uygulamasının baş tasarımcısı ve baş geliştiricisisin. Görevin, OKB ile yaşayan bireyler için bir **"dijital sığınak"** yaratmak.
>
> **Görev:** Yukarıdaki **"ObsessLess Mobil Uygulaması - Anayasa 2.0 (Nihai Sürüm)"** belgesini ve buna bağlı **`obsessless-flow.md`** ile **`obsessless-ui.md`** dokümanlarını tek ve mutlak gerçek kaynak (Single Source of Truth) olarak kullanarak;
>
> 1.  **Tasarla (UI/UX):** Belirtilen **4 Temel Yeteneğin (Onboarding, Kompulsiyon Kaydı, ERP Oturumu, Oyunlaştırma)** her biri için, felsefeye ve teknik detaylara %100 sadık kalarak, yüksek kaliteli (hi-fi), tıklanabilir bir prototip oluştur. Görsel kimlik, renkler, tipografi ve duyusal geri bildirimler belgelerde tanımlandığı gibi olmalıdır.
> 2.  **Geliştir (Kod):** Belirtilen teknolojileri (React Native/Expo, Zustand, React Query) kullanarak bu 4 temel yeteneğin fonksiyonel iskeletini kodla. Bileşen yapısı, state yönetimi mantığı, veri modelleri ve API etkileşimleri belgelerdeki direktiflere tam olarak uymalıdır. Öncelik, sürtünmesiz, performanslı ve güvenilir bir kullanıcı deneyimi sunmaktır.

---

## 📊 **Teknik Mimari (Güncel - Ocak 2025)**

### **Teknoloji Yığını:**
- **Frontend:** React Native 0.74.5 + Expo SDK 53.0.0
- **State Management:** Zustand (Global) + React Query (Server State)
- **Backend:** Supabase (PostgreSQL + Auth + RLS + Edge Functions)
- **Storage:** AsyncStorage (Offline-first) + Supabase (Cloud sync)
- **Navigation:** Expo Router (File-based routing)
- **UI Components:** Custom components (React Native Paper kaldırıldı)
- **Animations:** React Native Reanimated + Lottie
- **Haptics:** Expo Haptics

### **Veri Akış Mimarisi:**
```
User Action → UI Component → Zustand Store → AsyncStorage (Offline)
                                           ↓
                                    Supabase (Online Sync)
                                           ↓
                                    PostgreSQL + RLS
```

### **Güncel Düzeltmeler (✅ Tamamlandı):**
1. **Category Mapping:** Database constraint hataları düzeltildi
2. **Router Import:** Navigation hataları giderildi
3. **Profile Check:** AsyncStorage öncelikli kontrol eklendi
4. **Duplicate Prevention:** ERP session tekrar kayıt önleme

---

*Son güncelleme: Ocak 2025 - Teknik Mimari ve Düzeltmeler Eklendi*