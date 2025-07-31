# 📱 ObsessLess UI Mockups & Görsel Tasarım (v3 - Master Prompt İlkeleri)

## 📱 Uygulama Bilgileri

```
┌─────────────────────────────────────────────────────┐
│                UYGULAMA BİLGİLERİ                   │
├─────────────────────────────────────────────────────┤
│ Uygulama Adı     │ ObsessLess (obslessless-clean)    │
│ Bundle ID        │ com.adilyoltay.obslesstest        │
│ URL Scheme       │ obslesstest://                    │
│ Platform         │ iOS 15.0+ / Android 5.0+         │
│ React Native     │ 0.74.5                           │
│ Expo SDK         │ ~51.0.0                          │
│ TypeScript       │ 5.1.3                            │
└─────────────────────────────────────────────────────┘
```

## 🏛️ Master Prompt Tasarım İlkeleri

### 🌿 **1. Sakinlik Her Şeyden Önce Gelir**
- **Minimalizm**: Gereksiz öğelerden arınmış, temiz arayüzler
- **Beyaz Alan**: Cömert padding ve margin değerleri (min. 16px)
- **Yumuşak Geçişler**: Ani değişimler yerine smooth animasyonlar
- **Pastel Tonlar**: Keskin renkler yerine yumuşak, sakinleştirici tonlar

### 💪 **2. Güç Kullanıcıdadır**
- **Şeffaflık**: Her işlemin ne yaptığı açıkça belirtilir
- **Kişiselleştirme**: Kullanıcı deneyimini özelleştirebilme
- **Kontrol**: Kullanıcı her zaman ne olduğunu bilir ve kontrolü elinde tutar
- **Seçenekler**: Dayatma yerine alternatifler sunulur

### ⚡ **3. Zahmetsizlik Esastır**
- **Hızlı Erişim**: En sık kullanılan özellikler 1-2 tıkla erişilebilir
- **Büyük Dokunma Alanları**: Minimum 48x48px dokunma hedefleri
- **Akıllı Varsayılanlar**: Son kullanılan seçenekler hatırlanır
- **Minimal Bilişsel Yük**: Aynı anda maksimum 3-4 seçenek sunulur

---

## 🎨 Renk Paleti

```
┌─────────────────────────────────────────────────────┐
│                    RENK PALETİ                      │
├─────────────────────────────────────────────────────┤
│ Primary Green    │ #10B981 │ ████████ │ Ana renk   │
│ Light Green      │ #F0FDF4 │ ████████ │ Arka plan  │
│ Dark Gray        │ #111827 │ ████████ │ Başlıklar  │
│ Medium Gray      │ #6B7280 │ ████████ │ Alt metin  │
│ Light Gray       │ #E5E7EB │ ████████ │ Çizgiler   │
│ Error Red        │ #EF4444 │ ████████ │ Hata       │
│ Warning Orange   │ #F59E0B │ ████████ │ Uyarı      │
│ Epic Purple      │ #8B5CF6 │ ████████ │ Epic rozet │
│ Rare Blue        │ #3B82F6 │ ████████ │ Rare rozet │
└─────────────────────────────────────────────────────┘
```

## 📐 Tipografi

```
┌─────────────────────────────────────────────────────┐
│                    TİPOGRAFİ                        │
├─────────────────────────────────────────────────────┤
│ Font Family: Inter                                  │
├─────────────────────────────────────────────────────┤
│ Başlık XL    │ 32px │ Bold (700)    │ #111827      │
│ Başlık L     │ 28px │ Bold (700)    │ #111827      │
│ Başlık M     │ 24px │ SemiBold (600)│ #111827      │
│ Başlık S     │ 20px │ SemiBold (600)│ #111827      │
│ Body L       │ 18px │ Regular (400) │ #111827      │
│ Body M       │ 16px │ Regular (400) │ #6B7280      │
│ Body S       │ 14px │ Regular (400) │ #6B7280      │
│ Caption      │ 12px │ Regular (400) │ #9CA3AF      │
└─────────────────────────────────────────────────────┘
```

---

## 📱 Onboarding Mockups

