/**
 * AI Test Page
 * 
 * Tüm AI özelliklerini test etmek için kapsamlı test sayfası
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Components
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { ChatInterface } from '@/features/ai/components/ChatInterface';
import { AIOnboardingFlow } from '@/features/ai/components/onboarding/AIOnboardingFlow';
import { InsightCard } from '@/features/ai/components/insights/InsightCard';
import { VoiceInterface } from '@/features/ai/components/voice/VoiceInterface';

// Services & Stores
import { aiOnboardingService } from '@/features/ai/services/aiOnboarding';
import { patternRecognitionService } from '@/features/ai/services/patternRecognition';
import { insightsEngine } from '@/features/ai/engines/insightsEngine';
import { useAIChatStore } from '@/features/ai/store/aiChatStore';
import { crisisDetectionService } from '@/features/ai/safety/crisisDetection';

// Types
import { 
  AIMessage,
  TherapeuticInsight
} from '@/features/ai/types';
import { 
  EnhancedInsight,
  InsightCategory,
  InsightPriority
} from '@/features/ai/engines/insightsEngine';

// Constants
import { FEATURE_FLAGS } from '@/constants/featureFlags';

type TestSection = 'chat' | 'onboarding' | 'insights' | 'voice' | 'crisis';

export default function AITestScreen() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<TestSection>('chat');
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  
  // Test states
  const [mockInsights, setMockInsights] = useState<EnhancedInsight[]>([]);
  const [transcriptionResult, setTranscriptionResult] = useState<string>('');
  
  // Chat store
  const chatStore = useAIChatStore();

  useEffect(() => {
    // Initialize stores
    chatStore.initialize();
    
    return () => {
      // Cleanup
      chatStore.shutdown();
    };
  }, []);

  // Test functions
  const runChatTest = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      // Test 1: Create thread
      const thread = chatStore.createThread('test-user');
      addTestResult(`✅ Thread created: ${thread.id}`);
      
      // Test 2: Add messages
      const userMessage: AIMessage = {
        id: 'msg_1',
        content: 'Merhaba, bugün kendimi çok endişeli hissediyorum.',
        role: 'user',
        timestamp: new Date()
      };
      chatStore.addMessage(userMessage);
      addTestResult('✅ User message added');
      
      // Test 3: Crisis detection
      const crisisResult = await crisisDetectionService.analyzeMessage(userMessage);
      addTestResult(`✅ Crisis detection: ${crisisResult.level} (${crisisResult.confidence})`);
      
      // Test 4: Conversation health
      const health = chatStore.getConversationHealth();
      addTestResult(`✅ Conversation health: Engagement ${health.engagementLevel}`);
      
    } catch (error) {
      addTestResult(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runOnboardingTest = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      // Test 1: Start session
      const session = await aiOnboardingService.startSession('test-user');
      addTestResult(`✅ Onboarding session started: ${session.sessionId}`);
      
      // Test 2: Get first question
      const { question, aiEnhancement } = await aiOnboardingService.getNextQuestion();
      addTestResult(`✅ First question: ${question.text}`);
      if (aiEnhancement) {
        addTestResult(`✅ AI enhancement available`);
      }
      
      // Test 3: Submit answer
      const result = await aiOnboardingService.submitAnswer(
        question.id,
        3,
        'Test yanıtı - endişe ve kaygı var'
      );
      addTestResult(`✅ Answer submitted: ${result.success}`);
      
    } catch (error) {
      addTestResult(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runInsightsTest = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      // Mock data
      const mockPatterns = [
        {
          id: 'pattern_1',
          type: 'temporal' as any,
          name: 'Sabah Yoğunlaşması',
          description: 'Sabah saatlerinde artan OKB belirtileri',
          confidence: 0.85,
          frequency: 15,
          severity: 7,
          triggers: ['uyanma', 'kahvaltı'],
          manifestations: ['kontrol', 'temizlik'],
          timeline: {
            firstOccurrence: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            lastOccurrence: new Date(),
            peakTimes: [{ start: '07:00', end: '09:00', intensity: 8 }],
            averageDuration: 45,
            trend: 'stable' as any
          },
          insights: [],
          recommendations: ['Sabah rutini oluşturun']
        }
      ];
      
      const mockContext = {
        userId: 'test-user',
        userProfile: {
          symptomSeverity: 15,
          preferredLanguage: 'tr',
          triggerWords: ['kontrol', 'temizlik'],
          therapeuticGoals: ['Kompulsiyonları azaltmak'],
          communicationStyle: 'supportive' as any
        },
        patterns: mockPatterns,
        recentData: [],
        historicalInsights: [],
        preferences: {
          frequency: 'daily' as any,
          style: 'supportive' as any,
          focusAreas: [InsightCategory.PROGRESS, InsightCategory.PATTERN]
        }
      };
      
      // Generate insights
      const insights = await insightsEngine.generateInsights(mockContext);
      addTestResult(`✅ Generated ${insights.length} insights`);
      
      // Create mock insights for display
      const mockInsightsList: EnhancedInsight[] = [
        {
          id: 'insight_1',
          type: 'progress',
          category: InsightCategory.PROGRESS,
          priority: InsightPriority.HIGH,
          content: 'Bu hafta kompulsiyon sayınızda %20 azalma var! Harika gidiyorsunuz.',
          confidence: 0.9,
          clinicalRelevance: 0.85,
          timestamp: new Date(),
          actionable: true,
          actions: [
            {
              id: 'view_progress',
              label: 'İlerleme Detayları',
              type: 'resource',
              data: {}
            }
          ]
        },
        {
          id: 'insight_2',
          type: 'pattern',
          category: InsightCategory.PATTERN,
          priority: InsightPriority.MEDIUM,
          content: 'Sabah saatlerinde OKB belirtileriniz artıyor. Sabah rutini oluşturmak faydalı olabilir.',
          confidence: 0.85,
          clinicalRelevance: 0.8,
          timestamp: new Date(),
          actionable: true,
          actions: [
            {
              id: 'morning_routine',
              label: 'Sabah Rutini Oluştur',
              type: 'exercise',
              data: {}
            }
          ]
        },
        {
          id: 'insight_3',
          type: 'suggestion',
          category: InsightCategory.MOTIVATION,
          priority: InsightPriority.LOW,
          content: 'Her küçük adım önemlidir. Bugün attığınız adımlar, yarının başarısını inşa eder.',
          confidence: 0.95,
          clinicalRelevance: 0.6,
          timestamp: new Date(),
          actionable: false
        }
      ];
      
      setMockInsights(mockInsightsList);
      addTestResult('✅ Mock insights created for display');
      
    } catch (error) {
      addTestResult(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runVoiceTest = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      addTestResult('🎤 Voice test başlatıldı');
      addTestResult('ℹ️ Mikrofon butonuna basarak ses kaydı yapabilirsiniz');
      addTestResult('ℹ️ Gerçek STT servisi olmadığı için mock transkripsiyon gösterilecek');
    } catch (error) {
      addTestResult(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runCrisisTest = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      // Test various crisis scenarios
      const testMessages = [
        {
          content: 'Normal bir gün geçiriyorum',
          expected: 'none'
        },
        {
          content: 'Çok endişeliyim ve panik oluyorum',
          expected: 'moderate'
        },
        {
          content: 'Kendime zarar vermek istiyorum',
          expected: 'high/critical'
        }
      ];
      
      for (const test of testMessages) {
        const message: AIMessage = {
          id: `test_${Date.now()}`,
          content: test.content,
          role: 'user',
          timestamp: new Date()
        };
        
        const result = await crisisDetectionService.analyzeMessage(message);
        addTestResult(`📝 "${test.content}"`);
        addTestResult(`   → Level: ${result.level} (Expected: ${test.expected})`);
        addTestResult(`   → Confidence: ${result.confidence}`);
        if (result.types.length > 0) {
          addTestResult(`   → Types: ${result.types.join(', ')}`);
        }
      }
      
    } catch (error) {
      addTestResult(`❌ Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, result]);
  };

  const handleChatMessage = async (message: string): Promise<AIMessage> => {
    // Mock AI response
    const aiResponse: AIMessage = {
      id: `ai_${Date.now()}`,
      content: 'Bu bir test yanıtıdır. Gerçek AI servisi bağlandığında anlamlı yanıtlar verecektir.',
      role: 'assistant',
      timestamp: new Date(),
      metadata: {
        sessionId: 'test',
        contextType: 'chat'
      }
    };
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return aiResponse;
  };

  const renderTestSection = () => {
    switch (activeSection) {
      case 'chat':
        return (
          <View>
            <Button onPress={runChatTest} disabled={isLoading}>
              Chat Testini Başlat
            </Button>
            
            {FEATURE_FLAGS.AI_CHAT && (
              <View style={styles.componentDemo}>
                <Text style={styles.demoTitle}>Chat Interface Demo:</Text>
                <ChatInterface
                  sessionId="test-session"
                  userId="test-user"
                  onSendMessage={handleChatMessage}
                  onCrisisDetected={() => Alert.alert('Crisis Detected!')}
                />
              </View>
            )}
          </View>
        );
        
      case 'onboarding':
        return (
          <View>
            <Button onPress={runOnboardingTest} disabled={isLoading}>
              Onboarding Testini Başlat
            </Button>
            
            {FEATURE_FLAGS.AI_ONBOARDING && (
              <View style={styles.componentDemo}>
                <Text style={styles.demoTitle}>Onboarding Flow Demo:</Text>
                <Button
                  onPress={() => router.push('/ai-onboarding-demo')}
                  variant="secondary"
                >
                  Full Onboarding Demo
                </Button>
              </View>
            )}
          </View>
        );
        
      case 'insights':
        return (
          <View>
            <Button onPress={runInsightsTest} disabled={isLoading}>
              Insights Testini Başlat
            </Button>
            
            {mockInsights.length > 0 && (
              <View style={styles.componentDemo}>
                <Text style={styles.demoTitle}>Insight Cards Demo:</Text>
                {mockInsights.map(insight => (
                  <InsightCard
                    key={insight.id}
                    insight={insight}
                    onActionPress={(action) => {
                      Alert.alert('Action', `${action.label} clicked`);
                    }}
                    onFeedback={(helpful) => {
                      Alert.alert('Feedback', helpful ? 'Helpful' : 'Not helpful');
                    }}
                    onDismiss={() => {
                      setMockInsights(prev => prev.filter(i => i.id !== insight.id));
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        );
        
      case 'voice':
        return (
          <View>
            <Button onPress={runVoiceTest} disabled={isLoading}>
              Voice Testini Başlat
            </Button>
            
            {FEATURE_FLAGS.AI_VOICE && (
              <View style={styles.componentDemo}>
                <Text style={styles.demoTitle}>Voice Interface Demo:</Text>
                <VoiceInterface
                  onTranscription={(result) => {
                    setTranscriptionResult(result.text);
                    Alert.alert('Transcription', result.text);
                  }}
                  onError={(error) => {
                    Alert.alert('Voice Error', error.message);
                  }}
                />
                {transcriptionResult && (
                  <Card style={styles.transcriptionCard}>
                    <Text style={styles.transcriptionText}>
                      Son transkripsiyon: {transcriptionResult}
                    </Text>
                  </Card>
                )}
              </View>
            )}
          </View>
        );
        
      case 'crisis':
        return (
          <View>
            <Button onPress={runCrisisTest} disabled={isLoading}>
              Crisis Detection Testini Başlat
            </Button>
            
            <Card style={styles.warningCard}>
              <MaterialCommunityIcons name="alert" size={24} color="#EF4444" />
              <Text style={styles.warningText}>
                Bu test kritik kelimeler içerir. Gerçek kullanımda bu kelimeler
                acil müdahale protokollerini tetikleyecektir.
              </Text>
            </Card>
          </View>
        );
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'AI Test',
          headerLeft: () => (
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#374151"
              onPress={() => router.back()}
              style={{ marginLeft: 16 }}
            />
          ),
        }}
      />
      
      <SafeAreaView style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Feature Status */}
          <Card style={styles.statusCard}>
            <Text style={styles.statusTitle}>AI Feature Status</Text>
            <View style={styles.statusGrid}>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons
                  name={FEATURE_FLAGS.AI_CHAT ? 'check-circle' : 'close-circle'}
                  size={20}
                  color={FEATURE_FLAGS.AI_CHAT ? '#10B981' : '#EF4444'}
                />
                <Text style={styles.statusLabel}>Chat</Text>
              </View>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons
                  name={FEATURE_FLAGS.AI_ONBOARDING ? 'check-circle' : 'close-circle'}
                  size={20}
                  color={FEATURE_FLAGS.AI_ONBOARDING ? '#10B981' : '#EF4444'}
                />
                <Text style={styles.statusLabel}>Onboarding</Text>
              </View>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons
                  name={FEATURE_FLAGS.AI_INSIGHTS ? 'check-circle' : 'close-circle'}
                  size={20}
                  color={FEATURE_FLAGS.AI_INSIGHTS ? '#10B981' : '#EF4444'}
                />
                <Text style={styles.statusLabel}>Insights</Text>
              </View>
              <View style={styles.statusItem}>
                <MaterialCommunityIcons
                  name={FEATURE_FLAGS.AI_VOICE ? 'check-circle' : 'close-circle'}
                  size={20}
                  color={FEATURE_FLAGS.AI_VOICE ? '#10B981' : '#EF4444'}
                />
                <Text style={styles.statusLabel}>Voice</Text>
              </View>
            </View>
          </Card>

          {/* Test Sections */}
          <Card style={styles.sectionsCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(['chat', 'onboarding', 'insights', 'voice', 'crisis'] as TestSection[]).map(section => (
                <Button
                  key={section}
                  onPress={() => setActiveSection(section)}
                  variant={activeSection === section ? 'primary' : 'secondary'}
                  style={styles.sectionButton}
                  size="small"
                >
                  {section.charAt(0).toUpperCase() + section.slice(1)}
                </Button>
              ))}
            </ScrollView>
          </Card>

          {/* Active Test Section */}
          <Card style={styles.testCard}>
            <Text style={styles.sectionTitle}>
              {activeSection.charAt(0).toUpperCase() + activeSection.slice(1)} Test
            </Text>
            
            {renderTestSection()}
            
            {/* Test Results */}
            {testResults.length > 0 && (
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsTitle}>Test Sonuçları:</Text>
                {testResults.map((result, index) => (
                  <Text key={index} style={styles.resultItem}>{result}</Text>
                ))}
              </View>
            )}
            
            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10B981" />
              </View>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  statusCard: {
    margin: 16,
    padding: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
  },
  sectionButton: {
    marginRight: 8,
  },
  testCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  componentDemo: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  resultsContainer: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  resultsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  resultItem: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  warningCard: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#FEE2E2',
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#991B1B',
  },
  transcriptionCard: {
    marginTop: 12,
    padding: 12,
  },
  transcriptionText: {
    fontSize: 14,
    color: '#374151',
  },
}); 