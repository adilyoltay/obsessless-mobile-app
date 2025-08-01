/**
 * Crisis Detection ve Safety System
 * 
 * KRITIK: Bu sistem kullanıcı güvenliği için hayati önem taşır
 * Yanlış pozitif/negatif dengesine dikkat edilmeli
 */

import { FEATURE_FLAGS } from '@/constants/featureFlags';
import { 
  AIMessage,
  AISafetyCheck,
  SafetyViolation,
  AIError,
  AIErrorCode
} from '@/features/ai/types';
import { trackAIInteraction } from '@/features/ai/telemetry/aiTelemetry';
import { AIEventType } from '@/features/ai/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Kriz seviyeleri
export enum CrisisLevel {
  NONE = 'none',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Kriz tipi
export enum CrisisType {
  SUICIDAL_IDEATION = 'suicidal_ideation',
  SELF_HARM = 'self_harm',
  HARM_TO_OTHERS = 'harm_to_others',
  SEVERE_DISTRESS = 'severe_distress',
  PANIC_ATTACK = 'panic_attack',
  PSYCHOTIC_SYMPTOMS = 'psychotic_symptoms',
  SUBSTANCE_ABUSE = 'substance_abuse',
  EATING_DISORDER = 'eating_disorder'
}

// Kriz tespit sonucu
export interface CrisisDetectionResult {
  detected: boolean;
  level: CrisisLevel;
  types: CrisisType[];
  confidence: number;
  triggers: string[];
  recommendations: CrisisRecommendation[];
  requiresImmediateAction: boolean;
}

// Kriz önerisi
export interface CrisisRecommendation {
  type: 'immediate' | 'short_term' | 'long_term';
  action: string;
  resources: CrisisResource[];
  priority: number;
}

// Kriz kaynağı
export interface CrisisResource {
  name: string;
  type: 'hotline' | 'website' | 'app' | 'professional' | 'emergency';
  contact: string;
  available24_7: boolean;
  language: string[];
  description: string;
}

// Güvenlik protokolü
export interface SafetyProtocol {
  id: string;
  name: string;
  triggers: string[];
  actions: ProtocolAction[];
  escalationPath: EscalationPath[];
}

// Protokol aksiyonu
export interface ProtocolAction {
  type: 'notify' | 'block' | 'redirect' | 'alert' | 'log';
  target?: string;
  message?: string;
  data?: any;
}

// Eskalasyon yolu
export interface EscalationPath {
  level: number;
  condition: string;
  action: ProtocolAction;
  timeframe?: number; // dakika
}

class CrisisDetectionService {
  private static instance: CrisisDetectionService;
  private crisisKeywords: Map<CrisisType, string[]>;
  private safetyProtocols: SafetyProtocol[];
  private detectionHistory: CrisisDetectionResult[] = [];
  private emergencyContacts: CrisisResource[];

  private constructor() {
    this.initializeKeywords();
    this.initializeProtocols();
    this.initializeResources();
  }

  static getInstance(): CrisisDetectionService {
    if (!this.instance) {
      this.instance = new CrisisDetectionService();
    }
    return this.instance;
  }

  /**
   * Mesajı kriz açısından analiz et
   */
  async analyzeMessage(message: AIMessage): Promise<CrisisDetectionResult> {
    if (!FEATURE_FLAGS.isEnabled('AI_CHAT')) {
      return this.getDefaultResult();
    }

    const content = message.content.toLowerCase();
    const detectedTypes: CrisisType[] = [];
    const triggers: string[] = [];
    let maxLevel = CrisisLevel.NONE;

    // Keyword bazlı tespit
    for (const [type, keywords] of this.crisisKeywords.entries()) {
      const matchedKeywords = keywords.filter(keyword => 
        content.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        detectedTypes.push(type);
        triggers.push(...matchedKeywords);
        
        // Seviye belirleme
        const level = this.determineLevel(type, matchedKeywords.length);
        if (this.compareLevels(level, maxLevel) > 0) {
          maxLevel = level;
        }
      }
    }

    // Bağlamsal analiz
    const contextualLevel = await this.analyzeContext(message, detectedTypes);
    if (this.compareLevels(contextualLevel, maxLevel) > 0) {
      maxLevel = contextualLevel;
    }

    // Güven skoru hesapla
    const confidence = this.calculateConfidence(detectedTypes, triggers, message);

    // Öneriler oluştur
    const recommendations = this.generateRecommendations(maxLevel, detectedTypes);

    // Acil müdahale gereksinimi
    const requiresImmediateAction = maxLevel === CrisisLevel.CRITICAL || 
                                   maxLevel === CrisisLevel.HIGH;

    const result: CrisisDetectionResult = {
      detected: detectedTypes.length > 0,
      level: maxLevel,
      types: detectedTypes,
      confidence,
      triggers,
      recommendations,
      requiresImmediateAction
    };

    // Sonucu kaydet
    this.detectionHistory.push(result);
    await this.saveDetectionHistory();

    // Telemetri
    if (result.detected) {
      await trackAIInteraction(AIEventType.SAFETY_TRIGGERED, {
        level: result.level,
        types: result.types,
        confidence: result.confidence
      });
    }

    // Protokolleri uygula
    if (result.requiresImmediateAction) {
      await this.executeProtocols(result);
    }

    return result;
  }

