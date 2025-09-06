# ObsessLess P50, Mood, Enerji, Anksiyete ve Baskın Duygu Hesaplama Akış Analizi

## 1. Genel Akış Özeti

Uygulamada mood verilerinin işlenme ve görselleştirilme akışı şu aşamalardan geçiyor:

```
Veri Girişi → Kayıt → Aggregation → P50 Hesaplama → Grafik Çizimi
```

## 2. P50 (Median) Hesaplama Mantığı

### 2.1 Quantiles Fonksiyonu

```typescript
// utils/statistics.ts
export const quantiles = (arr: number[]): IQR => {
  const vals = (arr || []).map(Number).filter((n) => Number.isFinite(n));
  if (vals.length === 0) return { p25: NaN, p50: NaN, p75: NaN };
  const a = Float64Array.from(vals).sort();
  const q = (p: number) => {
    const idx = (a.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return a[lo];
    const t = idx - lo;
    return a[lo] * (1 - t) + a[hi] * t;  // Linear interpolation
  };
  return { p25: q(0.25), p50: q(0.5), p75: q(0.75) };
};
```

**Özellikler:**
- ✅ Float64Array kullanımı (performans)
- ✅ Linear interpolation (ara değerler için)
- ✅ NaN döndürme (boş veri durumu)
- ✅ IQR (Interquartile Range) hesaplama

### 2.2 Alternative Quantile Fonksiyonu

```typescript
// utils/dateAggregation.ts
export const quantile = (numbers: number[], q: number): number => {
  const arr = (numbers || []).map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  const n = arr.length;
  if (n === 0) return 0;  // ⚠️ 0 döndürüyor (NaN yerine)
  if (q <= 0) return arr[0];
  if (q >= 1) return arr[n - 1];
  const pos = (n - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const weight = pos - lower;
  if (upper === lower) return arr[lower];
  return arr[lower] + (arr[upper] - arr[lower]) * weight;
};
```

**Sorun:** İki farklı quantile fonksiyonu var, davranışları farklı (0 vs NaN)

## 3. Veri Aggregation Akışı

### 3.1 toAggregatedBucket Fonksiyonu

```typescript
// services/moodDataLoader.ts
const toAggregatedBucket = (points: MoodEntryLite[], label: string, dateISO: string): AggregatedData => {
  const moods = points.map(p => p.mood_score);
  const energies = points.map(p => p.energy_level);
  const anx = points.map((p: any) => (typeof p.anxiety_level === 'number' ? p.anxiety_level : 0));
  
  const mq = quantiles(moods);      // {p25, p50, p75}
  const eq = quantiles(energies);    // {p25, p50, p75}
  const aq = quantiles(anx);         // {p25, p50, p75}
  
  const min = moods.length ? Math.min(...moods) : 0;
  const max = moods.length ? Math.max(...moods) : 0;
  
  return {
    date: dateISO,
    label,
    count: points.length,
    mood: { ...mq, min, max },
    energy: eq,
    anxiety: aq,
    entries: points,
    // Backwards compatibility
    avg: moods.length ? (moods.reduce((s, v) => s + v, 0) / moods.length) : 0,
    p50: mq.p50,
    min,
    max,
  };
};
```

### 3.2 Zaman Kategorilerine Göre Aggregation

#### Week (Hafta) - dailyAverages kullanılıyor
- Raw veri doğrudan günlük olarak gösteriliyor
- Aggregation yok

#### Month (Ay) - Haftalık bucketlar
```typescript
// Son 4 haftanın verileri haftalık olarak gruplanıyor
const items: AggregatedData[] = allWeekKeys
  .map((weekKey) => {
    const entriesForWeek = weekMap.get(weekKey) || [];
    return toAggregatedBucket(entriesForWeek, getWeekLabel(weekKey), weekKey);
  })
```

#### 6 Months & Year - Aylık bucketlar
```typescript
// Son 6/12 ayın verileri aylık olarak gruplanıyor
const items: AggregatedData[] = allMonthKeys
  .map((monthKey) => {
    const entriesForMonth = monthMap.get(monthKey) || [];
    return toAggregatedBucket(entriesForMonth, getMonthLabel(monthKey), `${monthKey}-01`);
  })
```

#### Day (Gün) - Saatlik veriler
```typescript
// hourlyAverages kullanılıyor
const items = (data.hourlyAverages || [])
  .slice(dayWindowStart, dayWindowStart + dayWindowSize)
  .map((h: any) => ({ date: h.dateKey }))
```

## 4. Anksiyete Hesaplama Sorunu

