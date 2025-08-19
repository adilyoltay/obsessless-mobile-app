import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Card, Button, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Slider } from '@/components/ui/Slider';
import { useTranslation } from '@/hooks/useTranslation';
import * as Haptics from 'expo-haptics';

interface ERPSessionTrackerProps {
  exerciseName: string;
  targetDuration: number; // in minutes
  onComplete: (sessionData: ERPSessionData) => void;
  onPause: () => void;
}

interface ERPSessionData {
  duration: number;
  anxietyReadings: AnxietyReading[];
  initialAnxiety: number;
  peakAnxiety: number;
  finalAnxiety: number;
  notes: string;
  completed: boolean;
}

interface AnxietyReading {
  timestamp: number;
  level: number;
}

export function ERPSessionTracker({ 
  exerciseName, 
  targetDuration, 
  onComplete, 
  onPause 
}: ERPSessionTrackerProps) {
  const { t } = useTranslation();
  
  // Session state
  const [isRunning, setIsRunning] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [currentAnxiety, setCurrentAnxiety] = useState(5);
  const [anxietyReadings, setAnxietyReadings] = useState<AnxietyReading[]>([]);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  
  // Refs for intervals
  const timerRef = useRef<NodeJS.Timeout | number | null>(null);
  const anxietyTrackerRef = useRef<NodeJS.Timeout | number | null>(null);
  
  // Master Prompt: Kontrol - Kullanıcı oturumu istediği zaman durdurabilir
  const startSession = () => {
    setIsRunning(true);
    setAnxietyReadings([{ timestamp: 0, level: currentAnxiety }]);
    
    // Timer interval
    timerRef.current = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    
    // Anxiety tracking reminder every 30 seconds
    anxietyTrackerRef.current = setInterval(() => {
      Haptics.selectionAsync();
    }, 30000);
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  
  const pauseSession = () => {
    setIsRunning(false);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (anxietyTrackerRef.current) {
      clearInterval(anxietyTrackerRef.current);
      anxietyTrackerRef.current = null;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPause();
  };
  
  const completeSession = () => {
    setIsRunning(false);
    setIsCompleted(true);
    
    // Clear intervals
    if (timerRef.current) clearInterval(timerRef.current);
    if (anxietyTrackerRef.current) clearInterval(anxietyTrackerRef.current);
    
    // Master Prompt: Empatik Dil - Tebrik mesajı
    const finalReading = { timestamp: timeElapsed, level: currentAnxiety };
    const allReadings = [...anxietyReadings, finalReading];
    
    const sessionData: ERPSessionData = {
      duration: timeElapsed,
      anxietyReadings: allReadings,
      initialAnxiety: anxietyReadings[0]?.level || currentAnxiety,
      peakAnxiety: Math.max(...allReadings.map(r => r.level)),
      finalAnxiety: currentAnxiety,
      notes: sessionNotes,
      completed: timeElapsed >= (targetDuration * 60 * 0.8), // 80% completion threshold
    };
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(sessionData);
  };
  
  // Real-time anxiety tracking
  const handleAnxietyChange = (value: number) => {
    setCurrentAnxiety(value);
    
    if (isRunning) {
      setAnxietyReadings(prev => [
        ...prev,
        { timestamp: timeElapsed, level: value }
      ]);
      
      // Haptic feedback based on anxiety level
      if (value >= 8) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      } else if (value >= 6) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };
  
  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Calculate progress percentage
  const progressPercentage = Math.min((timeElapsed / (targetDuration * 60)) * 100, 100);
  
  // Get anxiety level color
  const getAnxietyColor = (level: number) => {
    if (level <= 3) return '#10B981'; // Green
    if (level <= 5) return '#F59E0B'; // Yellow
    if (level <= 7) return '#F97316'; // Orange
    return '#EF4444'; // Red
  };
  
  // Get encouraging message based on progress
  const getEncouragingMessage = () => {
    const progressPercent = (timeElapsed / (targetDuration * 60)) * 100;
    
    if (progressPercent < 25) {
      return 'Harika bir başlangıç yaptın! 💚';
    } else if (progressPercent < 50) {
      return 'Yarı yoldasın - devam et! 🌟';
    } else if (progressPercent < 75) {
      return 'Çok güçlüsün, neredeyse bitirdin! ⭐';
    } else {
      return 'İnanılmaz ilerleme - gurur duymalısın! 🦋';
    }
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (anxietyTrackerRef.current) clearInterval(anxietyTrackerRef.current);
    };
  }, []);
  
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.exerciseTitle}>{exerciseName}</Text>
        <Text style={styles.targetDuration}>
          Hedef Süre: {targetDuration} dakika
        </Text>
      </View>
      
      {/* Main Timer Display */}
      <Card style={styles.timerCard}>
        <Card.Content style={styles.timerContent}>
          <View style={styles.timerDisplay}>
            <Text style={styles.timeText}>{formatTime(timeElapsed)}</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${progressPercentage}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {progressPercentage.toFixed(0)}% tamamlandı
              </Text>
            </View>
          </View>
          
          {/* Control Buttons */}
          <View style={styles.controlButtons}>
            {!isRunning && !isCompleted ? (
              <Button 
                mode="contained" 
                onPress={startSession}
                style={styles.startButton}
                contentStyle={styles.buttonContent}
              >
                <Text style={styles.buttonText}>
                  {timeElapsed > 0 ? 'Devam Et' : 'Başla'}
                </Text>
              </Button>
            ) : isRunning ? (
              <>
                <Button 
                  mode="outlined" 
                  onPress={pauseSession}
                  style={styles.pauseButton}
                  contentStyle={styles.buttonContent}
                >
                  <Text style={styles.pauseButtonText}>Duraklat</Text>
                </Button>
                <Button 
                  mode="contained" 
                  onPress={completeSession}
                  style={styles.completeButton}
                  contentStyle={styles.buttonContent}
                >
                  <Text style={styles.buttonText}>Tamamla</Text>
                </Button>
              </>
            ) : null}
          </View>
        </Card.Content>
      </Card>
      
      {/* Real-time Anxiety Tracker */}
      <Card style={styles.anxietyCard}>
        <Card.Content>
          <View style={styles.anxietyHeader}>
            <MaterialCommunityIcons 
              name="heart-pulse" 
              size={24} 
              color={getAnxietyColor(currentAnxiety)} 
            />
            <Text style={styles.anxietyTitle}>Anlık Anksiyete Seviyesi</Text>
          </View>
          
          <View style={styles.anxietyDisplay}>
            <Text style={[
              styles.anxietyValue,
              { color: getAnxietyColor(currentAnxiety) }
            ]}>
              {currentAnxiety}/10
            </Text>
            
                         <Slider
               value={currentAnxiety}
               onValueChange={handleAnxietyChange}
               minimumValue={0}
               maximumValue={10}
               step={1}
               style={styles.anxietySlider}
               minimumTrackTintColor={getAnxietyColor(currentAnxiety)}
               maximumTrackTintColor={'#F3F4F6'}
             />
            
            <View style={styles.anxietyLabels}>
              <Text style={styles.anxietyLabel}>Sakin</Text>
              <Text style={styles.anxietyLabel}>Yoğun</Text>
            </View>
          </View>
          
          {isRunning && (
            <Text style={styles.encouragingMessage}>
              {getEncouragingMessage()}
            </Text>
          )}
        </Card.Content>
      </Card>
      
      {/* Session Notes */}
      <Card style={styles.notesCard}>
        <Card.Content>
          <View style={styles.notesHeader}>
            <MaterialCommunityIcons name="note-text" size={24} color="#3B82F6" />
            <Text style={styles.notesTitle}>Oturum Notları</Text>
          </View>
          
          <TextInput
            mode="outlined"
            placeholder="Bu oturum sırasında neler hissettin? Düşüncelerini yaz..."
            value={sessionNotes}
            onChangeText={setSessionNotes}
            multiline
            numberOfLines={4}
            style={styles.notesInput}
            outlineColor="#E5E7EB"
            activeOutlineColor="#10B981"
          />
          
          <Text style={styles.notesHint}>
            💡 İpucu: Deneyimlerin ve hislerin terapötik sürecin bir parçası
          </Text>
        </Card.Content>
      </Card>
      
      {/* Anxiety History Visualization (if running or completed) */}
      {anxietyReadings.length > 1 && (
        <Card style={styles.historyCard}>
          <Card.Content>
            <View style={styles.historyHeader}>
              <MaterialCommunityIcons name="chart-line" size={24} color="#8B5CF6" />
              <Text style={styles.historyTitle}>Anksiyete Seyri</Text>
            </View>
            
            <View style={styles.readingsContainer}>
              {anxietyReadings.slice(-6).map((reading, index) => (
                <View key={index} style={styles.readingItem}>
                  <View style={[
                    styles.readingDot,
                    { backgroundColor: getAnxietyColor(reading.level) }
                  ]} />
                  <Text style={styles.readingTime}>
                    {formatTime(reading.timestamp)}
                  </Text>
                  <Text style={styles.readingValue}>{reading.level}</Text>
                </View>
              ))}
            </View>
          </Card.Content>
        </Card>
      )}
      
      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  exerciseTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    marginBottom: 8,
  },
  targetDuration: {
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  timerCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  timerContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  timerDisplay: {
    alignItems: 'center',
    marginBottom: 24,
  },
  timeText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#10B981',
    fontFamily: 'Inter-Medium',
    marginBottom: 16,
  },
  progressContainer: {
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  startButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
  },
  pauseButton: {
    borderColor: '#6B7280',
    paddingHorizontal: 24,
  },
  completeButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  pauseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    fontFamily: 'Inter-Medium',
  },
  anxietyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  anxietyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  anxietyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  anxietyDisplay: {
    alignItems: 'center',
  },
  anxietyValue: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'Inter-Medium',
    marginBottom: 16,
  },
  anxietySlider: {
    width: '100%',
    marginBottom: 8,
  },
  anxietyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  anxietyLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  encouragingMessage: {
    fontSize: 16,
    color: '#10B981',
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
    fontWeight: '600',
  },
  notesCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  notesInput: {
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  notesHint: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: 'Inter',
    fontStyle: 'italic',
  },
  historyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
    marginLeft: 8,
  },
  readingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  readingItem: {
    alignItems: 'center',
    marginBottom: 12,
  },
  readingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  readingTime: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 2,
  },
  readingValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    fontFamily: 'Inter-Medium',
  },
  bottomSpacing: {
    height: 32,
  },
}); 