  /**
   * Konuşma akışını analiz et
   */
  async analyzeConversation(messages: AIMessage[]): Promise<AISafetyCheck> {
    const violations: SafetyViolation[] = [];
    let overallSafetyScore = 1.0;

    // Son 10 mesajı analiz et
    const recentMessages = messages.slice(-10);
    
    for (const message of recentMessages) {
      const result = await this.analyzeMessage(message);
      
      if (result.detected) {
        // Güvenlik ihlali ekle
        violations.push({
          type: 'crisis_language',
          severity: this.levelToSeverity(result.level),
          description: `${result.types.join(', ')} tespit edildi`,
          suggestedAction: result.recommendations[0]?.action || 'Profesyonel destek önerilir'
        });

        // Güvenlik skorunu düşür
        overallSafetyScore -= (0.2 * this.levelToNumber(result.level));
      }
    }

    // Pattern analizi
    const patterns = this.detectDangerousPatterns(messages);
    if (patterns.length > 0) {
      patterns.forEach(pattern => {
        violations.push({
          type: 'therapeutic_boundary',
          severity: 'medium',
          description: pattern,
          suggestedAction: 'Konuşma akışını yönlendirin'
        });
      });
      overallSafetyScore -= 0.1 * patterns.length;
    }

    const safetyCheck: AISafetyCheck = {
      passed: violations.length === 0,
      score: Math.max(0, Math.min(1, overallSafetyScore)),
      violations,
      recommendations: this.generateSafetyRecommendations(violations)
    };

    return safetyCheck;
  }

  /**
   * Acil durum protokollerini çalıştır
   */
  private async executeProtocols(result: CrisisDetectionResult): Promise<void> {
    console.warn('[CrisisDetection] Executing emergency protocols', result);

    // İlgili protokolleri bul
    const relevantProtocols = this.safetyProtocols.filter(protocol =>
      protocol.triggers.some(trigger => 
        result.types.map(t => t.toString()).includes(trigger)
      )
    );

    // Protokolleri uygula
    for (const protocol of relevantProtocols) {
      for (const action of protocol.actions) {
        await this.executeAction(action, result);
      }
    }

    // Eskalasyon kontrolü
    if (result.level === CrisisLevel.CRITICAL) {
      await this.escalateToProfessional(result);
    }
  }

  /**
   * Tek bir aksiyonu çalıştır
   */
  private async executeAction(
    action: ProtocolAction, 
    result: CrisisDetectionResult
  ): Promise<void> {
    switch (action.type) {
      case 'alert':
        // Kullanıcıya bildirim
        console.log('[CrisisDetection] Alert:', action.message);
        break;
        
      case 'log':
        // Olay kaydı
        await this.logCrisisEvent(result, action);
        break;
        
      case 'notify':
        // Yetkili kişiye bildirim
        if (action.target) {
          await this.notifyEmergencyContact(action.target, result);
        }
        break;
        
      case 'block':
        // Konuşmayı durdur
        console.warn('[CrisisDetection] Conversation blocked due to safety concerns');
        break;
        
      case 'redirect':
        // Güvenli kaynağa yönlendir
        console.log('[CrisisDetection] Redirecting to:', action.target);
        break;
    }
  }

  /**
   * Profesyonel yardıma eskale et
   */
  private async escalateToProfessional(result: CrisisDetectionResult): Promise<void> {
    console.error('[CrisisDetection] CRITICAL: Escalating to professional help');
    
    // Acil durum kaynaklarını getir
    const emergencyResources = this.emergencyContacts.filter(r => 
      r.type === 'emergency' || r.type === 'hotline'
    );

    // Telemetri
    await trackAIInteraction(AIEventType.SAFETY_TRIGGERED, {
      action: 'professional_escalation',
      level: 'critical',
      resources: emergencyResources.map(r => r.name)
    });
  }