### 1️⃣ Karşılama Ekranı

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │ Status Bar
├─────────────────────────────────────┤
│                                     │
│     ● ━━━ ○ ○ ○                   │ Progress
│                                     │
│                                     │
│            🤝                       │ 120px icon
│          (yeşil)                    │
│                                     │
│                                     │
│     Merhaba Adil 👋                │ 28px Bold
│                                     │
│   Seni daha iyi tanımamıza ve      │ 16px Regular
│   en doğru desteği sunmamıza       │ Gray
│   yardımcı olacak birkaç kısa      │
│         adımımız var.               │
│                                     │
│     ⏱️ Yaklaşık 90 saniye          │ 14px Green
│                                     │
│                                     │
│                                     │
│                                     │
│    ┌─────────────────────────┐     │
│    │      Başlayalım         │     │ 56px height
│    └─────────────────────────┘     │ Green BG
│                                     │
│                                     │
└─────────────────────────────────────┘
```

### 2️⃣ Semptom Seçimi

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │
├─────────────────────────────────────┤
│                                     │
│     ● ● ━━━ ○ ○                   │
│                                     │
│   Hangi temalar seni daha çok      │ 24px SemiBold
│         etkiliyor?                  │
│                                     │
│   Bir veya birkaçını seçebilirsin  │ 16px Gray
│                                     │
│   ┌──────────┐   ┌──────────┐     │
│   │ 🧼       │   │ 🔍       │     │ Chips
│   │ Bulaşma  │   │ Kontrol  │     │ Selected: 
│   └──────────┘   └──────────┘     │ Green BG
│                                     │
│   ┌──────────┐   ┌──────────┐     │
│   │ 📐       │   │ 🔢       │     │
│   │ Simetri  │   │ Sayma    │     │
│   └──────────┘   └──────────┘     │
│                                     │
│   ┌──────────┐   ┌──────────┐     │
│   │ 🧠       │   │ 📦       │     │
│   │ Zihinsel │   │Biriktirme│     │
│   └──────────┘   └──────────┘     │
│                                     │
│ ┌────────┐     ┌────────────────┐ │
│ │  Geri  │     │     Devam      │ │ Buttons
│ └────────┘     └────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### 3️⃣ Y-BOCS Değerlendirme

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │
├─────────────────────────────────────┤
│                                     │
│     ● ● ● ━━━ ○                   │
│   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │ Progress Bar
│                                     │
│            Soru 3 / 10              │ 14px Gray
│                                     │
│   Obsesif düşünceleriniz ne        │ 20px SemiBold
│   kadar sıkıntı veriyor?           │
│                                     │
│                                     │
│                                     │
│              2                      │ 32px Bold
│                                     │ Green
│      ○━━━━━━━●━━━━━━━○            │ Slider
│                                     │
│   Hiç    Az    Orta   Çok   Aşırı │ 12px Labels
│                                     │
│                                     │
│                                     │
│                                     │
│ ┌────────┐     ┌────────────────┐ │
│ │  Geri  │     │     Devam      │ │
│ └────────┘     └────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### 4️⃣ Hedef Belirleme & Özet

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │
├─────────────────────────────────────┤
│                                     │
│     ● ● ● ● ━━━                   │
│                                     │
│   ┌─────────────────────────────┐ │
│   │         🛡️                   │ │ Light Green
│   │                             │ │ Background
│   │   Değerlendirme Tamamlandı  │ │
│   │                             │ │
│   │  Şu anki durumun 'Orta'    │ │ Orange Text
│   │    düzeyde görünüyor        │ │
│   │                             │ │
│   │ Unutma, bu sadece bir       │ │ 14px Gray
│   │ başlangıç noktası ve        │ │
│   │ birlikte ilerleyeceğiz.     │ │
│   └─────────────────────────────┘ │
│                                     │
│   Günlük hedefini belirleyelim     │ 18px SemiBold
│                                     │
│   Günde kaç egzersiz yapmak        │ 14px Gray
│         istersin?                   │
│                                     │
│      ┌───┐   ┌───┐   ┌───┐        │ Stepper
│      │ - │   │ 3 │   │ + │        │ 32px Bold
│      └───┘   └───┘   └───┘        │
│                                     │
│         ┌────────────────┐         │
│         │     Başla      │         │
│         └────────────────┘         │
└─────────────────────────────────────┘
```

### 5️⃣ Oyunlaştırma Tanıtımı (Yeni Ekran)

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │
├─────────────────────────────────────┤
│                                     │
│     ● ● ● ● ●                     │
│                                     │
│            🏆                       │ 120px icon
│          (turuncu)                  │
│                                     │
│                                     │
│     Yolculuğunu Kutlayalım         │ 28px Bold
│                                     │
│   İlerlemeni takip etmek ve        │ 16px Regular
│   başarılarını kutlamak için       │ Gray
│   küçük rozetler ve seriler        │
│         kullanacağız.               │
│                                     │
│   Her kompulsiyon kaydı ve ERP     │
│   egzersizi seni daha da           │
│        güçlendirecek!               │
│                                     │
│     ┌─────┐ ┌─────┐ ┌─────┐       │
│     │ 🔥  │ │ ✨  │ │ 🏅  │       │ Feature
│     │     │ │     │ │     │       │ Icons
│     └─────┘ └─────┘ └─────┘       │
│     Günlük  İyileşme Terapötik     │
│     Seriler  Puanları  Rozetler    │
│                                     │
│    ┌─────────────────────────┐     │
│    │   Harika, Başlayalım!   │     │ 56px height
│    └─────────────────────────┘     │ Green BG
│                                     │
└─────────────────────────────────────┘
```

---

## 📱 Ana Ekran (Today) - Gamification Odaklı

### Hero Section

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │ Status Bar
├─────────────────────────────────────┤
│                                     │
│  ╔═════════════════════════════╗   │
│  ║         🔥 5 Gün            ║   │ Gradient BG
│  ║                             ║   │ #10B981→#059669
│  ║          ⭐                 ║   │
│  ║         1,250               ║   │ 48px Bold
│  ║    Healing Points           ║   │ 18px Medium
│  ║                             ║   │
│  ║  Sonraki: Uzman             ║   │ 16px
│  ║  1,250 / 2,500              ║   │ #FEF3C7
│  ║  ▓▓▓▓▓▓░░░░░░░ 50%         ║   │ Progress Bar
│  ╚═════════════════════════════╝   │
│                                     │
├─────────────────────────────────────┤
│  ┌─────────┬─────────┬─────────┐   │ Quick Stats
│  │   250   │    5    │    2    │   │ White BG
│  │  Bugün  │  Seri   │   ERP   │   │ 24px Bold
│  └─────────┴─────────┴─────────┘   │ 14px Regular
│                                     │
├─────────────────────────────────────┤
│  🎯 Günlük Görevler                 │ 18px SemiBold
│                                     │
│  ┌─────────────────────────────┐   │ Mission Card
│  │ ✓  Kompulsiyon Takibi    +50│   │ #E0F2F7 (done)
│  │    3 kompulsiyon kaydet      │   │ #F9FAFB (pending)
│  │    ▓▓▓▓▓▓▓▓▓▓ 3/3          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ○  ERP Egzersizi        +100│   │
│  │    1 egzersiz tamamla        │   │
│  │    ░░░░░░░░░░ 0/1          │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ○  Direnç Zaferi         +75│   │
│  │    2 kez yüksek direnç       │   │
│  │    ▓▓▓▓▓░░░░░ 1/2          │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│  ○  ○  ●  ○  ○                     │ Tab Bar
└─────────────────────────────────────┘
```

