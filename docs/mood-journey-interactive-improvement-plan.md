# 📊 Mood Journey İnteraktif Grafik İyileştirme Planı

> **Tarih:** 26 Ocak 2025  
> **Versiyon:** v1.0  
> **Kapsam:** Mood Journey kartının Apple Health benzeri interaktif grafik sistemine dönüşümü

## 🎯 Vizyon

Apple Health'in Ruh Hali (State of Mind) özelliğindeki ham veri şeffaflığı ve etkileşim deneyimini, ObsessLess'in güçlü enerji hesaplama zekası ve gamification özellikleriyle birleştirerek, kullanıcıların duygusal yolculuklarını daha derinlemesine anlamalarını sağlamak.

## 🏆 Korunacak Güçlü Yönlerimiz

1. **Enerji Hesaplama Zekası**: VA (Valence-Arousal) modeli tabanlı enerji hesaplama
2. **Baskın Duygu Analizi**: Haftalık duygu dağılımı ve yüzdelik gösterim
3. **Gamification**: Healing Points ve Streak sistemi
4. **Türkçe Duygu Kategorileri**: Kültürel uyumlu duygu isimlendirmesi
5. **Offline-First Yaklaşım**: Lokal veri önceliği ve senkronizasyon

## 📱 Apple Health Ruh Hali Özelliklerinden Alınacak İlhamlar

### 1. **Zaman Ölçeği Esnekliği**
- Hafta (H), Ay (A), 6 Ay (6A), Yıl (Y) görünüm modları
- Hızlı geçiş için üst sekme navigasyonu
- Her zaman diliminde optimize edilmiş görselleştirme

### 2. **Ham Veri Şeffaflığı**
- Gün içindeki tüm girişlerin ayrı nokta olarak gösterimi
- Dikey dağılım ile gün içi dalgalanmaların görselleştirilmesi
- Min-max aralıkları ve sapmaların net görünümü

### 3. **Etkileşimli Detaylar**
- Bar/nokta tıklamasıyla detaylı görünüm açılması
- Seçilen dönemin tüm mood kayıtlarının listelenmesi
- Her kaydın saat, not ve tetikleyici bilgileri

## 🚀 Uygulama Planı

### Faz 1: Temel Altyapı (Sprint 1)

#### 1.1 Chart Kütüphanesi Seçimi ve Entegrasyonu

**Önerilen Kütüphane:** `react-native-wagmi-charts` veya `victory-native`

```bash
npm install react-native-wagmi-charts react-native-reanimated react-native-gesture-handler
# veya
npm install victory-native react-native-svg
```

**Neden Wagmi Charts?**
- ✅ Yüksek performanslı, 60 FPS animasyonlar
- ✅ Gesture desteği (pan, zoom, tap)
- ✅ Finansal grafikler için optimize edilmiş (hassas veri gösterimi)
- ✅ React Native Reanimated 2 tabanlı
- ✅ TypeScript desteği

**Alternatif: Victory Native**
- ✅ Daha olgun ve stabil
- ✅ Geniş grafik türü desteği
- ✅ Özelleştirme esnekliği
- ⚠️ Performans Wagmi'den düşük

#### 1.2 Veri Modeli Genişletmesi

```typescript
// types/mood.ts
export interface MoodJourneyExtended {
  // Mevcut alanlar
  weeklyEntries: MoodEntry[];
  todayAverage: number;
  weeklyTrend: 'up' | 'down' | 'stable';
  weeklyEnergyAvg: number;
  weeklyAnxietyAvg: number;
  
  // Yeni alanlar
  monthlyEntries?: MoodEntry[];
  sixMonthEntries?: MoodEntry[];
  yearlyEntries?: MoodEntry[];
  
  // Detaylı istatistikler
  statistics: {
    timeRange: 'week' | 'month' | '6months' | 'year';
    totalEntries: number;
    averageMood: number;
    averageEnergy: number;
    averageAnxiety: number;
    moodVariance: number;
    dominantEmotions: EmotionDistribution[];
    peakTimes: { hour: number; count: number }[];
    triggers: TriggerFrequency[];
  };
  
  // Ham veri noktaları (gün içi detaylar)
  rawDataPoints: {
    [date: string]: {
      entries: MoodEntry[];
      min: number;
      max: number;
      variance: number;
    };
  };
}
```

### Faz 2: UI/UX Geliştirmeleri (Sprint 1-2)

