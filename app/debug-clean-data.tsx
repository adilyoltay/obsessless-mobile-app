/**
 * Debug Clean Data Screen
 * 
 * DANGEROUS: Test için tüm mood data'yı temizleme utility'si.
 * /debug-clean-data URL'i ile erişim.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Pressable,
  ScrollView,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import MoodDataCleanupService from '@/utils/moodDataCleanup';
import { Card } from '@/components/ui/Card';

export default function DebugCleanData() {
  const { user } = useAuth();
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyzeData = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const result = await MoodDataCleanupService.analyzeMoodDataState(user.id);
      setAnalysis(result);
      console.log('🔍 Data analysis result:', result);
    } catch (error) {
      console.error('Analysis failed:', error);
      Alert.alert('Error', 'Data analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCleanData = () => {
    if (confirmText !== 'CLEAN_ALL_MOOD_DATA_CONFIRMED') {
      Alert.alert(
        'Invalid Confirmation',
        'Type exactly: CLEAN_ALL_MOOD_DATA_CONFIRMED'
      );
      return;
    }

    Alert.alert(
      '🚨 DESTRUCTIVE OPERATION',
      'This will permanently delete ALL mood data for this user. This cannot be undone. Are you absolutely sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE ALL DATA',
          style: 'destructive',
          onPress: async () => {
            if (!user?.id) return;
            
            setLoading(true);
            try {
              const result = await MoodDataCleanupService.cleanAllMoodData(
                user.id,
                'CLEAN_ALL_MOOD_DATA_CONFIRMED'
              );
              setCleanupResult(result);
              setConfirmText('');
              
              Alert.alert(
                'Cleanup Complete',
                `Removed ${result.asyncStorageKeysRemoved} local keys, ${result.supabaseEntriesRemoved} remote entries`
              );
            } catch (error) {
              console.error('Cleanup failed:', error);
              Alert.alert('Error', 'Data cleanup failed: ' + error.message);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>User not logged in</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          title: '🧹 Debug Clean Data',
          headerShown: true,
          headerBackVisible: true,
          headerStyle: { backgroundColor: '#DC2626' },
          headerTintColor: '#FFFFFF'
        }} 
      />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="database-remove" size={32} color="#DC2626" />
          <Text style={styles.title}>Data Cleanup Utility</Text>
          <Text style={styles.subtitle}>⚠️ DESTRUCTIVE OPERATIONS - TEST ONLY</Text>
        </View>

        {/* User Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Current User</Text>
          <Text style={styles.userInfo}>ID: {user.id}</Text>
          <Text style={styles.userInfo}>Email: {user.email}</Text>
        </Card>

        {/* Analysis */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Data Analysis</Text>
            <Pressable 
              style={styles.analyzeButton}
              onPress={handleAnalyzeData}
              disabled={loading}
            >
              <MaterialCommunityIcons name="magnify" size={16} color="#3B82F6" />
              <Text style={styles.analyzeButtonText}>
                {loading ? 'Analyzing...' : 'Analyze'}
              </Text>
            </Pressable>
          </View>
          
          {analysis && (
            <View style={styles.analysisResult}>
              <Text style={styles.analysisTitle}>AsyncStorage:</Text>
              <Text style={styles.analysisText}>
                Total Keys: {analysis.asyncStorage.totalKeys}
              </Text>
              <Text style={styles.analysisText}>
                Mood Keys: {analysis.asyncStorage.moodKeys.length}
              </Text>
              
              <Text style={styles.analysisTitle}>Supabase:</Text>
              <Text style={styles.analysisText}>
                Total Entries: {analysis.supabase.totalEntries}
              </Text>
              
              {analysis.issues.length > 0 && (
                <>
                  <Text style={styles.issuesTitle}>🚨 Issues Found:</Text>
                  {analysis.issues.map((issue: string, index: number) => (
                    <Text key={index} style={styles.issueText}>• {issue}</Text>
                  ))}
                </>
              )}
            </View>
          )}
        </Card>

        {/* Cleanup */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>🗑️ Nuclear Data Cleanup</Text>
          <Text style={styles.warningText}>
            This will permanently delete ALL mood data for this user from both local storage and Supabase.
          </Text>
          
          <View style={styles.confirmationContainer}>
            <Text style={styles.confirmationLabel}>
              Type exactly: CLEAN_ALL_MOOD_DATA_CONFIRMED
            </Text>
            <TextInput
              style={styles.confirmationInput}
              value={confirmText}
              onChangeText={setConfirmText}
              placeholder="Type confirmation text"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <Pressable
            style={[
              styles.cleanupButton,
              confirmText !== 'CLEAN_ALL_MOOD_DATA_CONFIRMED' && styles.cleanupButtonDisabled
            ]}
            onPress={handleCleanData}
            disabled={confirmText !== 'CLEAN_ALL_MOOD_DATA_CONFIRMED' || loading}
          >
            <MaterialCommunityIcons 
              name="delete-forever" 
              size={20} 
              color={confirmText === 'CLEAN_ALL_MOOD_DATA_CONFIRMED' ? '#FFFFFF' : '#9CA3AF'} 
            />
            <Text style={[
              styles.cleanupButtonText,
              confirmText !== 'CLEAN_ALL_MOOD_DATA_CONFIRMED' && styles.cleanupButtonTextDisabled
            ]}>
              {loading ? 'Cleaning...' : 'DELETE ALL MOOD DATA'}
            </Text>
          </Pressable>
        </Card>

        {/* Cleanup Result */}
        {cleanupResult && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>✅ Cleanup Result</Text>
            <View style={styles.resultGrid}>
              <Text style={styles.resultText}>
                AsyncStorage Keys: {cleanupResult.asyncStorageKeysRemoved}
              </Text>
              <Text style={styles.resultText}>
                Supabase Entries: {cleanupResult.supabaseEntriesRemoved}  
              </Text>
              <Text style={styles.resultText}>
                Cache Cleared: {cleanupResult.cacheEntriesCleared}
              </Text>
            </View>
            
            {cleanupResult.errors.length > 0 && (
              <>
                <Text style={styles.issuesTitle}>Errors:</Text>
                {cleanupResult.errors.map((error: string, index: number) => (
                  <Text key={index} style={styles.issueText}>• {error}</Text>
                ))}
              </>
            )}
          </Card>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🚨 This tool is for debugging duplicate/sync issues.{'\n'}
            Use only for clean slate testing!
          </Text>
          
          <Pressable 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={16} color="#6B7280" />
            <Text style={styles.backButtonText}>Back to App</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEF2F2',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#FCA5A5',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  subtitle: {
    fontSize: 12,
    color: '#991B1B',
    marginTop: 4,
    fontFamily: 'Inter',
    fontWeight: '600',
  },
  section: {
    margin: 16,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  userInfo: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  analyzeButtonText: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  analysisResult: {
    marginTop: 12,
  },
  analysisTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  analysisText: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  issuesTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#DC2626',
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'Inter',
  },
  issueText: {
    fontSize: 11,
    color: '#991B1B',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 14,
    color: '#DC2626',
    fontFamily: 'Inter',
    marginBottom: 16,
    lineHeight: 20,
  },
  confirmationContainer: {
    marginBottom: 16,
  },
  confirmationLabel: {
    fontSize: 12,
    color: '#374151',
    fontFamily: 'Inter',
    marginBottom: 8,
  },
  confirmationInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: 'monospace',
    backgroundColor: '#F9FAFB',
  },
  cleanupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  cleanupButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  cleanupButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  cleanupButtonTextDisabled: {
    color: '#9CA3AF',
  },
  resultGrid: {
    marginTop: 8,
  },
  resultText: {
    fontSize: 12,
    color: '#059669',
    fontFamily: 'Inter',
    marginBottom: 4,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#991B1B',
    textAlign: 'center',
    fontStyle: 'italic',
    fontFamily: 'Inter',
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    margin: 20,
    fontFamily: 'Inter',
  },
});