### Renk Kullanımı

- **Hero Gradient:** `#10B981` → `#059669`
- **Hero Text:** `#FEF3C7` (Açık sarı)
- **Tamamlanan Görev:** `#E0F2F7` bg, `#10B981` border
- **Bekleyen Görev:** `#F9FAFB` bg
- **Progress Bar:** `#10B981` (dolu), `#E5E7EB` (boş)
- **Ödül Badge:** `#F5F3FF` bg, `#8B5CF6` text

### Animasyonlar

1. **Sayfa Girişi:**
   - Hero section: `fadeIn` + `scale(0.9 → 1)`
   - Süre: 600ms fade, spring animation

2. **Görev Tamamlama:**
   - Check animasyonu
   - Kart renk geçişi
   - Haptic feedback

3. **Progress Update:**
   - Smooth transition
   - Sayı animasyonu

---

## ⚡ Kompulsiyon Kaydı Mockups (Gelişmiş Sürüm)

### 🔘 FAB Butonu (Ana Ekranda)

```
┌─────────────────────────────────────┐
│                                     │
│         [Ana Ekran İçeriği]         │
│                                     │
│                                     │
│                                     │
│                                     │
│                                     │
│                              ┌───┐ │ 56x56px
│                              │ + │ │ #10B981
│                              └───┘ │ Shadow: 8
│                               FAB   │ 24px margin
└─────────────────────────────────────┘

Mikro-Ödül: +12 ✨ "Hızlı kayıt!" (her kullanımda)
Haptic: Light impact feedback
```

### 📋 Gelişmiş BottomSheet - Akıllı Öneriler

```
┌─────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ Dimmed BG
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
├─────────────────────────────────────┤
│         ━━━━━━━━━━━━━               │ Handle
│                                     │
│       Kompulsiyon Kaydı            │ 24px Bold
│                                     │
│ 💡 Sık Yaşadıkların                │ 16px + Warning icon
│ ┌─────────────┐ ┌─────────────┐   │ Smart chips
│ │ 🧼 Temizlik │ │ 🔍 Kontrol  │   │ with "Sık"
│ │     "Sık"   │ │     "Sık"   │   │ badges
│ └─────────────┘ └─────────────┘   │
│                                     │
│ 📝 Son Yaşadığın                   │ 16px + History icon
│ ┌─────────────┐                   │ Single chip
│ │ 🔢 Sayma    │                   │ from last
│ └─────────────┘                   │ entry
│                                     │
│ 📋 Tüm Tipler                      │ 16px + List icon
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │ Segmented
│ │ 🧼  │ │ 🔍  │ │ 🔢  │ │ 📐  │   │ Buttons
│ └─────┘ └─────┘ └─────┘ └─────┘   │ Traditional
│                                     │ layout
│         ┌─────┐ ┌─────┐             │
│         │ 🧠  │ │ ❓  │             │
│         └─────┘ └─────┘             │
│                                     │
│    Direnç Gücün        💪 7/10     │ Dynamic emoji
│                                     │ + color coding
│    ○━━━━━━━━●━━━━━○               │ Green slider
│    Zayıf    Orta    Güçlü         │ (≥8 = +15✨)
│                                     │
│ ⏰ Hatırlatma Kur                   │ NEW: Scheduling
│ ┌─────┐ ┌─────┐ ┌─────┐           │ Quick options
│ │15 dk│ │1 saat│ │Yarın│           │ Each = +8✨
│ └─────┘ └─────┘ └─────┘           │
│                                     │
│         ┌───────────────┐          │
│         │   ✓ Kaydet    │          │ 56px height
│         └───────────────┘          │ Dynamic color
│                                     │
│  💡 Her kayıt, farkındalığını      │ 13px Italic
│     artırır ve iyileşme sürecine   │ Info color
│        katkı sağlar.               │
│                                     │
└─────────────────────────────────────┘
```

### 🎮 Gelişmiş Mikro Ödül Animasyonları

```
FAB Press Senaryosu:

        ┌─────────────────┐
        │   +12 ✨        │  (Fade in + Scale)
        │ Hızlı kayıt!    │
        └─────────────────┘
              ↑
              │
        [FAB Butonu]
              │
              ↑ (Yukarı kayma)
              │
        (1.5 saniye sonra fade out)

Akıllı Öneriler Kombinasyonu:

        ┌─────────────────┐
        │   +12 ✨        │  (Quick Entry)
        └─────────────────┘
              ↓ (0.3s delay)
        ┌─────────────────┐
        │   +18 ✨        │  (Pattern Recognition)
        │ Örüntü farkı!   │
        └─────────────────┘
              ↓ (0.3s delay)
        ┌─────────────────┐
        │   +15 ✨        │  (High Resistance)
        │ Güçlü direnç!   │
        └─────────────────┘

Toplam: 45 ✨ (Cascade animation)
```

### 🧠 Akıllı Öneriler UI Detayları

#### **1. Sık Yaşananlar Bölümü**
```
┌─────────────────────────────────────┐
│ 💡 Sık Yaşadıkların                │ Section header
├─────────────────────────────────────┤ with lightbulb
│                                     │
│ ┌─────────────┐ ┌─────────────┐   │ Suggestion chips
│ │ 🧼 Temizlik │ │ 🔍 Kontrol  │   │ with icons
│ │             │ │             │   │
│ │   ┌─────┐   │ │   ┌─────┐   │   │ "Sık" badges
│ │   │ Sık │   │ │   │ Sık │   │   │ (top-right)
│ │   └─────┘   │ │   └─────┘   │   │ Orange bg
│ └─────────────┘ └─────────────┘   │
│                                     │
│ Seçildiğinde:                      │
│ ┌─────────────┐                   │ Selected state
│ │ 🧼 Temizlik │ ← Green bg        │ with white text
│ │   (beyaz)   │   White text      │
│ └─────────────┘                   │
└─────────────────────────────────────┘

Interaction:
- Tap → Haptic Light
- Visual feedback → Scale 0.95 → 1.0
- Auto-scroll to resistance slider
```

