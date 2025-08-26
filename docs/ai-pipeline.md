# Unified AI Pipeline – Merkezi AI İşlem Hattı

ObsessLess uygulamasındaki tüm AI analizleri tek bir giriş noktasından geçer: **UnifiedAIPipeline**. Bu sistem, progressive UI, zengin telemetry ve context-aware processing sağlar.

## Temel Prensipler

### 1. Single Entry Point (Tek Giriş Noktası)
- **Tüm AI işlemleri** `unifiedPipeline.process()` üzerinden yapılır
- CoreAnalysisService veya diğer AI servisler doğrudan kullanılmaz
- Tutarlı hata yönetimi ve telemetry

### 2. Progressive UI Pattern
- **Immediate Response**: Heuristik tabanlı hızlı yanıt
- **Background Processing**: LLM tabanlı derinlemesine analiz
- Kullanıcı asla beklemez, sürekli geri bildirim alır

### 3. Context Injection (Bağlam Enjeksiyonu)
- Kullanıcı profili otomatik olarak AI analizine enjekte edilir
- Non-breaking metadata enhancement
- Privacy-first approach

## Input/Output Types

### UnifiedPipelineInput
```typescript
interface UnifiedPipelineInput {
  userId: string;                    // User identifier (required)
  content: string | object;          // Input content (voice, text, data)
  type: 'voice' | 'data' | 'mixed';  // Input type for routing
  context?: {
    source: 'today' | 'mood' | 'tracking' | 'cbt';  // App context
    timestamp?: number;                               // Optional timestamp
    metadata?: Record<string, any>;                  // Additional metadata
  };
}
```

### UnifiedPipelineResult
```typescript
interface UnifiedPipelineResult {
  // Voice analysis results
  voice?: {
    category: 'MOOD' | 'BREATHWORK' | 'ERP' | 'OTHER';
    confidence: number;              // 0.0 - 1.0
    suggestion?: string;             // User-facing suggestion
    reasoning?: string;              // Internal reasoning (debug)
  };
  
  // Pattern recognition results
  patterns?: {
    triggers: string[];              // Identified triggers
    coping_strategies: string[];     // Suggested coping mechanisms
    risk_level: 'low' | 'medium' | 'high';
  };
  
  // Insights and analytics
  insights?: {
    mood_trend: 'improving' | 'stable' | 'declining';
    key_insights: string[];
    recommendations: string[];
  };
  
  // Analytics data
  analytics?: {
    mood?: MoodAnalytics;
    breathwork?: BreathworkAnalytics;
    progress?: ProgressAnalytics;
  };
  
  // Metadata (always present)
  metadata: {
    processedAt: number;             // Processing timestamp
    cacheTTL: number;                // Cache time-to-live
    source: 'cache' | 'fresh';       // Result source
    processing_time?: number;        // Processing duration
    model_version?: string;          // AI model version
  };
}
```

## Usage Examples

### Basic Voice Analysis
```typescript
import { unifiedPipeline } from '@/features/ai/core/UnifiedAIPipeline';

const analyzeVoiceInput = async (userId: string, voiceText: string) => {
  try {
    const result = await unifiedPipeline.process({
      userId,
      content: voiceText,
      type: 'voice',
      context: { 
        source: 'today',
        timestamp: Date.now()
      }
    });
    
    // Handle immediate response (heuristic)
    if (result.voice) {
      showImmediateFeedback(result.voice.suggestion);
    }
    
    // Handle detailed analysis (LLM)
    if (result.insights) {
      updateUIWithInsights(result.insights);
    }
    
    return result;
  } catch (error) {
    console.error('Voice analysis failed:', error);
    showErrorMessage('Analiz şu anda kullanılamıyor');
  }
};
```

## Context Integration

### User Profile Adapter
**File**: `features/ai/context/userProfileAdapter.ts`

```typescript
const loadUserProfileContext = async (userId: string): Promise<UserProfileContext> => {
  try {
    // Priority 1: Local snapshot (fastest)
    const localProfile = await AsyncStorage.getItem('profile_v2');
    if (localProfile) {
      const parsed = JSON.parse(localProfile);
      return normalizeProfileContext(parsed);
    }
    
    // Priority 2: Legacy fallback
    const legacyProfile = await AsyncStorage.getItem('onb_v1_payload');
    if (legacyProfile) {
      const parsed = JSON.parse(legacyProfile);
      return migrateLegacyContext(parsed);
    }
    
    // Priority 3: Remote fetch (slower but complete)
    const remoteProfile = await supabaseService.getUserProfile(userId);
    if (remoteProfile) {
      return normalizeProfileContext(remoteProfile);
    }
    
    // Fallback: empty context
    return { motivations: [] };
  } catch (error) {
    console.warn('Failed to load user profile context:', error);
    return { motivations: [] };
  }
};
```

### Non-Breaking Context Enhancement
Pipeline metadata'da non-breaking ağırlıklandırma:
- `reminderBoost`: Hatırlatıcı aktif kullanıcılar için boost
- `sleepContext`: Uyku durumu bağlamı
- `motivationTags`: Motivasyon faktörleri
- `profileCompleteness`: Profil tamamlama oranı

## Telemetry Integration

### Key Events
- `UNIFIED_PIPELINE_STARTED`: Pipeline başlangıç
- `UNIFIED_PIPELINE_COMPLETED`: Pipeline tamamlama
- `UNIFIED_PIPELINE_ERROR`: Pipeline hata
- `UNIFIED_PIPELINE_CACHE_HIT`: Cache hit
- `UNIFIED_PIPELINE_CACHE_MISS`: Cache miss

## İlgili Bölümler

- [**Onboarding v2**](./onboarding-v2.md) – User context integration
- [**Architecture**](./architecture.md) – System design overview
- [**Data Model**](./data-model.md) – Context data structures
- [**Troubleshooting**](./troubleshooting.md) – AI pipeline issues and solutions
