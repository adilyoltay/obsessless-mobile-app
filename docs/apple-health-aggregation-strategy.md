# 📊 Apple Health Tarzı Veri Aggregation Stratejisi

## 🎯 Genel Bakış

Bu doküman, ObsessLess uygulamasının Mood Journey grafiğini Apple Health'in ruh hali grafiği ile tam uyumlu hale getirmek için gerekli veri aggregation ve görselleştirme stratejilerini detaylandırır.

## 🎯 Temel Prensipler

### Zaman Aralığı Bazlı Aggregation:

1. **Hafta (H):** Her gün ayrı gösterilir - 7 bar/nokta
2. **Ay (A):** Haftalık aggregate - 4-5 bar (her hafta bir bar)
3. **6 Ay (6A):** Aylık aggregate - 6 bar (her ay bir bar)
4. **Yıl (Y):** Aylık aggregate - 12 bar (her ay bir bar)

## 📐 Uygulama Planı

### 1. Veri Aggregation Mantığı

#### Haftalık Görünüm (Mevcut - Değişmeyecek)
- Her gün için tüm girişlerin ortalaması
- Dikey bantlar birden fazla giriş için

#### Aylık Görünüm
- Her **HAFTA** için aggregate
- Haftanın tüm girişlerinin ortalaması
- Min/max aralığı korunur

#### 6 Aylık Görünüm
- Her **AY** için aggregate  
- Ayın tüm girişlerinin ortalaması
- Ay içi varyans göstergesi

#### Yıllık Görünüm
- Her **AY** için aggregate
- Ayın tüm girişlerinin ortalaması
- Mevsimsel trendler

### 2. Grid Çizgileri ve Etiketler

```typescript
// Hafta: Her gün dikey çizgi
// Ay: Her hafta başı dikey çizgi (Pazartesi)
// 6 Ay: Her ay başı dikey çizgi
// Yıl: Her ay başı dikey çizgi
```

### 3. X Ekseni Etiketleri

```typescript
// Hafta: Pz, Pt, Sa, Ça, Pe, Cu, Ct
// Ay: 1, 8, 15, 22, 29 (veya hafta numaraları)
// 6 Ay: Oca, Şub, Mar, Nis, May, Haz
// Yıl: O, Ş, M, N, M, H, T, A, E, E, K, A (kısa)
```

## 🔧 Gerekli Değişiklikler

### 1. moodDataLoader.ts'ye Aggregation Eklenmeli

```typescript
private aggregateDataByTimeRange(
  entries: MoodEntryLite[], 
  range: TimeRange
): AggregatedData[] {
  switch(range) {
    case 'week':
      // Günlük (mevcut)
      return this.aggregateByDay(entries);
    
    case 'month':
      // Haftalık aggregate
      return this.aggregateByWeek(entries);
    
    case '6months':
      // Aylık aggregate
      return this.aggregateByMonth(entries);
    
    case 'year':
      // Aylık aggregate
      return this.aggregateByMonth(entries);
  }
}

private aggregateByWeek(entries: MoodEntryLite[]): AggregatedData[] {
  // Haftalara göre grupla
  const weekGroups = new Map<string, MoodEntryLite[]>();
  
  entries.forEach(entry => {
    const date = new Date(entry.timestamp);
    const weekStart = getWeekStart(date); // Pazartesi
    const weekKey = formatDateYMD(weekStart);
    
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(entry);
  });
  
  // Her hafta için aggregate
  return Array.from(weekGroups.entries()).map(([weekKey, weekEntries]) => {
    const moods = weekEntries.map(e => e.mood_score);
    const energies = weekEntries.map(e => e.energy_level);
    
    return {
      date: weekKey,
      label: getWeekLabel(weekKey), // "1-7 Oca" gibi
      averageMood: average(moods),
      averageEnergy: average(energies),
      min: Math.min(...moods),
      max: Math.max(...moods),
      count: weekEntries.length,
      entries: weekEntries // Detay için sakla
    };
  });
}

private aggregateByMonth(entries: MoodEntryLite[]): AggregatedData[] {
  // Aylara göre grupla
  const monthGroups = new Map<string, MoodEntryLite[]>();
  
  entries.forEach(entry => {
    const date = new Date(entry.timestamp);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthGroups.has(monthKey)) {
      monthGroups.set(monthKey, []);
    }
    monthGroups.get(monthKey)!.push(entry);
  });
  
  // Her ay için aggregate
  return Array.from(monthGroups.entries()).map(([monthKey, monthEntries]) => {
    const moods = monthEntries.map(e => e.mood_score);
    const energies = monthEntries.map(e => e.energy_level);
    
    return {
      date: monthKey,
      label: getMonthLabel(monthKey), // "Ocak 2025" gibi
      averageMood: average(moods),
      averageEnergy: average(energies),
      min: Math.min(...moods),
      max: Math.max(...moods),
      variance: calculateVariance(moods),
      count: monthEntries.length,
      entries: monthEntries
    };
  });
}
```