#### **2. Son Yaşanan Bölümü**
```
┌─────────────────────────────────────┐
│ 📝 Son Yaşadığın                   │ History icon
├─────────────────────────────────────┤ Gray color
│                                     │
│ ┌─────────────────────────────────┐ │ Single chip
│ │ 🔢 Sayma                        │ │ from last entry
│ │                                 │ │
│ │ Son: 2 saat önce               │ │ Timestamp
│ │ Direnç: 6/10                   │ │ Last resistance
│ └─────────────────────────────────┘ │
│                                     │
│ Özellik: Tek dokunuşla seçim      │ One-tap selection
│ → Direnç otomatik doldurulur       │ Pre-fill resistance
│ → 5 saniyede kayıt tamamlanır      │ Ultra-fast entry
└─────────────────────────────────────┘
```

#### **3. Direnç Sistemi - Gelişmiş**
```
┌─────────────────────────────────────┐
│    Direnç Gücün        💪 7/10     │ Dynamic header
├─────────────────────────────────────┤
│                                     │
│ Seviye 1-3: 😰 Kırmızı (#EF4444)  │ Color coding
│ Seviye 4-6: 😐 Turuncu (#F59E0B)  │ with emojis
│ Seviye 7-10: 💪 Yeşil (#10B981)   │
│                                     │
│    ○━━━━━━━━●━━━━━○               │ Animated slider
│    Zayıf    Orta    Güçlü         │ with haptic
│                                     │
│ Özel Durumlar:                     │
│ • ≥8 Direnç → +15 ✨ bonus        │ High resistance
│ • Direnç artışı → +22 ✨ gelişim  │ Improvement detection
│ • Slider değişimi → Haptic Light   │ Immediate feedback
└─────────────────────────────────────┘
```

#### **4. Hızlı Zamanlama Sistemi**
```
┌─────────────────────────────────────┐
│ ⏰ Hatırlatma Kur                   │ Clock icon
├─────────────────────────────────────┤ 16px Bold
│                                     │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐│ Three options
│ │ ⏰ 15dk │ │ ⏰ 1saat│ │📅 Yarın││ with icons
│ │         │ │         │ │         ││
│ │ +8 ✨  │ │ +8 ✨  │ │ +8 ✨  ││ Each gives
│ └─────────┘ └─────────┘ └─────────┘│ points
│                                     │
│ Seçildiğinde:                      │
│ • Haptic Light feedback            │ Immediate response
│ • "Hatırlatma ayarlandı! 📅"      │ Confirmation alert
│ • Mikro-ödül animasyonu            │ +8 ✨ animation
│                                     │
│ Hafta sonu bonusu: x2 puan         │ Weekend multiplier
└─────────────────────────────────────┘
```

### 📊 Akıllı Analiz Göstergeleri

#### **Örüntü Tespit Bildirimi**
```
┌─────────────────────────────────────┐
│ 🎯 Örüntü Tespit Edildi!           │ Pattern alert
├─────────────────────────────────────┤
│                                     │
│ Son 3 kaydın aynı tipte:           │ Detection info
│ 🧼 Temizlik → 🧼 Temizlik → 🧼    │ Visual pattern
│                                     │
│ Bu farkındalık çok değerli!        │ Encouraging msg
│                                     │
│        ┌─────────────────┐         │
│        │   +18 ✨        │         │ Bonus animation
│        │ Örüntü farkı!   │         │
│        └─────────────────┘         │
│                                     │
│ [Anladım] [Detaylar]               │ Action buttons
└─────────────────────────────────────┘
```

#### **Direnç Gelişimi Bildirimi**
```
┌─────────────────────────────────────┐
│ 📈 Harika Gelişim!                 │ Progress alert
├─────────────────────────────────────┤
│                                     │
│ Direnç seviyende artış var:        │ Improvement info
│                                     │
│ Son 5 kayıt ort: 7.2/10           │ Recent average
│ Önceki 5 kayıt ort: 5.8/10        │ Previous average
│                                     │
│ +1.4 puan gelişim! 🎉             │ Improvement amount
│                                     │
│        ┌─────────────────┐         │
│        │   +22 ✨        │         │ Bonus animation
│        │ Direnç gelişimi!│         │
│        └─────────────────┘         │
│                                     │
│ Bu böyle devam! 💪                 │ Motivational msg
└─────────────────────────────────────┘
```

### 🎨 Renk Sistemi - Dinamik

```
Direnç Seviyesi Renk Kodlaması:

Seviye 1-3 (Zayıf):
- Slider: #EF4444 (Kırmızı)
- Emoji: 😰
- Kaydet Butonu: #EF4444
- Mesaj: "Zorlandığın anları da kaydetmek cesaret"

Seviye 4-6 (Orta):
- Slider: #F59E0B (Turuncu)  
- Emoji: 😐
- Kaydet Butonu: #F59E0B
- Mesaj: "Her adım ileriye doğru bir adım"

Seviye 7-10 (Güçlü):
- Slider: #10B981 (Yeşil)
- Emoji: 💪
- Kaydet Butonu: #10B981
- Mesaj: "Harika direnç gösteriyorsun!"
- Bonus: ≥8 için +15 ✨
```

### 🎭 Animasyon Detayları - Gelişmiş