#### 2.1 Zaman Seçici Sekmeleri

```tsx
// components/mood/TimeRangeSelector.tsx
export const TimeRangeSelector = ({ selected, onChange }) => {
  const ranges = [
    { id: 'week', label: 'H', fullLabel: 'Hafta' },
    { id: 'month', label: 'A', fullLabel: 'Ay' },
    { id: '6months', label: '6A', fullLabel: '6 Ay' },
    { id: 'year', label: 'Y', fullLabel: 'Yıl' }
  ];
  
  return (
    <View style={styles.container}>
      {ranges.map(range => (
        <TouchableOpacity
          key={range.id}
          style={[
            styles.tab,
            selected === range.id && styles.tabActive
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(range.id);
          }}
        >
          <Text style={[
            styles.tabText,
            selected === range.id && styles.tabTextActive
          ]}>
            {range.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};
```

#### 2.2 Hibrit Grafik Görünümü

```tsx
// components/mood/InteractiveMoodChart.tsx
export const InteractiveMoodChart = ({ data, timeRange, onDayPress }) => {
  // Scatter plot için ham veri noktaları
  const scatterData = useMemo(() => 
    data.rawDataPoints.map(point => ({
      x: point.timestamp,
      y: normalizeValence(point.mood_score),
      color: getVAColor(point.mood_score, point.energy_level),
      opacity: getConfidenceOpacity(point.confidence)
    })), [data]
  );
  
  // Bar chart için günlük ortalamalar
  const barData = useMemo(() => 
    data.dailyAverages.map(day => ({
      x: day.date,
      y: day.averageMood,
      gradient: getEnergyGradient(day.averageEnergy)
    })), [data]
  );
  
  return (
    <View style={styles.chartContainer}>
      {/* Arka plan: Ham veri noktaları */}
      <ScatterChart
        data={scatterData}
        style={StyleSheet.absoluteFill}
        onPointPress={onDayPress}
      />
      
      {/* Ön plan: Enerji barları */}
      <BarChart
        data={barData}
        style={styles.barChart}
        renderBar={({ bar, index }) => (
          <AnimatedBar
            {...bar}
            entering={SlideInUp.delay(index * 50)}
            gradient={bar.gradient}
          />
        )}
      />
    </View>
  );
};
```

### Faz 3: Etkileşim ve Animasyonlar (Sprint 2)

#### 3.1 Detay Modal/Sayfa

```tsx
// components/mood/MoodDetailModal.tsx
export const MoodDetailModal = ({ date, entries, visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.date}>
            {formatDate(date, 'DD MMMM YYYY, dddd')}
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>Kapat</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.content}>
          {/* Günün özeti */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Günün Özeti</Text>
            <View style={styles.metricsRow}>
              <MetricCard 
                label="Ortalama Mood" 
                value={calculateAverage(entries, 'mood_score')} 
              />
              <MetricCard 
                label="Enerji" 
                value={calculateAverage(entries, 'energy_level')} 
              />
              <MetricCard 
                label="Anksiyete" 
                value={calculateAverage(entries, 'anxiety_level')} 
              />
            </View>
          </View>
          
          {/* Zaman çizelgesi */}
          <View style={styles.timeline}>
            <Text style={styles.timelineTitle}>Gün İçi Dağılım</Text>
            {entries.map((entry, index) => (
              <TimelineEntry
                key={entry.id}
                entry={entry}
                isFirst={index === 0}
                isLast={index === entries.length - 1}
              />
            ))}
          </View>
          
          {/* Tetikleyiciler */}
          {renderTriggers(entries)}
          
          {/* Notlar */}
          {renderNotes(entries)}
        </ScrollView>
      </View>
    </Modal>
  );
};
```

#### 3.2 Animasyonlar ve Micro-interactions

```tsx
// utils/animations.ts
import { 
  withSpring, 
  withTiming, 
  interpolate,
  Extrapolate 
} from 'react-native-reanimated';

export const chartAnimations = {
  // Bar giriş animasyonu
  barEntry: (index: number) => ({
    entering: SlideInUp
      .delay(index * 50)
      .springify()
      .damping(15)
      .stiffness(150),
    layout: Layout.springify()
  }),
  
  // Nokta pulse animasyonu (yeni veri)
  pointPulse: () => {
    'worklet';
    return {
      transform: [
        {
          scale: withSequence(
            withSpring(1.2),
            withSpring(1)
          )
        }
      ]
    };
  },
  
  // Seçim highlight
  selectionHighlight: (selected: boolean) => {
    'worklet';
    return {
      opacity: withTiming(selected ? 1 : 0.6),
      transform: [
        {
          scale: withSpring(selected ? 1.1 : 1)
        }
      ]
    };
  }
};
```

