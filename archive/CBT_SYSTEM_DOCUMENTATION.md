# 🧠 CBT System Documentation

## 📋 Genel Bakış

CBT (Cognitive Behavioral Therapy) sistemi, kullanıcıların olumsuz düşünce kalıplarını tanımlamasına ve yeniden çerçevelemesine yardımcı olan 4-adımlı bir terapötik araçtır.

## 🏗️ Sistem Mimarisi

### Temel Bileşenler

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CBT Screen    │───▶│  CBTQuickEntry   │───▶│  Data Storage   │
│   (FAB Button)  │    │  (4-Step Form)   │    │ (Async+Supabase)│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│ Voice Trigger   │    │   CBT Engine     │
│ (Today Screen)  │    │ (AI Analysis)    │
└─────────────────┘    └──────────────────┘
```

### Dosya Yapısı

```
app/(tabs)/
├── cbt.tsx                    # Ana CBT sayfası

components/forms/
├── CBTQuickEntry.tsx          # 4-adımlı form bileşeni

features/ai/engines/
├── cbtEngine.ts              # CBT AI motoru

services/
├── supabase.ts               # Veri saklama servisleri

supabase/migrations/
├── 2025-08-19_add_cbt_records.sql  # Veritabanı şeması
```

## 🔄 4-Adımlı CBT Süreci

### Adım 1: Düşünce Girişi
```typescript
interface ThoughtStep {
  thought: string;           // Ana olumsuz düşünce
  trigger?: string;          // Tetikleyici olay (opsiyonel)
  moodBefore: number;        // Başlangıç mood (1-10)
}
```

**UI Özellikleri:**
- Çok satırlı metin alanı (120px min yükseklik)
- Empatik placeholder metni
- Mood slider (1-10 skala)
- Tetikleyici olay girişi (opsiyonel)

### Adım 2: Bilişsel Çarpıtmalar
```typescript
const COGNITIVE_DISTORTIONS = [
  {
    id: 'catastrophizing',
    label: 'Felaketleştirme',
    description: 'En kötü senaryoyu düşünme'
  },
  {
    id: 'all_or_nothing',
    label: 'Hep ya da Hiç',
    description: 'Sadece siyah-beyaz düşünme'
  },
  // ... diğer çarpıtmalar
];
```

**AI Destekli Analiz:**
```typescript
const analyzeThought = async () => {
  const analysis = await cbtEngine.analyzeThought(thought);
  setAiDistortions(analysis.suggestedDistortions);
};
```

### Adım 3: Kanıt Toplama
```typescript
interface EvidenceStep {
  evidenceFor: string;       // Düşünceyi destekleyen kanıtlar
  evidenceAgainst: string;   // Düşünceyi çürüten kanıtlar
}
```

**Guided Questions:**
- "Bu düşünceyi destekleyen gerçekler neler?"
- "Bu düşünceye karşı hangi kanıtlar var?"
- "Objektif bir gözlemci ne düşünürdü?"

### Adım 4: Yeniden Çerçeveleme
```typescript
interface ReframeStep {
  reframe: string;           // Yeni, dengeli düşünce
  moodAfter: number;         // Son mood (1-10)
}
```

**AI Destekli Öneriler:**
```typescript
const generateReframeSuggestions = async () => {
  const suggestions = await cbtEngine.generateReframes({
    thought,
    distortions: selectedDistortions,
    evidenceFor,
    evidenceAgainst
  });
  setAiReframes(suggestions);
};
```

## 💾 Veri Saklama

### Supabase Schema
```sql
CREATE TABLE public.thought_records (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    automatic_thought text NOT NULL,
    distortions text[] DEFAULT '{}'::text[],
    evidence_for text,
    evidence_against text,
    new_view text NOT NULL,
    mood_before integer,
    mood_after integer,
    trigger text,
    notes text,
    lang text DEFAULT 'tr'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
```

### Offline-First Yaklaşım
```typescript
// 1. Önce AsyncStorage'a kaydet
const localRecord = {
  id: `cbt_${Date.now()}`,
  thought,
  distortions: selectedDistortions,
  evidenceFor,
  evidenceAgainst,
  reframe,
  moodBefore,
  moodAfter,
  trigger,
  timestamp: new Date().toISOString()
};

await AsyncStorage.setItem(
  `${StorageKeys.CBT_RECORDS}_${user.id}`,
  JSON.stringify([...existingRecords, localRecord])
);

// 2. Sonra Supabase'e senkronize et
try {
  await supabaseService.saveCBTRecord({
    user_id: user.id,
    thought,
    distortions: selectedDistortions,
    evidence_for: evidenceFor,
    evidence_against: evidenceAgainst,
    reframe,
    mood_before: moodBefore,
    mood_after: moodAfter,
    trigger
  });
} catch (error) {
  // Dead Letter Queue'ya ekle
  await deadLetterQueue.addToDeadLetter(record, error);
}
```

## 🎨 UI/UX Tasarım

### Master Prompt Uyumluluğu

#### Sakinlik İlkesi
```typescript
const styles = {
  container: {
    backgroundColor: '#FAFBFC',  // Yumuşak arka plan
  },
  primaryButton: {
    backgroundColor: '#6366F1',   // Sakin mavi ton
    shadowOpacity: 0.15,         // Yumuşak gölge
  },
  textArea: {
    borderRadius: 16,            // Yumuşak köşeler
    borderColor: '#E5E7EB',      // Düşük kontrast
  }
};
```

#### Güç İlkesi
- Kullanıcı her adımda geri dönebilir
- Şeffaf progress indicator
- Açık ve anlaşılır yönergeler
- Veri kontrolü kullanıcıda

#### Zahmetsizlik İlkesi
- Tek FAB butonu ile erişim
- Otomatik kaydetme
- AI destekli öneriler
- Sezgisel form akışı

### BottomSheet Implementasyonu
```typescript
<BottomSheet
  isVisible={visible}
  onClose={onDismiss}
  edgeToEdge={true}
>
  <View style={styles.container}>
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.title}>Düşünce Kaydı</Text>
        <Pressable onPress={onDismiss} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={20} color="#9CA3AF" />
        </Pressable>
      </View>
      <Text style={styles.subtitle}>
        Olumsuz düşüncelerinizi yeniden çerçeveleyin
      </Text>
    </View>
    {/* Form içeriği */}
  </View>