#### **Cascade Ödül Animasyonu:**
```
Frame Sequence (Total: 2.5s):

Frame 1 (0ms):     Quick Entry +12 ✨
Frame 2 (300ms):   Pattern Recognition +18 ✨  
Frame 3 (600ms):   High Resistance +15 ✨
Frame 4 (900ms):   Consistency +30 ✨
Frame 5 (1200ms):  All animations fade out
Frame 6 (1500ms):  Total points counter
Frame 7 (2000ms):  Success haptic + toast

Easing: easeOutBack for bounce effect
Scale: 0.8 → 1.2 → 1.0 for each reward
```

#### **Akıllı Öneri Seçim Animasyonu:**
```
Selection Flow:

1. Tap Detection:
   - Scale: 1.0 → 0.95 (100ms)
   - Haptic: Light impact
   
2. Color Transition:
   - Background: White → Green (200ms)
   - Text: Gray → White (200ms)
   - Border: Gray → Green (200ms)
   
3. Auto-scroll:
   - Smooth scroll to resistance (300ms)
   - Focus indicator appears (200ms)
   
4. Completion:
   - Scale: 0.95 → 1.0 (100ms)
   - Selection confirmed
```

#### **Direnç Slider Etkileşimi:**
```
Real-time Feedback:

onChange Event:
- Haptic: Light (every value change)
- Color: Smooth transition (200ms)
- Emoji: Instant change
- Value display: Spring animation

onRelease Event:
- Haptic: Medium (confirmation)
- Button color update (300ms)
- Bonus check (if ≥8)
```

---

## 🎯 ERP Oturum Mockups

### 📱 Aktif Oturum Ekranı

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │
├─────────────────────────────────────┤
│  ✕        Kirli Nesne          ≡   │ Header
│        Dokunma Egzersizi            │
├─────────────────────────────────────┤
│                                     │
│         ╭───────────────╮          │ Circular
│        ╱                 ╲         │ Timer
│       │      04:23       │         │ 48px Bold
│       │      kalan       │         │ 16px Gray
│       │                  │         │
│       │        ⏸️        │         │ 40px icon
│        ╲                 ╱         │
│         ╰───────────────╯          │ Green stroke
│                                     │
│                                     │
│   Şu anki anksiyete seviyesi      │ 16px SemiBold
│                                     │
│               7                     │ 32px Bold
│                                     │ Green
│      ○━━━━━━━━●━━━━━━○            │ Slider
│      Düşük         Yüksek          │
│                                     │
│ ┌─────────────────────────────────┐│
│ │ "Bu his geçici. Sadece bir      ││ Italic
│ │  duygu, sen o duygu değilsin."  ││ 16px Gray
│ └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

### 🏆 Tamamlama Ekranı

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │
├─────────────────────────────────────┤
│                                     │
│       [Confetti Animation]          │ Lottie
│              ✓                      │ 100px icon
│           (yeşil)                   │ #10B981
│                                     │
│         Başardın! 🎉               │ 32px Bold
│                                     │
│    Kirli Nesne Dokunma             │ 18px Gray
│    egzersizini tamamladın          │
│                                     │
│   ┌─────────────────────────────┐ │ Light Green
│   │                             │ │ Background
│   │  Süre:              5:00    │ │
│   │                             │ │
│   │  Anksiyete Azalması:  %43  │ │ Green text
│   │                             │ │
│   │  Başlangıç → Bitiş:  8→5   │ │
│   │                             │ │
│   └─────────────────────────────┘ │
│                                     │
│   ┌─────────────────────────────┐ │ Rewards
│   │  🎮 Kazandığın Ödüller:     │ │ Section
│   │                             │ │
│   │  • +20 ✨ İyileşme Puanı   │ │
│   │  • +25 ✨ Anksiyete Azaltma│ │
│   │  • 🏆 İlk Adım Rozeti      │ │
│   │                             │ │
│   └─────────────────────────────┘ │
│                                     │
│   "Her egzersiz seni daha da       │ 16px Italic
│    güçlendiriyor. Kendini kutla!"  │ Green
│                                     │
└─────────────────────────────────────┘
```

---

## 📊 OKB Takip Sayfası

### Ana Görünüm

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │ Status Bar
├─────────────────────────────────────┤
│         OKB Takibi                  │ 28px Bold
│  Kompulsiyonlarını kaydet ve        │ 16px Regular
│        ilerlemeni gör               │
├─────────────────────────────────────┤
│  [Bugün] [Bu Hafta] [Bu Ay]        │ Time Range
├─────────────────────────────────────┤
│  ┌───┐    ┌───┐    ┌───┐          │
│  │ 🧠 │    │ 🛡️ │    │ 📊 │          │ Stats Cards
│  │ 12 │    │7.5│    │ 3 │          │
│  │Kayıt│    │Ort│    │Tip│          │
│  └───┘    └───┘    └───┘          │
├─────────────────────────────────────┤
│  Bugünün Kayıtları                  │ 18px SemiBold
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🧼 Temizlik        8/10 🗑️ │   │ Entry Card
│  │ 14:30                      │   │
│  │ "Ellerimi 5 kez yıkadım"   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔍 Kontrol         6/10 🗑️ │   │
│  │ 12:15                      │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ Daha Fazla Göster ↓ ]           │
│                                     │
│                    [ + ]            │ FAB (90px bottom)
├─────────────────────────────────────┤
│  ○  ●  ○  ○  ○                     │ Tab Bar
└─────────────────────────────────────┘
```

### Hızlı Kayıt (FAB → BottomSheet)