### 2. AppleHealthStyleChartV2.tsx'de Görselleştirme

```typescript
// Grid çizgileri mantığı
const getGridLines = (data: AggregatedData[], timeRange: TimeRange) => {
  switch(timeRange) {
    case 'week':
      // Her gün için çizgi
      return data.map(d => d.date);
    
    case 'month':
      // Sadece hafta başları
      return data.filter(d => isMonday(d.date)).map(d => d.date);
    
    case '6months':
    case 'year':
      // Sadece ay başları
      return data.filter(d => isFirstOfMonth(d.date)).map(d => d.date);
  }
};

// Bar genişliği ayarı
const getBarWidth = (timeRange: TimeRange, dataCount: number) => {
  const baseWidth = contentWidth / Math.max(1, dataCount);
  
  switch(timeRange) {
    case 'week':
      return baseWidth * 0.6; // İnce
    
    case 'month':
      return baseWidth * 0.7; // Orta
    
    case '6months':
    case 'year':
      return baseWidth * 0.8; // Kalın
  }
};

// Nokta boyutu (aggregate göstergesi)
const getPointSize = (timeRange: TimeRange, entryCount: number) => {
  const baseSize = Math.min(8, 3 + Math.log(entryCount + 1));
  
  switch(timeRange) {
    case 'week':
      return baseSize; // Normal
    
    case 'month':
      return baseSize * 1.2; // Biraz büyük
    
    case '6months':
    case 'year':
      return baseSize * 1.5; // Daha büyük
  }
};
```

### 3. Etiket Formatı

```typescript
const formatXLabel = (date: string, timeRange: TimeRange) => {
  const d = new Date(date);
  
  switch(timeRange) {
    case 'week':
      // Gün adı: Pz, Pt, Sa...
      return days[d.getDay()];
    
    case 'month':
      // Gün numarası veya hafta başı
      if (isMonday(d)) {
        return d.getDate().toString();
      }
      return '';
    
    case '6months':
      // Ay adı kısa
      if (isFirstOfMonth(d)) {
        return months[d.getMonth()].substring(0, 3);
      }
      return '';
    
    case 'year':
      // Ay adı çok kısa
      if (isFirstOfMonth(d)) {
        return monthsShort[d.getMonth()]; // O, Ş, M, N...
      }
      return '';
  }
};
```

## 📊 Yeni Veri Yapıları

### AggregatedData Interface

```typescript
interface AggregatedData {
  date: string;
  label: string;
  averageMood: number;
  averageEnergy: number;
  min: number;
  max: number;
  variance?: number;
  count: number;
  entries: MoodEntryLite[];
}
```

### Yardımcı Fonksiyonlar

