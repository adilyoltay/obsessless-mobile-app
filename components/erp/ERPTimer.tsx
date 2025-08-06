import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import Button from '@/components/ui/Button';
import { Slider } from '@/components/ui/Slider';
import * as Haptics from 'expo-haptics';

interface ERPTimerProps {
  exerciseId?: string;
  duration?: number;
  onComplete?: (sessionData: any) => void;
}

export const ERPTimer: React.FC<ERPTimerProps> = ({ 
  exerciseId, 
  duration = 300, 
  onComplete 
}) => {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isRunning, setIsRunning] = useState(false);
  const [anxietyLevel, setAnxietyLevel] = useState(5);
  const [anxietyHistory, setAnxietyHistory] = useState<number[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout | number | null = null;

    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRunning, timeRemaining]);

  const handleStart = () => {
    setIsRunning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePause = () => {
    setIsRunning(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleStop = () => {
    Alert.alert(
      'Oturumu Sonlandır',
      'Bu oturumu sonlandırmak istediğinizden emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        { 
          text: 'Sonlandır', 
          style: 'destructive',
          onPress: () => {
            setIsRunning(false);
            handleComplete();
          }
        }
      ]
    );
  };

  const handleComplete = () => {
    const sessionData = {
      exerciseId,
      duration: duration - timeRemaining,
      anxietyHistory: [...anxietyHistory, anxietyLevel],
      completedAt: new Date().toISOString(),
      finalAnxietyLevel: anxietyLevel,
    };

    if (onComplete) {
      onComplete(sessionData);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const handleAnxietyChange = (value: number) => {
    setAnxietyLevel(Math.round(value));
    setAnxietyHistory(prev => [...prev, Math.round(value)]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercentage = ((duration - timeRemaining) / duration) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.timerSection}>
        <Text style={styles.timeDisplay}>{formatTime(timeRemaining)}</Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${progressPercentage}%` }
            ]} 
          />
        </View>
      </View>

      <View style={styles.anxietySection}>
        <Text style={styles.anxietyLabel}>
          Anksiyete Seviyesi: {anxietyLevel}/10
        </Text>
        <Slider
          value={anxietyLevel}
          onValueChange={handleAnxietyChange}
          minimumValue={1}
          maximumValue={10}
          step={1}
          style={styles.anxietySlider}
        />
        <View style={styles.anxietyLabels}>
          <Text style={styles.anxietyLabelText}>Düşük</Text>
          <Text style={styles.anxietyLabelText}>Yüksek</Text>
        </View>
      </View>

      <View style={styles.controlsSection}>
        {!isRunning ? (
          <Button
            onPress={handleStart}
            style={styles.primaryButton}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>
              {timeRemaining === duration ? "Başla" : "Devam Et"}
            </Text>
          </Button>
        ) : (
          <Button
            onPress={handlePause}
            style={styles.secondaryButton}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>
              Duraklat
            </Text>
          </Button>
        )}

        {timeRemaining < duration && (
          <Button
            onPress={handleStop}
            style={styles.dangerButton}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>
              Sonlandır
            </Text>
          </Button>
        )}
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          Bu egzersiz sırasında anksiyete seviyenizi takip edin. 
          Zamanla anksiyetenizin azaldığını göreceksiniz.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timeDisplay: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#10B981',
    marginBottom: 20,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  anxietySection: {
    marginBottom: 40,
  },
  anxietyLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 20,
  },
  anxietySlider: {
    width: '100%',
    height: 60,
  },
  anxietyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  anxietyLabelText: {
    fontSize: 14,
    color: '#6B7280',
  },
  controlsSection: {
    gap: 12,
    marginBottom: 30,
  },
  primaryButton: {
    backgroundColor: '#10B981',
  },
  secondaryButton: {
    backgroundColor: '#F59E0B',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
  },
  infoSection: {
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
});