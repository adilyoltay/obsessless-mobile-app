# 🎤 Unified Voice Analysis Implementation

## 📋 Genel Bakış

Unified Voice Analysis sistemi, tüm ses girişlerini merkezi bir noktadan işleyerek kullanıcıları otomatik olarak doğru terapötik modüle yönlendiren AI destekli bir sistemdir.

## 🏗️ Mimari

### Temel Bileşenler

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Today Screen  │───▶│ Unified Voice    │───▶│ Target Screens  │
│   (Ses Girişi)  │    │ Analysis Service │    │ (CBT/OCD/ERP)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Gemini API /    │
                    │ Heuristic Engine │
                    └──────────────────┘
```

### Dosya Yapısı

```
features/ai/services/
├── checkinService.ts          # Ana unified analysis servisi
├── audioAdapter.ts           # Ses işleme adaptörü
└── voiceRecognitionService.ts # STT servisi

app/(tabs)/
├── index.tsx                 # Today screen (merkezi ses girişi)
├── cbt.tsx                  # CBT sayfası (FAB + voice trigger)
├── tracking.tsx             # OCD tracking (voice trigger)
└── erp.tsx                  # ERP sayfası (voice trigger)
```

## 🔧 Teknik Detaylar

### UnifiedAnalysisResult Interface

```typescript
interface UnifiedAnalysisResult {
  type: 'MOOD' | 'CBT' | 'OCD' | 'ERP' | 'BREATHWORK';
  confidence: number;
  suggestion?: string;
  parameters?: {
    text?: string;
    trigger?: string;
    category?: string;
  };
}
```

### Ana Fonksiyon: unifiedVoiceAnalysis

```typescript
export async function unifiedVoiceAnalysis(text: string): Promise<UnifiedAnalysisResult> {
  // 1. Heuristik analiz (fallback)
  const heuristicResult = heuristicVoiceAnalysis(text);
  
  // 2. Gemini API analizi (eğer mevcut)
  if (EXPO_PUBLIC_GEMINI_API_KEY && featureFlags.AI_UNIFIED_VOICE) {
    try {
      const geminiResult = await analyzeWithGemini(text, EXPO_PUBLIC_GEMINI_API_KEY);
      return geminiResult || heuristicResult;
    } catch (error) {
      console.warn('Gemini analysis failed, using heuristic fallback');
      return heuristicResult;
    }
  }
  
  return heuristicResult;
}
```

### Heuristik Analiz Kuralları

```typescript
const CBT_PATTERNS = [
  /düşün(ce|üyor|dü)/i,
  /korku(yor|m|ları)/i,
  /endişe/i,
  /çarpıtma/i
];

const OCD_PATTERNS = [
  /kompuls/i,
  /takıntı/i,
  /kontrol/i,
  /temizl(ik|e)/i
];

const ERP_PATTERNS = [
  /maruz/i,
  /egzersiz/i,
  /alıştırma/i,
  /karşılaş/i
];
```

## 🎯 Kullanım Senaryoları

### Senaryo 1: Mood Check-in
```
Kullanıcı: "Bugün kendimi çok gergin hissediyorum"
Analiz: MOOD (confidence: 0.9)
Sonuç: Mood kaydı oluşturulur, Today screen'de kalır
```

### Senaryo 2: CBT Trigger
```
Kullanıcı: "Sürekli kötü bir şey olacak diye düşünüyorum"
Analiz: CBT (confidence: 0.85)
Sonuç: CBT sayfasına yönlendirme, form otomatik açılır
```

### Senaryo 3: OCD Tracking
```
Kullanıcı: "Kapıyı 5 kez kontrol ettim"
Analiz: OCD (confidence: 0.9)
Sonuç: Tracking sayfasına yönlendirme, kompulsiyon formu açılır
```

## 📊 Veri Akışı

### 1. Ses Girişi (Today Screen)
```typescript
const handleVoiceTranscription = async (result: any) => {
  const analysis = await unifiedVoiceAnalysis(result.text || '');
  
  switch (analysis.type) {
    case 'MOOD':
      // Mood kaydı oluştur
      break;
    case 'CBT':
      router.push({
        pathname: '/(tabs)/cbt',
        params: { text: analysis.parameters?.text, trigger: 'voice' }
      });
      break;
    case 'OCD':
      router.push({
        pathname: '/(tabs)/tracking',
        params: { text: analysis.parameters?.text, category: analysis.parameters?.category }
      });
      break;
    // ... diğer case'ler
  }
};
```

### 2. Hedef Sayfa İşleme
```typescript
// CBT sayfasında
useEffect(() => {
  if (params.trigger === 'voice' && params.text) {
    setShowQuickEntry(true); // Form'u aç
  }
}, [params]);