</BottomSheet>
```

## 🤖 AI Entegrasyonu

### CBT Engine Özellikleri
```typescript
class CBTEngine {
  async analyzeThought(thought: string): Promise<CBTAnalysis> {
    // Bilişsel çarpıtma tespiti
    const distortions = await this.detectDistortions(thought);
    
    // Severity analizi
    const severity = await this.analyzeSeverity(thought);
    
    // Öneriler
    const suggestions = await this.generateSuggestions(thought);
    
    return { distortions, severity, suggestions };
  }
  
  async generateReframes(context: ReframeContext): Promise<string[]> {
    // Gemini API ile reframe önerileri
    const prompt = this.buildReframePrompt(context);
    const response = await this.callGeminiAPI(prompt);
    return this.parseReframes(response);
  }
}
```

### Therapeutic Prompts
```typescript
const CBT_PROMPTS = {
  distortionAnalysis: `
    Analyze this thought for cognitive distortions.
    Thought: "{thought}"
    
    Identify any of these patterns:
    - Catastrophizing
    - All-or-nothing thinking
    - Mind reading
    - Fortune telling
    - Emotional reasoning
    
    Respond in Turkish with empathy and understanding.
  `,
  
  reframeGeneration: `
    Help create a balanced, realistic alternative to this thought.
    
    Original thought: "{thought}"
    Identified distortions: {distortions}
    Evidence for: "{evidenceFor}"
    Evidence against: "{evidenceAgainst}"
    
    Generate 2-3 balanced, realistic alternative thoughts in Turkish.
  `
};
```

## 📊 Analytics ve Metrics

### Progress Tracking
```typescript
interface CBTStats {
  todayCount: number;
  weekCount: number;
  monthCount: number;
  avgMoodImprovement: number;
  mostCommonDistortion: string;
  successRate: number;  // Mood improvement > 0
}