### ❌ ESKİ HATALI KOD (Raporumda tespit edilmişti):
```typescript
// VAMoodCheckin.tsx:439-441 (ESKİ)
const computedAnx10 = Math.round(0.6 * energy10 + 0.4 * (11 - mood10));
const finalAnx10 = Math.max(1, Math.min(10, (detectedAnxiety != null ? detectedAnxiety : computedAnx10)));
```
**Sorun:** Yüksek enerji = yüksek anksiyete olarak hesaplanıyordu

### ✅ YENİ DÜZELTME:
```typescript
// VAMoodCheckin.tsx:439 (YENİ)
const finalAnx10 = Math.max(1, Math.min(10, (detectedAnxiety != null ? detectedAnxiety : 5)));
```
**Çözüm:** Ses analizinden anksiyete tespit edilmezse nötr değer (5) kullanılıyor

### ⚠️ ANCAK GRAFİKTE HALA ESKİ FORMÜL VAR:
```typescript
// AppleHealthStyleChartV2.tsx:893-896
if (anxRaw.every(v => v === 5)) {  // Tüm değerler 5 ise
  const derived = rp.map((e: any) => {
    const en = Math.max(1, Math.min(10, Number(e.energy_level || 6)));
    const m10 = Math.max(1, Math.min(10, Math.round(Number(e.mood_score || 50) / 10)));
    return Math.round(0.6 * en + 0.4 * (11 - m10));  // HATALI FORMÜL
  });
  a = quantiles(derived).p50;
}
```

## 5. Baskın Duygu (Dominant Emotion) Hesaplama

### 5.1 Mood Score Aralıklarına Göre Sınıflandırma

```typescript
// services/moodDataLoader.ts:205-223
const dominantEmotions: EmotionDistribution[] = (() => {
  const buckets = {
    'Heyecanlı': lite.filter(e => e.mood_score >= 90).length,
    'Enerjik': lite.filter(e => e.mood_score >= 80 && e.mood_score < 90).length,
    'Mutlu': lite.filter(e => e.mood_score >= 70 && e.mood_score < 80).length,
    'Sakin': lite.filter(e => e.mood_score >= 60 && e.mood_score < 70).length,
    'Normal': lite.filter(e => e.mood_score >= 50 && e.mood_score < 60).length,
    'Endişeli': lite.filter(e => e.mood_score >= 40 && e.mood_score < 50).length,
    'Sinirli': lite.filter(e => e.mood_score >= 30 && e.mood_score < 40).length,
    'Üzgün': lite.filter(e => e.mood_score >= 20 && e.mood_score < 30).length,
    'Kızgın': lite.filter(e => e.mood_score < 20).length,
  };
  
  const total = lite.length || 1;
  return Object.entries(buckets)
    .filter(([_, c]) => c > 0)
    .map(([emotion, c]) => ({ emotion, percentage: Math.round((c / total) * 100) }))
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3);  // En yüksek 3 duygu
})();
```

### 5.2 Voice Analysis'de Alternatif Yaklaşım

```typescript
// services/voiceCheckInHeuristicService.ts:1862-1879
private pickFinalEmotion({mood, energy, anxiety}: {mood:number; energy:number; anxiety:number}): string {
  const nearNeutral = mood >= 4.5 && mood <= 5.5;
  if (nearNeutral) return 'nötr';
  
  // Energy + Anxiety kombinasyonları da dikkate alınıyor
  if (anxiety >= 8 && energy >= 7 && mood >= 6) return 'heyecanlı/gergin';
  if (anxiety >= 8 && mood <= 4) return 'kaygılı';
  if (mood >= 8 && anxiety <= 3) return 'mutlu';
  if (mood <= 3 && anxiety <= 5) return 'üzgün';
  if (energy >= 8 && mood >= 6) return 'enerjik';
  
  return 'karışık';
}
```

## 6. Grafiklere Yansıtılma Akışı

### 6.1 Week View Çizgileri

```typescript
// Mood Trend Line (P50)
{showMoodTrend && timeRange === 'week' && (
  // Her gün için raw verilerden p50 hesaplanıyor
  const raw = (data.rawDataPoints[d.date]?.entries || [])
    .map((e: any) => Number(e.mood_score))
    .filter(Number.isFinite);
  const q = quantiles(raw);
  const m = Number.isFinite(q.p50) ? Number(q.p50) : 0;
)}

// Energy Line (P50)
{showEnergy && timeRange === 'week' && (
  // Her gün için raw verilerden p50 hesaplanıyor
  const eArr = rp.map((en: any) => Number(en.energy_level)).filter(Number.isFinite);
  const e = eArr.length ? quantiles(eArr).p50 : Number(d.averageEnergy || 0);
)}

// Anxiety Line (P50)
{showAnxiety && timeRange === 'week' && (
  // Her gün için p50 veya türetilmiş değer kullanılıyor
  if (anxRaw.every(v => v === 5)) {
    // HATALI türetme formülü kullanılıyor
    const derived = /* hatalı formül */
    a = quantiles(derived).p50;
  } else {
    a = quantiles(anxRaw).p50;
  }
)}
```