// OCD sayfasında
useEffect(() => {
  if (params.text && params.category) {
    setShowQuickEntry(true); // Kompulsiyon formu aç
  }
}, [params]);
```

## 🔄 Migration Süreci

### Önceki Durum
- Her sayfada ayrı VoiceMoodCheckin bileşeni
- Dağınık ses işleme mantığı
- Tutarsız kullanıcı deneyimi

### Sonraki Durum
- Merkezi ses analizi (Today screen)
- Otomatik tip tespiti ve yönlendirme
- Tutarlı BottomSheet deneyimi

### Kaldırılan Özellikler
```typescript
// Bu bileşenler kaldırıldı:
- VoiceMoodCheckin (CBT sayfasından)
- Ses check-in butonları (OCD, ERP sayfalarından)
- CBT tab (bottom navigation'dan)
```

## 🎨 UI/UX İyileştirmeleri

### Master Prompt Uyumluluğu
- **Sakinlik**: Yumuşak renkler (#6366F1), minimal tasarım
- **Güç**: Kullanıcı kontrolü, şeffaf süreçler
- **Zahmetsizlik**: Tek tıkla erişim, otomatik yönlendirme

### BottomSheet Standardizasyonu
```typescript
// Tüm modüllerde tutarlı BottomSheet kullanımı
<BottomSheet
  isVisible={visible}
  onClose={onDismiss}
  edgeToEdge={true}
>
  {/* İçerik */}
</BottomSheet>
```

## 🧪 Test Stratejisi

### Unit Tests
```typescript
describe('unifiedVoiceAnalysis', () => {
  it('should detect CBT patterns correctly', async () => {
    const result = await unifiedVoiceAnalysis('Sürekli kötü düşünüyorum');
    expect(result.type).toBe('CBT');
    expect(result.confidence).toBeGreaterThan(0.7);
  });
});
```

### Integration Tests
```typescript
describe('Voice Analysis Integration', () => {
  it('should navigate to CBT page with correct parameters', async () => {
    // Test navigation flow
  });
});
```

## 📈 Performans Metrikleri

### Telemetry Events
```typescript
// Yeni telemetry events
- UNIFIED_VOICE_ANALYSIS_STARTED
- UNIFIED_VOICE_ANALYSIS_COMPLETED
- UNIFIED_VOICE_ANALYSIS_FAILED
- GEMINI_API_FALLBACK_USED
- HEURISTIC_ANALYSIS_USED
```

### KPI'lar
- Analiz doğruluğu (accuracy rate)
- Yanıt süresi (response time)
- Fallback kullanım oranı
- Kullanıcı memnuniyeti (navigation success rate)

## 🔮 Gelecek Planları

### v2.0 Özellikleri
- Daha gelişmiş NLP modelleri
- Context-aware analiz
- Çok dilli destek
- Öğrenen algoritma (user feedback based)

### Potansiyel İyileştirmeler
- Ses tonalite analizi
- Duygusal durum tespiti
- Kişiselleştirilmiş pattern recognition
- Real-time feedback sistemi