```
┌─────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ Overlay
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░┌─────────────────────────────┐░░░│
│░░│         Hızlı Kayıt          │░░░│ 24px Bold
│░░│ Kompulsiyonunu kaydet ve     │░░░│ 16px Regular
│░░│   direnç gücünü belirle      │░░░│
│░░├─────────────────────────────┤░░░│
│░░│ Kompulsiyon Tipi             │░░░│
│░░│                              │░░░│
│░░│ Sık yaşadıkların:            │░░░│
│░░│ [🧼 Temizlik] [🔍 Kontrol]   │░░░│ Frequent chips
│░░│                              │░░░│
│░░│ ┌───┐  ┌───┐  ┌───┐         │░░░│
│░░│ │ 🧼 │  │ 🔍 │  │ 📐 │         │░░░│ Grid (3x2)
│░░│ │Temiz│  │Kont│  │Sime│         │░░░│
│░░│ └───┘  └───┘  └───┘         │░░░│
│░░│ ┌───┐  ┌───┐  ┌───┐         │░░░│
│░░│ │ 🔢 │  │ 💭 │  │ ❓ │         │░░░│
│░░│ │Sayma│  │Zihn│  │Diğr│         │░░░│
│░░│ └───┘  └───┘  └───┘         │░░░│
│░░├─────────────────────────────┤░░░│
│░░│ Direnç Gücü          💪 7/10 │░░░│
│░░│ ━━━━━━━━━━━━━━━━━━━━━       │░░░│ Slider
│░░│ Düşük      Orta      Yüksek │░░░│
│░░├─────────────────────────────┤░░░│
│░░│ Not (İsteğe bağlı)           │░░░│
│░░│ ┌─────────────────────────┐ │░░░│
│░░│ │ Tetikleyen durum...     │ │░░░│
│░░│ └─────────────────────────┘ │░░░│
│░░│                     12/200   │░░░│
│░░├─────────────────────────────┤░░░│
│░░│ [İptal]          [Kaydet]    │░░░│
│░░└─────────────────────────────┘░░░│
└─────────────────────────────────────┘
```

---

## 🛡️ ERP Takip Sayfası

### Ana Görünüm

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │ Status Bar
├─────────────────────────────────────┤
│         ERP Takibi                  │ 28px Bold
│  Maruz kalma egzersizlerini         │ 16px Regular
│         takip et                    │
├─────────────────────────────────────┤
│  [Bugün] [Bu Hafta] [Bu Ay]        │ Time Range
├─────────────────────────────────────┤
│  ┌───┐    ┌───┐    ┌───┐          │
│  │ ▶️ │    │ ⏱️ │    │ 📉 │          │ Stats Cards
│  │ 3 │    │45dk│    │2.5│          │
│  │Oturum│  │Süre│    │Azalma│      │
│  └───┘    └───┘    └───┘          │
├─────────────────────────────────────┤
│  Bugünün Oturumları                 │ 18px SemiBold
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🧘 El Yıkama Direnci         │   │ Session Card
│  │ 14:30         8→3 ↓  15dk   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🧘 Kapı Kontrolü             │   │
│  │ 10:45         7→4 ↓  10dk   │   │
│  └─────────────────────────────┘   │
│                                     │
│  [ Daha Fazla Göster ↓ ]           │
│                                     │
│                    [ + ]            │ FAB (90px bottom)
├─────────────────────────────────────┤
│  ○  ○  ●  ○  ○                     │ Tab Bar
└─────────────────────────────────────┘
```

### Egzersiz Seçimi (FAB → BottomSheet)

#### Aşama 1: Kategori Seçimi

```
┌─────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ Overlay
│░░┌─────────────────────────────┐░░░│
│░░│       Egzersiz Seç           │░░░│ 24px Bold
│░░│       Önce kategori seç      │░░░│ 16px Regular
│░░├─────────────────────────────┤░░░│
│░░│ Son Egzersiz                 │░░░│
│░░│ ┌─────────────────────────┐ │░░░│
│░░│ │ 🕐 El Yıkama Direnci    →│ │░░░│ Last Exercise
│░░│ │    Bulaşma • 10 dk      │ │░░░│
│░░│ └─────────────────────────┘ │░░░│
│░░├─────────────────────────────┤░░░│
│░░│ Kategoriler                  │░░░│
│░░│                              │░░░│
│░░│ ┌───┐  ┌───┐  ┌───┐         │░░░│
│░░│ │ 🧼 │  │ 🔍 │  │ 📐 │         │░░░│ Grid (3x2)
│░░│ │Bula│  │Kont│  │Düze│         │░░░│
│░░│ │ 6  │  │ 4  │  │ 5  │         │░░░│
│░░│ └───┘  └───┘  └───┘         │░░░│
│░░│ ┌───┐  ┌───┐  ┌───┐         │░░░│
│░░│ │ 💭 │  │ ⚡ │  │ 🛡️ │         │░░░│
│░░│ │Zihi│  │Zara│  │Dini│         │░░░│
│░░│ │ 3  │  │ 4  │  │ 5  │         │░░░│
│░░│ └───┘  └───┘  └───┘         │░░░│
│░░└─────────────────────────────┘░░░│
└─────────────────────────────────────┘
```

#### Aşama 2: Egzersiz Seçimi

```
┌─────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ Overlay
│░░┌─────────────────────────────┐░░░│
│░░│       Egzersiz Seç           │░░░│ 24px Bold
│░░│  Bir egzersiz seçerek başla  │░░░│ 16px Regular
│░░├─────────────────────────────┤░░░│
│░░│ [← Kategoriler] Bulaşma      │░░░│
│░░├─────────────────────────────┤░░░│
│░░│ ┌─────────────────────────┐ │░░░│
│░░│ │ El Yıkama Direnci        │ │░░░│
│░░│ │ [Kolay] 10 dk          →│ │░░░│
│░░│ └─────────────────────────┘ │░░░│
│░░│                              │░░░│
│░░│ ┌─────────────────────────┐ │░░░│
│░░│ │ Tuvalet Kullanımı       │ │░░░│
│░░│ │ [Orta] 15 dk           →│ │░░░│
│░░│ └─────────────────────────┘ │░░░│
│░░│                              │░░░│
│░░│ ┌─────────────────────────┐ │░░░│
│░░│ │ Çöp Dokunma             │ │░░░│
│░░│ │ [Zor] 20 dk            →│ │░░░│
│░░│ └─────────────────────────┘ │░░░│
│░░└─────────────────────────────┘░░░│
└─────────────────────────────────────┘
```

---

## 🎮 Gamification UI Komponetleri

### 1. Streak Counter
```
┌─────────────┐
│   🔥 5      │ 24px Bold
│  Fidan 🌱   │ 14px Regular
└─────────────┘
```

### 2. Healing Points Display
```
┌─────────────────────┐
│      ⭐ 1,250       │ 48px Bold
│  Healing Points     │ 18px Medium
└─────────────────────┘
```

### 3. Progress Bar
```
▓▓▓▓▓▓░░░░░░░ 50%
```
- Yükseklik: 10px
- Border radius: 5px
- Renk: `#10B981` (dolu), `#E5E7EB` (boş)