### Faz 4: Gelişmiş Özellikler (Sprint 3)

#### 4.1 Güven Göstergeleri ve Voice Analysis İşaretleri

```tsx
// components/mood/ConfidenceIndicator.tsx
export const ConfidenceIndicator = ({ confidence, source }) => {
  const size = interpolate(
    confidence,
    [0, 0.5, 1],
    [8, 12, 16]
  );
  
  const opacity = interpolate(
    confidence,
    [0, 0.5, 1],
    [0.3, 0.6, 1]
  );
  
  return (
    <Animated.View
      style={[
        styles.indicator,
        {
          width: size,
          height: size,
          opacity
        }
      ]}
    >
      {source === 'voice' && <MicrophoneIcon size={8} />}
      {source === 'manual' && <PencilIcon size={8} />}
    </Animated.View>
  );
};
```

#### 4.2 Tetikleyici İkonları Sistemi

```tsx
// components/mood/TriggerIcons.tsx
const TRIGGER_ICONS = {
  work: '💼',
  relationship: '💑',
  sleep: '😴',
  exercise: '🏃',
  social: '👥',
  health: '🏥',
  finance: '💰',
  family: '👨‍👩‍👧‍👦'
};

export const TriggerIcon = ({ trigger, size = 16 }) => {
  return (
    <TouchableOpacity
      style={[styles.iconContainer, { width: size, height: size }]}
      onPress={() => showTriggerDetails(trigger)}
    >
      <Text style={{ fontSize: size * 0.8 }}>
        {TRIGGER_ICONS[trigger] || '📌'}
      </Text>
    </TouchableOpacity>
  );
};
```

### Faz 5: Apple Health Entegrasyonu (Sprint 3-4)

#### 5.1 Veri Dönüşüm Katmanı

```typescript
// services/healthKitIntegration.ts
import { 
  HKQuantityTypeIdentifier,
  HKCategoryTypeIdentifier 
} from '@kingstinct/react-native-healthkit';

export class HealthKitMoodSync {
  // ObsessLess → Apple Health dönüşümü
  static toHealthKit(moodEntry: MoodEntry): HKMoodSample {
    return {
      type: HKCategoryTypeIdentifier.mindfulSession,
      startDate: moodEntry.timestamp,
      endDate: moodEntry.timestamp,
      metadata: {
        // Valans dönüşümü: (1-10) → (-1 to +1)
        valence: (moodEntry.mood_score - 5.5) / 4.5,
        // Enerji Apple Health'te yok, metadata olarak ekle
        energy: moodEntry.energy_level,
        anxiety: moodEntry.anxiety_level,
        notes: moodEntry.notes,
        triggers: JSON.stringify(moodEntry.triggers),
        source: 'ObsessLess'
      }
    };
  }
  
  // Apple Health → ObsessLess dönüşümü
  static fromHealthKit(sample: HKMoodSample): Partial<MoodEntry> {
    const valence = sample.metadata?.valence || 0;
    return {
      mood_score: Math.round((valence * 4.5) + 5.5),
      energy_level: sample.metadata?.energy || 5,
      anxiety_level: sample.metadata?.anxiety || 5,
      notes: sample.metadata?.notes || '',
      triggers: sample.metadata?.triggers 
        ? JSON.parse(sample.metadata.triggers) 
        : [],
      timestamp: sample.startDate,
      source: 'apple_health'
    };
  }
  
  // İki yönlü senkronizasyon
  async syncBidirectional() {
    // 1. Apple Health'ten yeni verileri al
    const healthKitData = await this.fetchFromHealthKit();
    
    // 2. Lokal veri ile karşılaştır
    const localData = await moodTracker.getMoodEntries();
    
    // 3. Conflict resolution
    const merged = await this.intelligentMerge(healthKitData, localData);
    
    // 4. Güncellemeleri yaz
    await this.updateBothSources(merged);
  }
}
```

#### 5.2 İzin Yönetimi

