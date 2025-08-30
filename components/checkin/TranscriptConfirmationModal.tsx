/**
 * TranscriptConfirmationModal - Seamless Speech Transcript Confirmation
 * 
 * Ses kaydından sonra kullanıcının söylediklerini confirm/edit etmesi için
 * basit modal. Alert.prompt'tan çok daha güzel UX.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '@/components/ui/Card';

interface TranscriptConfirmationModalProps {
  visible: boolean;
  duration: number; // Recording duration
  estimatedText: string; // AI-generated estimate
  onConfirm: (finalText: string) => void;
  onCancel: () => void;
}

export default function TranscriptConfirmationModal({
  visible,
  duration,
  estimatedText,
  onConfirm,
  onCancel,
}: TranscriptConfirmationModalProps) {
  const [transcriptText, setTranscriptText] = useState('');
  const textInputRef = useRef<TextInput>(null);

  // Debug modal visibility
  useEffect(() => {
    console.log('📝 TranscriptConfirmationModal visibility changed:', {
      visible,
      duration,
      estimatedText,
      hasEstimatedText: !!estimatedText
    });
  }, [visible]);

  // Initialize with estimated text when modal opens
  useEffect(() => {
    if (visible) {
      console.log('📝 TranscriptModal opened, setting text:', estimatedText);
      setTranscriptText(estimatedText);
      // Auto-focus and select all text for easy editing
      setTimeout(() => {
        textInputRef.current?.focus();
        textInputRef.current?.selectAll?.();
      }, 300);
    }
  }, [visible, estimatedText]);

  const handleConfirm = () => {
    const finalText = transcriptText.trim();
    if (finalText.length === 0) {
      // Empty text - still proceed but with empty notes
      onConfirm('');
    } else {
      onConfirm(finalText);
    }
  };

  const handleQuickFill = (quickText: string) => {
    setTranscriptText(quickText);
    textInputRef.current?.focus();
  };

  // Quick template suggestions
  const quickSuggestions = [
    "Bugün kendimi iyi hissediyorum",
    "Biraz yorgun ve stresli hissediyorum", 
    "Çok mutlu ve enerjik hissediyorum",
    "Kaygılı ve endişeli hissediyorum",
    "Sakin ve huzurlu hissediyorum"
  ];

  // Always render modal component (visibility controlled by prop)
  if (!visible) {
    console.log('📝 TranscriptModal not visible, returning null');
    return null;
  }

  console.log('📝 TranscriptModal rendering with text:', transcriptText);

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialCommunityIcons name="microphone" size={24} color="#10B981" />
              <View>
                <Text style={styles.headerTitle}>Transcript Confirmation</Text>
                <Text style={styles.headerSubtitle}>
                  {duration.toFixed(1)}s kayıt alındı
                </Text>
              </View>
            </View>
            <Pressable onPress={onCancel} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          {/* Main Content */}
          <Card style={styles.contentCard}>
            <Text style={styles.instructionText}>
              Ne söylediğinizi onaylayın veya düzeltin:
            </Text>
            
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              value={transcriptText}
              onChangeText={setTranscriptText}
              placeholder="Buraya söylediklerinizi yazın..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
              selectTextOnFocus
            />

            {/* Quick Suggestions */}
            <Text style={styles.quickLabel}>Hızlı seçenekler:</Text>
            <View style={styles.quickSuggestions}>
              {quickSuggestions.map((suggestion, index) => (
                <Pressable
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => handleQuickFill(suggestion)}
                >
                  <Text style={styles.suggestionText}>{suggestion}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>İptal</Text>
            </Pressable>
            
            <Pressable style={styles.confirmButton} onPress={handleConfirm}>
              <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
              <Text style={styles.confirmButtonText}>Devam Et</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: 'Inter',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },

  // Content
  contentCard: {
    marginBottom: 20,
  },
  instructionText: {
    fontSize: 16,
    color: '#374151',
    fontFamily: 'Inter',
    marginBottom: 16,
    lineHeight: 22,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Inter',
    backgroundColor: '#F9FAFB',
    minHeight: 120,
    marginBottom: 20,
  },

  // Quick suggestions
  quickLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    fontFamily: 'Inter',
    marginBottom: 12,
  },
  quickSuggestions: {
    gap: 8,
  },
  suggestionButton: {
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  suggestionText: {
    fontSize: 14,
    color: '#4B5563',
    fontFamily: 'Inter',
  },

  // Actions
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
    fontFamily: 'Inter',
  },
  confirmButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#10B981',
    borderRadius: 12,
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});