### 4. Mission Card States

**Bekleyen:**
```
┌─────────────────────────────┐
│ ○  Görev Adı          +100 │ #F9FAFB bg
│    Açıklama                │
│    ░░░░░░░░░░ 0/3         │
└─────────────────────────────┘
```

**Tamamlanan:**
```
┌─────────────────────────────┐
│ ✓  Görev Adı          +100│ #E0F2F7 bg
│    Açıklama                │ #10B981 border
│    ▓▓▓▓▓▓▓▓ 3/3         │
└─────────────────────────────┘
```

---

## 📊 Tab Bar Tasarımı

```
┌─────────────────────────────────────┐
│                                     │
│         [İçerik Alanı]              │
│                                     │
├─────────────────────────────────────┤
│  🏠      📊      🎯      ⚙️        │ Tab Bar
│ Bugün   Takip    ERP   Ayarlar     │ 60px height
│  ━━━                                │ Green indicator
└─────────────────────────────────────┘

Aktif Tab:
- İkon: #10B981 (yeşil)
- Text: #10B981 (yeşil)
- Indicator: 2px yeşil çizgi

İnaktif Tab:
- İkon: #6B7280 (gri)
- Text: #6B7280 (gri)
```

---

## 🎨 Komponent Stilleri

### Butonlar

```
Primary Button (Yeşil):
┌─────────────────────────┐
│      Button Text        │ Height: 56px
└─────────────────────────┘ BG: #10B981
                            Text: White

Secondary Button (Beyaz):
┌─────────────────────────┐
│      Button Text        │ Height: 56px
└─────────────────────────┘ Border: #E5E7EB
                            Text: #6B7280
```

### Kartlar

```
┌─────────────────────────────┐
│                             │ Border Radius: 16px
│      Kart İçeriği          │ Padding: 16px
│                             │ BG: #F0FDF4 or White
└─────────────────────────────┘ Shadow: Subtle

Gamification Kartları:
- Streak Card: White BG + Strong shadow
- Points Card: #F3F4F6 BG
- Achievement Card: White BG + Border
```

### Input Alanları

```
┌─────────────────────────────┐
│ Placeholder text            │ Height: 48px
└─────────────────────────────┘ Border: #E5E7EB
                               Focus: #10B981
```

---

## 📏 Spacing & Layout

```
Margin/Padding Değerleri:
- xs: 4px
- sm: 8px  
- md: 16px (default)
- lg: 24px
- xl: 32px
- xxl: 48px

Border Radius:
- Small: 8px (chips, small buttons)
- Medium: 12px (buttons, inputs)
- Large: 16px (cards)
- XLarge: 24px (bottom sheets)
- Full: 999px (streak counter)

Gölgeler:
- Subtle: 0 1px 3px rgba(0,0,0,0.1)
- Medium: 0 4px 6px rgba(0,0,0,0.1)
- Strong: 0 10px 15px rgba(0,0,0,0.1)
```

---

## 🌟 Animasyon Detayları

### Geçişler
- **Fade In/Out:** 300ms ease-in-out
- **Slide Up (BottomSheet):** 400ms ease-out
- **Scale (Button Press):** 150ms ease-in-out
- **Progress Bar:** Linear, smooth

### Gamification Animasyonları
- **Streak Flame Pulse:** 2s infinite, scale 1.0 → 1.1
- **Micro Reward Float:** 1.8s, translateY 0 → -50px + fade
- **Achievement Unlock:** Scale 0.8 → 1.2 → 1.0 + confetti
- **Points Counter:** 500ms, number increment animation

### Haptic Feedback
- **Light:** Chip seçimi, slider değişimi
- **Medium:** Buton tıklamaları
- **Heavy:** 2 dakikalık hatırlatmalar
- **Success:** Görev tamamlama, achievement unlock

### Micro-interactions
- Button press: Scale 0.95
- FAB hover: Subtle shadow increase
- Slider thumb: Scale 1.2 on drag
- Chip selection: Background color transition
- Streak counter: Continuous pulse on flame
- Achievement badge: Bounce on unlock

---

## 🎆 Özel Animasyonlar

### Confetti (Lottie)
- **Tetiklenme:** ERP tamamlama, achievement unlock
- **Süre:** 3 saniye
- **Pozisyon:** Tam ekran overlay

## 🎨 Mikro Ödül Animasyonu

### Görsel Akış
```
     +25 ✨
       ↑
   (fadeIn + scale)
       ↑
  [Eylem Noktası]
```