```tsx
// hooks/useHealthKit.ts
export const useHealthKit = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  
  const requestAuthorization = async () => {
    try {
      const permissions = {
        read: [
          HKCategoryTypeIdentifier.mindfulSession,
          HKQuantityTypeIdentifier.heartRateVariabilitySDNN
        ],
        write: [
          HKCategoryTypeIdentifier.mindfulSession
        ]
      };
      
      const authorized = await HealthKit.requestAuthorization(permissions);
      setIsAuthorized(authorized);
      
      if (authorized) {
        // İlk senkronizasyonu başlat
        await HealthKitMoodSync.syncBidirectional();
      }
    } catch (error) {
      console.error('HealthKit authorization failed:', error);
    }
  };
  
  return {
    isAuthorized,
    requestAuthorization
  };
};
```

## 📊 Performans Optimizasyonları

### 1. Veri Yükleme Stratejisi

```typescript
// services/moodDataLoader.ts
export class OptimizedMoodDataLoader {
  private cache = new Map();
  
  async loadTimeRange(
    userId: string, 
    range: TimeRange
  ): Promise<MoodJourneyExtended> {
    const cacheKey = `${userId}-${range}`;
    
    // Cache kontrolü
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 dk
        return cached.data;
      }
    }
    
    // Progressive loading
    const data = await this.loadProgressively(userId, range);
    
    // Cache güncelleme
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    
    return data;
  }
  
  private async loadProgressively(
    userId: string,
    range: TimeRange
  ): Promise<MoodJourneyExtended> {
    // İlk yükleme: Son 7 gün (hızlı)
    const quickData = await this.loadWeek(userId);
    
    // Arka planda devam et
    InteractionManager.runAfterInteractions(async () => {
      if (range !== 'week') {
        const fullData = await this.loadFullRange(userId, range);
        this.updateCache(userId, range, fullData);
      }
    });
    
    return quickData;
  }
}
```

### 2. Render Optimizasyonu

```tsx
// components/mood/OptimizedMoodChart.tsx
const OptimizedMoodChart = React.memo(
  ({ data, timeRange, onDayPress }) => {
    // Heavy calculations memoized
    const processedData = useMemo(() => 
      processChartData(data, timeRange),
      [data, timeRange]
    );
    
    // Callback memoization
    const handleDayPress = useCallback((day) => {
      InteractionManager.runAfterInteractions(() => {
        onDayPress(day);
      });
    }, [onDayPress]);
    
    // Virtualization for large datasets
    if (processedData.points.length > 365) {
      return (
        <VirtualizedChart
          data={processedData}
          onDayPress={handleDayPress}
        />
      );
    }
    
    return (
      <StandardChart
        data={processedData}
        onDayPress={handleDayPress}
      />
    );
  },
  // Custom comparison
  (prevProps, nextProps) => {
    return (
      prevProps.timeRange === nextProps.timeRange &&
      isEqual(prevProps.data.statistics, nextProps.data.statistics)
    );
  }
);
```

## 🎨 Erişilebilirlik İyileştirmeleri

### 1. Renk Körlüğü Desteği

```typescript
// utils/accessibleColors.ts
export const getAccessiblePalette = (mode: ColorBlindMode) => {
  switch (mode) {
    case 'protanopia': // Kırmızı körlüğü
      return {
        positive: '#0066CC',
        negative: '#FF9900',
        neutral: '#999999'
      };
    case 'deuteranopia': // Yeşil körlüğü
      return {
        positive: '#0099FF',
        negative: '#FF6600',
        neutral: '#999999'
      };
    case 'tritanopia': // Mavi körlüğü
      return {
        positive: '#00AA00',
        negative: '#FF0066',
        neutral: '#999999'
      };
    default:
      return DEFAULT_PALETTE;
  }
};
```

### 2. Screen Reader Desteği

```tsx
// components/mood/AccessibleMoodBar.tsx
export const AccessibleMoodBar = ({ day, mood, energy }) => {
  const description = `${day} günü, mood skoru ${mood} üzerinden 10, 
    enerji seviyesi ${energy} üzerinden 10. 
    ${mood > 7 ? 'Pozitif' : mood < 4 ? 'Negatif' : 'Nötr'} bir gün.`;
  
  return (
    <TouchableOpacity
      accessible={true}
      accessibilityLabel={description}
      accessibilityRole="button"
      accessibilityHint="Detayları görmek için çift dokunun"
    >
      <MoodBar {...props} />
    </TouchableOpacity>
  );
};
```

## 📅 Uygulama Takvimi