```typescript
// Hafta başlangıcını bul (Pazartesi)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi = 1
  return new Date(d.setDate(diff));
};

// Ay başlangıcını bul
const isFirstOfMonth = (date: Date): boolean => {
  return date.getDate() === 1;
};

// Pazartesi kontrolü
const isMonday = (date: Date): boolean => {
  return date.getDay() === 1;
};

// Ortalama hesaplama
const average = (numbers: number[]): number => {
  return numbers.length > 0 
    ? numbers.reduce((sum, num) => sum + num, 0) / numbers.length 
    : 0;
};

// Varyans hesaplama
const calculateVariance = (numbers: number[]): number => {
  if (numbers.length <= 1) return 0;
  const mean = average(numbers);
  const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / (numbers.length - 1);
  return variance;
};
```

## 🎯 Etiket Formatları

### Hafta Etiketleri
```typescript
const days = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
```

### Ay Etiketleri (Kısa)
```typescript
const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
```

### Ay Etiketleri (Çok Kısa)
```typescript
const monthsShort = ['O', 'Ş', 'M', 'N', 'M', 'H', 'T', 'A', 'E', 'E', 'K', 'A'];
```

## 🔄 Veri Akışı

### 1. Veri Yükleme
```typescript
// moodDataLoader.ts
const extended = await moodDataLoader.loadTimeRange(userId, range);
```

### 2. Aggregation
```typescript
// Seçilen range'a göre otomatik aggregation
const aggregatedData = aggregateDataByTimeRange(entries, range);
```

### 3. Görselleştirme
```typescript
// AppleHealthStyleChartV2.tsx
<AppleHealthStyleChartV2
  data={aggregatedData}
  timeRange={range}
  onDayPress={handleDayPress}
/>
```

## 📈 Performans Avantajları

### Veri Yoğunluğu Azalması
- **Hafta:** 7 gün → 7 veri noktası
- **Ay:** 30 gün → 4-5 hafta
- **6 Ay:** 180 gün → 6 ay
- **Yıl:** 365 gün → 12 ay

### Performans İyileştirmeleri
1. **Render Hızı:** Daha az SVG elementi
2. **Bellek Kullanımı:** Daha az veri işleme
3. **Kullanıcı Deneyimi:** Daha hızlı geçişler

## 🎨 Görsel Tutarlılık

### Apple Health Uyumluluğu
- **Bar Genişlikleri:** Zaman aralığına göre ayarlanır
- **Grid Çizgileri:** Sadece önemli tarihlerde gösterilir
- **Etiketler:** Okunabilir ve minimal
- **Renk Kodlaması:** Valence ve Energy korunur

### Responsive Tasarım
- **Mobil Optimizasyon:** Dokunmatik etkileşim
- **Erişilebilirlik:** Screen reader desteği
- **Performans:** Smooth animasyonlar

## 🚀 Uygulama Adımları

### Sprint 1: Temel Aggregation
1. `moodDataLoader.ts`'ye aggregation fonksiyonları ekle
2. Yeni veri yapılarını tanımla
3. Temel test coverage ekle

### Sprint 2: Görselleştirme
1. `AppleHealthStyleChartV2.tsx`'i güncelle
2. Grid çizgileri mantığını uygula
3. Etiket formatlarını ekle

### Sprint 3: Optimizasyon
1. Performans testleri
2. Kullanıcı testleri
3. Apple Health karşılaştırması

## ✅ Başarı Kriterleri

### Fonksiyonel
- [ ] Tüm zaman aralıkları için doğru aggregation
- [ ] Grid çizgileri doğru konumlarda
- [ ] Etiketler okunabilir ve doğru

### Performans
- [ ] Render süresi < 100ms
- [ ] Bellek kullanımı optimize
- [ ] Smooth geçişler

### Kullanıcı Deneyimi
- [ ] Apple Health ile %90+ benzerlik
- [ ] Intuitive etkileşim
- [ ] Erişilebilirlik standartları

## 📝 Notlar

- Bu strateji mevcut veri yapısını korur
- Geriye dönük uyumluluk sağlanır
- Apple Health'in UX pattern'leri taklit edilir
- Performans optimizasyonu öncelikli

---

*Bu doküman, ObsessLess uygulamasının Mood Journey grafiğini Apple Health standartlarına yükseltmek için hazırlanmıştır.*