### Animasyon Detayları
- **Süre:** 2.5 saniye
- **Başlangıç:** `opacity: 0`, `scale: 0.5`
- **Bitiş:** `opacity: 0`, `translateY: -100`
- **Konfeti:** Opsiyonel parlama efekti

### Renk Kodları
- Normal puan: `#F59E0B` (Turuncu)
- Bonus puan: `#8B5CF6` (Mor)
- Milestone: `#10B981` (Yeşil)

---

## ⚙️ Ayarlar Sayfası

```
┌─────────────────────────────────────┐
│  ⬤ ⬤ ⬤ ⬤               60          │ Status Bar
├─────────────────────────────────────┤
│         Ayarlar                     │ 28px Bold
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ 👤 user@example.com         │   │ Profile Card
│  │    Healing Points: 1,250    │   │
│  │    Günlük Seri: 5 gün       │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  Tercihler                          │ 18px SemiBold
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🌐 Dil                      │   │
│  │    Türkçe                 > │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔔 Bildirimler              │   │
│  │    Hatırlatmalar      [ ✓ ] │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 🔐 Gizlilik                 │   │
│  │    Biyometrik Kilit  [ ✓ ] │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  Destek                             │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📖 Kullanım Kılavuzu        │   │
│  │                           > │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 📧 İletişim                 │   │
│  │    destek@obsessless.app  > │   │
│  └─────────────────────────────┘   │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │        Çıkış Yap            │   │ Logout Button
│  └─────────────────────────────┘   │
│                                     │
│  v1.0.0                             │ Version
├─────────────────────────────────────┤
│  ○  ○  ○  ○  ●                     │ Tab Bar
└─────────────────────────────────────┘
```

---

## 🎨 UI Bileşenleri

### FAB (Floating Action Button)

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│                              ┌───┐  │
│                              │ + │  │ 56x56px
│                              └───┘  │ #10B981
│                                ↑    │ Shadow: 0 4 8 rgba(16,185,129,0.3)
│                               90px  │ Position: fixed
│  ───────────────────────────────    │ Tab Bar
└─────────────────────────────────────┘
```

**FAB Özellikleri:**
- **Boyut**: 56x56px
- **Renk**: #10B981 (Primary Green)
- **Konum**: `position: absolute, bottom: 90px, right: 16px`
- **Z-Index**: 999 (Tab bar üzerinde)
- **Elevation**: 8 (Android)
- **Shadow**: iOS için özel shadow ayarları

### BottomSheet

```
┌─────────────────────────────────────┐
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ Overlay (rgba(0,0,0,0.5))
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
│░░┌─────────────────────────────┐░░░│
│░░│        ━━━━━━━━━             │░░░│ Handle
│░░│                              │░░░│ Border Radius: 16px
│░░│        İçerik Alanı          │░░░│ Background: #FFFFFF
│░░│                              │░░░│ Max Height: 90%
│░░│                              │░░░│
│░░└─────────────────────────────┘░░░│
└─────────────────────────────────────┘
```

### Stat Card

```
┌─────────────────────┐
│      ┌───────┐      │ 48x48px icon container
│      │  🧠   │      │ Background: #F0FDF4
│      └───────┘      │
│                     │
│        12           │ 24px Bold
│       Kayıt         │ 12px Regular
└─────────────────────┘
```

**Özellikleri:**
- **Boyut**: Flex (1/3 genişlik)
- **Padding**: 16px
- **Border Radius**: 12px
- **Background**: #FFFFFF
- **Shadow**: 0 1 2 rgba(0,0,0,0.05)

### Time Range Button

```
Active:                 Inactive:
┌─────────────┐        ┌─────────────┐
│   Bugün     │        │   Bugün     │
└─────────────┘        └─────────────┘
#10B981 BG             #FFFFFF BG
#FFFFFF Text           #6B7280 Text
```

### Entry/Session Card

```
┌─────────────────────────────────────┐
│ [Icon] Başlık          Değer [🗑️]  │
│        Alt bilgi                    │
│        "Opsiyonel not"              │
└─────────────────────────────────────┘
```

**Özellikleri:**
- **Padding**: 16px
- **Border Radius**: 12px
- **Background**: #FFFFFF
- **Border**: 1px solid #E5E7EB
- **Margin Bottom**: 12px

---

## 📐 Spacing & Layout

### Genel Kurallar

- **Minimum Padding**: 16px
- **Bölümler Arası**: 24px
- **Kartlar Arası**: 12px
- **Grid Gap**: 12px
- **Minimum Dokunma Alanı**: 48x48px

### Responsive Breakpoints

- **Mobile**: 320px - 768px (default)
- **Tablet**: 768px - 1024px
- **Desktop**: 1024px+

---

## 🎭 Animasyonlar

### Mikro Animasyonlar

1. **FAB Press**: Scale(0.95) → Scale(1)
2. **Button Press**: Opacity(1) → Opacity(0.8)
3. **Card Tap**: Scale(0.98) + Shadow increase
4. **BottomSheet**: SlideInUp (300ms ease-out)
5. **Toast**: FadeIn + SlideDown (200ms)

### Haptic Feedback

- **Light**: Seçimler, toggle'lar
- **Medium**: Buton tıklamaları
- **Success**: Form gönderimi, görev tamamlama
- **Warning**: Silme onayı

---

## 🌈 Tema Varyasyonları

### Light Mode (Default)
- Background: #F9FAFB
- Surface: #FFFFFF
- Text Primary: #111827
- Text Secondary: #6B7280

### Dark Mode (Gelecek Sürüm)
- Background: #111827
- Surface: #1F2937
- Text Primary: #F9FAFB
- Text Secondary: #9CA3AF

---

**Bu mockup'lar ObsessLess'in "dijital sığınak" vizyonunu ve anlamlı oyunlaştırma sistemini görselleştirir.** 💚