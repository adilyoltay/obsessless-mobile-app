import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface MoodDetailsStepProps {
  transcript?: string;
  detectedTriggers?: string[];
  onBack: () => void;
  onSave: (data: {
    notes: string;
    trigger?: string;
  }) => void;
  moodColor: string;
}

export default function MoodDetailsStep({
  transcript = '',
  detectedTriggers = [],
  onBack,
  onSave,
  moodColor,
}: MoodDetailsStepProps) {
  const [notes, setNotes] = useState('');
  const [selectedTrigger, setSelectedTrigger] = useState('');

  // Trigger mapping from heuristic to UI chips
  const triggerMapping: { [key: string]: string } = {
    'iş': 'İş/Okul',
    'okul': 'İş/Okul', 
    'çalışma': 'İş/Okul',
    'işyeri': 'İş/Okul',
    'eğitim': 'İş/Okul',
    'ilişki': 'İlişkiler',
    'aile': 'Aile',
    'arkadaş': 'Sosyal',
    'sosyal': 'Sosyal',
    'sağlık': 'Sağlık',
    'hastalık': 'Sağlık',
    'para': 'Finansal',
    'finansal': 'Finansal',
    'ekonomik': 'Finansal',
    'maaş': 'Finansal',
    'uyku': 'Uyku',
    'yorgun': 'Uyku',
    'uykusuz': 'Uyku',
    'spor': 'Egzersiz',
    'egzersiz': 'Egzersiz',
    'antrenman': 'Egzersiz',
    'fiziksel': 'Egzersiz',
  };

  // Pre-fill notes with transcript
  useEffect(() => {
    if (transcript) {
      setNotes(transcript);
    }
  }, [transcript]);

  // Auto-select trigger based on detected triggers
  useEffect(() => {
    if (detectedTriggers.length > 0 && !selectedTrigger) {
      // Find first matching trigger
      for (const detected of detectedTriggers) {
        const mappedTrigger = triggerMapping[detected.toLowerCase()];
        if (mappedTrigger) {
          setSelectedTrigger(mappedTrigger);
          console.log('🎯 Auto-selected trigger:', mappedTrigger, 'from detected:', detected);
          break;
        }
      }
    }
  }, [detectedTriggers]);

  const triggers = [
    'İş/Okul',
    'İlişkiler',
    'Sağlık',
    'Finansal',
    'Aile',
    'Sosyal',
    'Uyku',
    'Egzersiz',
    'Diğer',
  ];

  const handleSave = () => {
    onSave({
      notes,
      trigger: selectedTrigger,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#6B7280" />
        </Pressable>
        <Text style={styles.title}>Detaylar</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.subtitle}>
          Mood kaydınızı tamamlamak için ek bilgiler ekleyebilirsiniz
        </Text>

        {/* Triggers Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Tetikleyici Düşünceler (Opsiyonel)</Text>
          <View style={styles.triggers}>
            {triggers.map((trigger) => (
              <Pressable
                key={trigger}
                style={[
                  styles.triggerChip,
                  selectedTrigger === trigger && [
                    styles.triggerChipActive,
                    { backgroundColor: moodColor }
                  ],
                ]}
                onPress={() => {
                  setSelectedTrigger(selectedTrigger === trigger ? '' : trigger);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Text style={[
                  styles.triggerText,
                  selectedTrigger === trigger && styles.triggerTextActive,
                ]}>
                  {trigger}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Notlar (Opsiyonel)</Text>
          <TextInput
            style={styles.textInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Bugün nasıl hissettiğinizi detaylandırın..."
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          {transcript && (
            <Text style={styles.transcriptNote}>
              💡 Ses kaydınızdan otomatik dolduruldu. Düzenleyebilirsiniz.
            </Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.secondary]}
            onPress={onBack}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color="#6B7280" />
            <Text style={styles.secondaryBtnTxt}>Geri</Text>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.primary, { backgroundColor: moodColor }]}
            onPress={handleSave}
          >
            <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
            <Text style={styles.btnTxt}>Kaydet</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    padding: 20,
  },
  subtitle: {
    color: '#6B7280',
    marginBottom: 24,
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    marginBottom: 32,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  triggers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  triggerChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
  },
  triggerChipActive: {
    backgroundColor: '#10B981',
  },
  triggerText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  triggerTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#111827',
    minHeight: 120,
    lineHeight: 22,
  },
  transcriptNote: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
    marginBottom: 20,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primary: {
    backgroundColor: '#22C55E',
  },
  secondary: {
    backgroundColor: '#F3F4F6',
  },
  btnTxt: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryBtnTxt: {
    color: '#6B7280',
    fontWeight: '700',
    fontSize: 16,
  },
});