  /**
   * Bağlamsal analiz
   */
  private async analyzeContext(
    message: AIMessage, 
    detectedTypes: CrisisType[]
  ): Promise<CrisisLevel> {
    // Önceki mesajları kontrol et
    const history = this.detectionHistory.slice(-5);
    
    // Artan şiddet pattern'i
    if (history.length >= 3) {
      const levels = history.map(h => this.levelToNumber(h.level));
      const isEscalating = levels.every((level, i) => 
        i === 0 || level >= levels[i - 1]
      );
      
      if (isEscalating && levels[levels.length - 1] >= 2) {
        return CrisisLevel.HIGH;
      }
    }

    // Çoklu kriz tipi
    if (detectedTypes.length >= 3) {
      return CrisisLevel.HIGH;
    }

    // Zaman faktörü (gece yarısı mesajları)
    const hour = new Date(message.timestamp).getHours();
    if ((hour >= 0 && hour <= 5) && detectedTypes.length > 0) {
      return CrisisLevel.MODERATE;
    }

    return CrisisLevel.NONE;
  }

  /**
   * Güven skoru hesapla
   */
  private calculateConfidence(
    types: CrisisType[], 
    triggers: string[], 
    message: AIMessage
  ): number {
    let confidence = 0.5; // Başlangıç

    // Tetikleyici sayısı
    confidence += Math.min(0.3, triggers.length * 0.1);

    // Mesaj uzunluğu (kısa mesajlar daha az güvenilir)
    if (message.content.length < 20) {
      confidence -= 0.2;
    }

    // Çoklu tip tespiti
    if (types.length > 1) {
      confidence += 0.1;
    }

    // Metadata varsa
    if (message.metadata?.sentiment === 'negative') {
      confidence += 0.1;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Tehlikeli pattern'leri tespit et
   */
  private detectDangerousPatterns(messages: AIMessage[]): string[] {
    const patterns: string[] = [];

    // Tekrarlayan negatif mesajlar
    const negativeCount = messages.filter(m => 
      m.metadata?.sentiment === 'negative'
    ).length;
    
    if (negativeCount > messages.length * 0.7) {
      patterns.push('Yoğun negatif içerik pattern\'i');
    }

    // Hızlı mesajlaşma (panik belirtisi)
    if (messages.length >= 5) {
      const timeSpan = new Date(messages[messages.length - 1].timestamp).getTime() -
                      new Date(messages[0].timestamp).getTime();
      const avgTime = timeSpan / messages.length;
      
      if (avgTime < 10000) { // 10 saniyeden az
        patterns.push('Panik mesajlaşma pattern\'i');
      }
    }

    // İzolasyon belirtileri
    const isolationKeywords = ['yalnız', 'kimse yok', 'anlamıyor', 'tek başıma'];
    const isolationCount = messages.filter(m =>
      isolationKeywords.some(k => m.content.toLowerCase().includes(k))
    ).length;
    
    if (isolationCount >= 3) {
      patterns.push('Sosyal izolasyon pattern\'i');
    }

    return patterns;
  }

  /**
   * Öneriler oluştur
   */
  private generateRecommendations(
    level: CrisisLevel, 
    types: CrisisType[]
  ): CrisisRecommendation[] {
    const recommendations: CrisisRecommendation[] = [];

    // Acil öneriler
    if (level === CrisisLevel.CRITICAL || level === CrisisLevel.HIGH) {
      recommendations.push({
        type: 'immediate',
        action: 'Hemen profesyonel yardım alın',
        resources: this.emergencyContacts.filter(r => r.type === 'emergency'),
        priority: 1
      });

      recommendations.push({
        type: 'immediate',
        action: 'Güvenli bir ortamda olduğunuzdan emin olun',
        resources: [],
        priority: 2
      });
    }

    // Kısa vadeli öneriler
    if (types.includes(CrisisType.PANIC_ATTACK)) {
      recommendations.push({
        type: 'short_term',
        action: 'Nefes egzersizleri yapın (4-7-8 tekniği)',
        resources: this.getResourcesByType('breathing'),
        priority: 3
      });
    }

    if (types.includes(CrisisType.SEVERE_DISTRESS)) {
      recommendations.push({
        type: 'short_term',
        action: 'Grounding teknikleri uygulayın',
        resources: this.getResourcesByType('grounding'),
        priority: 3
      });
    }

    // Uzun vadeli öneriler
    recommendations.push({
      type: 'long_term',
      action: 'Düzenli terapi seansları planlayın',
      resources: this.emergencyContacts.filter(r => r.type === 'professional'),
      priority: 4
    });

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Güvenlik önerileri oluştur
   */
  private generateSafetyRecommendations(violations: SafetyViolation[]): string[] {
    const recommendations: string[] = [];

    if (violations.some(v => v.type === 'crisis_language')) {
      recommendations.push('Konuşmayı destekleyici ve umut verici tutun');
      recommendations.push('Profesyonel yardım seçeneklerini sunun');
    }

    if (violations.some(v => v.type === 'therapeutic_boundary')) {
      recommendations.push('Terapötik sınırları koruyun');
      recommendations.push('Konuşmayı güvenli konulara yönlendirin');
    }

    if (violations.length > 3) {
      recommendations.push('Bu oturumu sonlandırmayı düşünün');
      recommendations.push('Kullanıcıyı profesyonel desteğe yönlendirin');
    }

    return recommendations;
  }

  // Yardımcı metodlar

  private initializeKeywords() {
    this.crisisKeywords = new Map([
      [CrisisType.SUICIDAL_IDEATION, [
        'intihar', 'kendimi öldürmek', 'yaşamak istemiyorum', 'ölmek istiyorum',
        'hayatıma son vermek', 'yaşamaya değmez', 'her şeyi bitirmek'
      ]],
      [CrisisType.SELF_HARM, [
        'kendime zarar', 'kesme', 'kendimi yaralama', 'acı hissetmek',
        'kendimi cezalandırma', 'jilet', 'kendime vurmak'
      ]],
      [CrisisType.HARM_TO_OTHERS, [
        'zarar vermek', 'öldürmek istiyorum', 'nefret ediyorum', 
        'intikam', 'ona zarar vereceğim', 'şiddet'
      ]],
      [CrisisType.SEVERE_DISTRESS, [
        'dayanamıyorum', 'çok kötüyüm', 'yardım edin', 'kurtarın beni',
        'mahvoldum', 'bittim', 'tükendim'
      ]],
      [CrisisType.PANIC_ATTACK, [
        'nefes alamıyorum', 'kalp krizi', 'ölüyorum', 'boğuluyorum',
        'panik atak', 'kalp çarpıntısı', 'bayılacağım'
      ]],
      [CrisisType.PSYCHOTIC_SYMPTOMS, [
        'sesler duyuyorum', 'beni takip ediyorlar', 'kafamın içinde',
        'gerçek değil', 'halüsinasyon', 'paranoya'
      ]],
      [CrisisType.SUBSTANCE_ABUSE, [
        'alkol', 'uyuşturucu', 'madde', 'sarhoş', 'doz aşımı',
        'bağımlı', 'içmeden duramıyorum'
      ]],
      [CrisisType.EATING_DISORDER, [
        'yemek yiyemiyorum', 'kilo vermek', 'şişman', 'kusma',
        'aç kalma', 'yeme bozukluğu', 'anoreksiya', 'bulimia'
      ]]
    ]);
  }

  private initializeProtocols() {
    this.safetyProtocols = [
      {
        id: 'suicide_protocol',
        name: 'İntihar Protokolü',
        triggers: ['suicidal_ideation'],
        actions: [
          {
            type: 'alert',
            message: 'Kritik durum tespit edildi. Profesyonel yardım gerekiyor.'
          },
          {
            type: 'log',
            data: { severity: 'critical' }
          },
          {
            type: 'redirect',
            target: 'emergency_resources'
          }
        ],
        escalationPath: [
          {
            level: 1,
            condition: 'immediate',
            action: {
              type: 'notify',
              target: 'emergency_contact'
            }
          }
        ]
      },
      {
        id: 'panic_protocol',
        name: 'Panik Atak Protokolü',
        triggers: ['panic_attack'],
        actions: [
          {
            type: 'alert',
            message: 'Sakin olun, size yardımcı olacağız.'
          },
          {
            type: 'redirect',
            target: 'breathing_exercises'
          }
        ],
        escalationPath: []
      }
    ];
  }

  private initializeResources() {
    this.emergencyContacts = [
      {
        name: 'Ruh Sağlığı Destek Hattı',
        type: 'hotline',
        contact: '182',
        available24_7: true,
        language: ['tr'],
        description: '7/24 ücretsiz psikolojik destek'
      },
      {
        name: 'İntihar Önleme Hattı',
        type: 'hotline',
        contact: '182',
        available24_7: true,
        language: ['tr'],
        description: 'Acil kriz müdahalesi'
      },
      {
        name: 'Acil Tıbbi Yardım',
        type: 'emergency',
        contact: '112',
        available24_7: true,
        language: ['tr'],
        description: 'Acil sağlık hizmetleri'
      },
      {
        name: 'KADES',
        type: 'app',
        contact: 'KADES Mobil Uygulama',
        available24_7: true,
        language: ['tr'],
        description: 'Kadına yönelik şiddet acil yardım'
      }
    ];
  }

  private getResourcesByType(type: string): CrisisResource[] {
    // Basit implementasyon
    return this.emergencyContacts.filter(r => 
      r.description.toLowerCase().includes(type)
    );
  }

  private determineLevel(type: CrisisType, keywordCount: number): CrisisLevel {
    // Kritik tipler
    if (type === CrisisType.SUICIDAL_IDEATION || 
        type === CrisisType.HARM_TO_OTHERS) {
      return keywordCount >= 2 ? CrisisLevel.CRITICAL : CrisisLevel.HIGH;
    }

    // Yüksek risk tipleri
    if (type === CrisisType.SELF_HARM || 
        type === CrisisType.PSYCHOTIC_SYMPTOMS) {
      return keywordCount >= 2 ? CrisisLevel.HIGH : CrisisLevel.MODERATE;
    }

    // Orta risk tipleri
    if (type === CrisisType.PANIC_ATTACK || 
        type === CrisisType.SEVERE_DISTRESS) {
      return keywordCount >= 3 ? CrisisLevel.MODERATE : CrisisLevel.LOW;
    }

    return CrisisLevel.LOW;
  }

  private compareLevels(a: CrisisLevel, b: CrisisLevel): number {
    const levels = [
      CrisisLevel.NONE,
      CrisisLevel.LOW,
      CrisisLevel.MODERATE,
      CrisisLevel.HIGH,
      CrisisLevel.CRITICAL
    ];
    return levels.indexOf(a) - levels.indexOf(b);
  }

  private levelToNumber(level: CrisisLevel): number {
    const map = {
      [CrisisLevel.NONE]: 0,
      [CrisisLevel.LOW]: 1,
      [CrisisLevel.MODERATE]: 2,
      [CrisisLevel.HIGH]: 3,
      [CrisisLevel.CRITICAL]: 4
    };
    return map[level] || 0;
  }

  private levelToSeverity(level: CrisisLevel): 'low' | 'medium' | 'high' {
    if (level === CrisisLevel.CRITICAL || level === CrisisLevel.HIGH) {
      return 'high';
    }
    if (level === CrisisLevel.MODERATE) {
      return 'medium';
    }
    return 'low';
  }

  private getDefaultResult(): CrisisDetectionResult {
    return {
      detected: false,
      level: CrisisLevel.NONE,
      types: [],
      confidence: 0,
      triggers: [],
      recommendations: [],
      requiresImmediateAction: false
    };
  }

  private async saveDetectionHistory(): Promise<void> {
    try {
      // Son 100 kaydı tut
      const historyToSave = this.detectionHistory.slice(-100);
      await AsyncStorage.setItem(
        '@crisis_detection_history',
        JSON.stringify(historyToSave)
      );
    } catch (error) {
      console.error('[CrisisDetection] Failed to save history:', error);
    }
  }

  private async logCrisisEvent(
    result: CrisisDetectionResult,
    action: ProtocolAction
  ): Promise<void> {
    const event = {
      timestamp: new Date(),
      result,
      action,
      id: `event_${Date.now()}`
    };

    try {
      const existingLogs = await AsyncStorage.getItem('@crisis_event_logs');
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(event);
      
      // Son 1000 olayı tut
      const logsToSave = logs.slice(-1000);
      await AsyncStorage.setItem('@crisis_event_logs', JSON.stringify(logsToSave));
    } catch (error) {
      console.error('[CrisisDetection] Failed to log event:', error);
    }
  }

  private async notifyEmergencyContact(
    target: string,
    result: CrisisDetectionResult
  ): Promise<void> {
    // Gerçek uygulamada SMS, email veya push notification gönderilmeli
    console.warn('[CrisisDetection] Emergency notification:', {
      target,
      level: result.level,
      types: result.types
    });
  }
}

// Singleton export
export const crisisDetectionService = CrisisDetectionService.getInstance(); 