### Sprint 1 (Hafta 1-2)
- [x] Plan ve tasarım dokümanı
- [ ] Chart kütüphanesi seçimi ve kurulumu
- [ ] Veri modeli genişletmesi
- [ ] Temel zaman seçici UI

### Sprint 2 (Hafta 3-4)
- [ ] İnteraktif grafik implementasyonu
- [ ] Detay modal/sayfa geliştirmesi
- [ ] Animasyonlar ve micro-interactions
- [ ] Performance optimizasyonları

### Sprint 3 (Hafta 5-6)
- [ ] Güven göstergeleri
- [ ] Tetikleyici ikonları sistemi
- [ ] Apple Health entegrasyonu başlangıcı
- [ ] Erişilebilirlik iyileştirmeleri

### Sprint 4 (Hafta 7-8)
- [ ] Apple Health senkronizasyonu tamamlama
- [ ] Test ve bug fixing
- [ ] Performance tuning
- [ ] Kullanıcı testleri ve feedback

## 🧪 Test Stratejisi

### Unit Tests
```typescript
// __tests__/mood/chartCalculations.test.ts
describe('Chart Calculations', () => {
  test('should normalize valence correctly', () => {
    expect(normalizeValence(10)).toBe(1);
    expect(normalizeValence(5.5)).toBe(0);
    expect(normalizeValence(1)).toBe(-1);
  });
  
  test('should calculate energy gradient', () => {
    const gradient = getEnergyGradient(8);
    expect(gradient).toContain('#22c55e');
  });
});
```

### Integration Tests
```typescript
// __tests__/mood/moodJourneyIntegration.test.ts
describe('Mood Journey Integration', () => {
  test('should load and display weekly data', async () => {
    const { getByTestId } = render(<MoodJourney />);
    
    await waitFor(() => {
      expect(getByTestId('mood-chart')).toBeTruthy();
    });
    
    const weekTab = getByTestId('time-range-week');
    expect(weekTab).toHaveStyle({ opacity: 1 });
  });
});
```

### E2E Tests
```typescript
// e2e/moodJourney.e2e.ts
describe('Mood Journey E2E', () => {
  it('should navigate through time ranges', async () => {
    await device.launchApp();
    await element(by.id('tab-today')).tap();
    
    // Haftalık görünüm default
    await expect(element(by.id('mood-chart-week'))).toBeVisible();
    
    // Aylık görünüme geç
    await element(by.id('time-range-month')).tap();
    await expect(element(by.id('mood-chart-month'))).toBeVisible();
    
    // Detay modalı aç
    await element(by.id('mood-bar-0')).tap();
    await expect(element(by.id('mood-detail-modal'))).toBeVisible();
  });
});
```

## 📈 Başarı Metrikleri

### Teknik Metrikler
- **FPS:** Minimum 55 FPS animasyonlarda
- **TTI (Time to Interactive):** < 1 saniye
- **Memory Usage:** < 150MB
- **Cache Hit Rate:** > 80%

### Kullanıcı Metrikleri
- **Engagement Rate:** %30 artış hedefi
- **Daily Active Usage:** %25 artış
- **Feature Adoption:** İlk ayda %60 kullanım
- **User Satisfaction:** 4.5+ app store rating

### Business Metrikleri
- **Retention:** 30 günlük retention %20 artış
- **Session Duration:** Ortalama %40 artış
- **Premium Conversion:** %15 artış (gelişmiş özellikler için)

## 🚀 Sonuç ve Öneriler

Bu plan, Apple Health'in kanıtlanmış UX patternlerini ObsessLess'in güçlü teknik altyapısıyla birleştirerek, kullanıcılara hem bilimsel hem de kullanışlı bir deneyim sunmayı hedefliyor.

### Öncelikli Aksiyonlar:
1. **Chart kütüphanesi seçimi** (Wagmi Charts öneriliyor)
2. **Veri modeli genişletmesi** için backend hazırlığı
3. **UI/UX mockup'ları** ve kullanıcı testleri
4. **Progressive enhancement** yaklaşımıyla aşamalı geliştirme

### Risk Yönetimi:
- **Performance:** Büyük veri setleri için virtualization kullanımı
- **Compatibility:** iOS/Android farklılıkları için platform-specific kod
- **Privacy:** Apple Health verilerinin güvenli işlenmesi
- **Complexity:** Feature flag'lerle aşamalı rollout

---

**Hazırlayan:** AI Assistant  
**Tarih:** 26 Ocak 2025  
**Durum:** ✅ Onay Bekliyor