const calculateStats = (records: ThoughtRecord[]): CBTStats => {
  const today = records.filter(isToday);
  const week = records.filter(isThisWeek);
  const month = records.filter(isThisMonth);
  
  const moodImprovements = records
    .filter(r => r.mood_after && r.mood_before)
    .map(r => r.mood_after - r.mood_before);
  
  const avgImprovement = moodImprovements.length > 0
    ? moodImprovements.reduce((a, b) => a + b, 0) / moodImprovements.length
    : 0;
  
  return {
    todayCount: today.length,
    weekCount: week.length,
    monthCount: month.length,
    avgMoodImprovement: avgImprovement,
    mostCommonDistortion: getMostCommonDistortion(records),
    successRate: moodImprovements.filter(imp => imp > 0).length / moodImprovements.length
  };
};
```

### Telemetry Events
```typescript
// CBT spesifik telemetry
trackAIInteraction('CBT_FORM_STARTED', {
  userId: user.id,
  trigger: 'fab_button' | 'voice_analysis',
  timestamp: new Date().toISOString()
});

trackAIInteraction('CBT_STEP_COMPLETED', {
  userId: user.id,
  step: 'thought' | 'distortions' | 'evidence' | 'reframe',
  duration: stepDuration,
  aiAssistanceUsed: boolean
});

trackAIInteraction('CBT_RECORD_SUBMITTED', {
  userId: user.id,
  moodImprovement: moodAfter - moodBefore,
  distortionCount: selectedDistortions.length,
  completionTime: totalDuration
});
```

## 🧪 Test Stratejisi

### Unit Tests
```typescript
describe('CBTQuickEntry', () => {
  it('should progress through all 4 steps', async () => {
    const { getByText, getByPlaceholderText } = render(<CBTQuickEntry />);
    
    // Step 1: Thought
    fireEvent.changeText(getByPlaceholderText('Aklınızdan geçen düşünceyi yazın...'), 'Test thought');
    fireEvent.press(getByText('Devam Et'));
    
    // Step 2: Distortions
    expect(getByText('Düşünce tuzakları')).toBeTruthy();
    // ... test continues
  });
  
  it('should save record to AsyncStorage and Supabase', async () => {
    // Test data persistence
  });
});
```

### Integration Tests
```typescript
describe('CBT Integration', () => {
  it('should handle voice trigger from Today screen', async () => {
    // Test voice analysis → CBT navigation → form opening
  });
  
  it('should sync offline records when online', async () => {
    // Test offline-first functionality
  });
});
```

## 🔮 Gelecek Geliştirmeler

### v2.0 Özellikleri
- **Advanced AI Analysis**: Daha sofistike çarpıtma tespiti
- **Personalized Suggestions**: Kullanıcı geçmişine dayalı öneriler
- **Progress Insights**: Detaylı ilerleme analizi
- **Mood Patterns**: Mood değişim pattern'leri
- **Export Features**: PDF/CSV export

### v3.0 Vizyonu
- **Real-time Coaching**: Anlık CBT koçluğu
- **Collaborative Features**: Terapist paylaşımı
- **Advanced Analytics**: Makine öğrenmesi insights
- **Multi-modal Input**: Ses + metin + görsel
- **Predictive Interventions**: Proaktif müdahaleler

## 📚 Kaynaklar

### Teorik Temeller
- Beck, A. T. (1976). Cognitive Therapy and the Emotional Disorders
- Burns, D. D. (1980). Feeling Good: The New Mood Therapy
- Greenberger, D. & Padesky, C. A. (2015). Mind Over Mood

### Teknik Referanslar
- React Native BottomSheet Best Practices
- Supabase Real-time Subscriptions
- Gemini API Documentation
- AsyncStorage Performance Guidelines