### 6.2 Day View Çizgileri (YENİ EKLENDİ)

```typescript
// Day view için saatlik verilerden p50 hesaplanıyor
const items = (data.hourlyAverages || []).slice(dayWindowStart, dayWindowStart + dayWindowSize);

// Her saat için:
const moodVals = rp.map((e: any) => Number(e.mood_score)).filter(Number.isFinite);
const q = quantiles(moodVals);
const m = Number.isFinite(q.p50) ? Number(q.p50) : 0;
```

### 6.3 Month, 6 Months, Year View

```typescript
// Aggregated bucketlardan p50 değerleri kullanılıyor
const bucket = data.aggregated?.data[index];
const moodP50 = bucket.mood.p50;
const energyP50 = bucket.energy.p50;
const anxietyP50 = bucket.anxiety.p50;
```

## 7. Tespit Edilen Sorunlar ve Öneriler

### 🔴 KRİTİK SORUNLAR

#### 1. Anksiyete Hesaplama Tutarsızlığı
- **Sorun:** VAMoodCheckin'de düzeltilmiş ama grafikte hala eski hatalı formül var
- **Çözüm:** AppleHealthStyleChartV2.tsx satır 895'teki formülü kaldır

#### 2. İki Farklı Quantile Fonksiyonu
- **Sorun:** `quantiles()` NaN döndürürken, `quantile()` 0 döndürüyor
- **Çözüm:** Tek bir standart fonksiyon kullan

#### 3. Eksik Gün/Saat Değerleri
- **Sorun:** Veri olmayan günler 0 olarak gösteriliyor
- **Çözüm:** Null/NaN değer kullan, grafikte boşluk bırak

### 🟡 ORTA ÖNCELİKLİ SORUNLAR

#### 1. Ölçek Tutarsızlığı
- mood_score: 0-100
- energy_level: 1-10
- anxiety_level: 1-10
**Öneri:** Tümünü 0-100 veya 1-10 standardına getir

#### 2. Dominant Emotion Hesaplama Farklılıkları
- Sadece mood_score'a göre vs mood+energy+anxiety kombinasyonu
**Öneri:** Tek bir tutarlı yaklaşım kullan

#### 3. Performance Sorunları
- Her render'da quantiles() tekrar tekrar çağrılıyor
**Öneri:** useMemo ile optimize et

### ✅ İYİ ÇALIŞAN ÖZELLIKLER

1. **P50 Hesaplama:** Linear interpolation ile doğru median hesaplaması
2. **Zaman Kategorileri:** Week, month, 6 months, year için uygun aggregation
3. **Gap Handling:** Veri olmayan dönemler için segment kesme mantığı
4. **Day View Çizgileri:** Yeni eklenen saatlik çizgiler çalışıyor

## 8. Önerilen İyileştirme Planı

### Faz 1: Kritik Düzeltmeler (1 gün)
- [ ] Grafikteki hatalı anksiyete formülünü kaldır
- [ ] Quantile fonksiyonlarını birleştir
- [ ] Eksik veri için null/NaN kullan

### Faz 2: Standardizasyon (2-3 gün)
- [ ] Ölçekleri standardize et
- [ ] Dominant emotion hesaplamasını birleştir
- [ ] Veri tipleri için TypeScript strict mode

### Faz 3: Optimizasyon (3-5 gün)
- [ ] useMemo ile hesaplama optimizasyonu
- [ ] React.memo ile gereksiz re-render önleme
- [ ] Batch veri yükleme

## 9. Sonuç

Sistem genel olarak çalışıyor ancak tutarsızlıklar ve performans sorunları var:

- **P50 hesaplaması:** ✅ Doğru çalışıyor
- **Mood/Energy:** ✅ Doğru hesaplanıyor
- **Anxiety:** ⚠️ Kısmen hatalı (grafik formülü)
- **Dominant Emotion:** ✅ Çalışıyor ama tutarsız
- **Grafik Çizimi:** ✅ Çalışıyor, Day view düzeltildi

**Tahmini düzeltme süresi:** 1 hafta (tüm fazlar)

---
*Rapor Tarihi: 2025-01-26*
*Hazırlayan: AI Analiz Sistemi*
