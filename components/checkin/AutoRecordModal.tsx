import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import * as Haptics from 'expo-haptics';

interface AutoRecordModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (data: any) => void;
  onEdit: (data: any) => void;
  recordType: 'OCD' | 'CBT' | 'MOOD';
  recordData: any;
  originalText: string;
}

export function AutoRecordModal({
  visible,
  onClose,
  onConfirm,
  onEdit,
  recordType,
  recordData,
  originalText,
}: AutoRecordModalProps) {
  console.log('🚀 AutoRecordModal component rendered, visible:', visible, 'recordType:', recordType);
  
  const [editedData, setEditedData] = useState(recordData);
  const [isEditing, setIsEditing] = useState(false);

  const getIcon = () => {
    switch (recordType) {
      case 'OCD':
        return 'head-snowflake-outline';
      case 'CBT':
        return 'head-cog-outline';
      case 'MOOD':
        return 'emoticon-outline';

      default:
        return 'help-circle-outline';
    }
  };

  const getTitle = () => {
    switch (recordType) {
      case 'OCD':
        return 'OKB Kaydı Oluştur';
      case 'CBT':
        return 'Düşünce Kaydı Oluştur';
      case 'MOOD':
        return 'Mood Kaydı Oluştur';

      default:
        return 'Kayıt Oluştur';
    }
  };

  const getDescription = () => {
    switch (recordType) {
      case 'OCD':
        const categoryName = recordData.category === 'contamination' ? 'Temizlik obsesyonu' :
                            recordData.category === 'checking' ? 'Kontrol obsesyonu' :
                            recordData.category === 'symmetry' ? 'Düzen obsesyonu' :
                            recordData.category === 'counting' ? 'Sayma kompulsiyonu' :
                            recordData.category === 'harm' ? 'Zarar verme obsesyonu' :
                            recordData.category === 'religious' ? 'Dini obsesyon' :
                            'OKB belirtisi';
        return `${categoryName} tespit edildi. Yeterli bilgi toplandı, kayıt oluşturmak ister misin?`;
      case 'CBT':
        return `Bilişsel çarpıtma tespit edildi: ${recordData.distortionType || 'Genel'}. Düşünce kaydı oluşturmak ister misin?`;
      case 'MOOD':
        return `Mood seviyesi: ${Math.round(recordData.mood || 50)}/100. Mood kaydını oluşturmak ister misin?`;

      default:
        return '';
    }
  };

  const renderOCDForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.label}>Kategori</Text>
      <View style={styles.categoryChips}>
        {['contamination', 'checking', 'symmetry', 'counting', 'harm', 'religious', 'other'].map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.chip,
              editedData.category === cat && styles.chipActive,
            ]}
            onPress={() => {
              setEditedData({ ...editedData, category: cat });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[
              styles.chipText,
              editedData.category === cat && styles.chipTextActive,
            ]}>
              {cat === 'contamination' ? 'Temizlik' :
               cat === 'checking' ? 'Kontrol' :
               cat === 'symmetry' ? 'Düzen' :
               cat === 'counting' ? 'Sayma' :
               cat === 'harm' ? 'Zarar' :
               cat === 'religious' ? 'Dini' :
               'Diğer'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Direnç Seviyesi: {editedData.resistanceLevel || 5}/10</Text>
      <View style={styles.resistanceButtons}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
          <Pressable
            key={level}
            style={[
              styles.levelButton,
              (editedData.resistanceLevel || 5) >= level && styles.levelButtonActive,
            ]}
            onPress={() => {
              setEditedData({ ...editedData, resistanceLevel: level });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[
              styles.levelText,
              (editedData.resistanceLevel || 5) >= level && styles.levelTextActive,
            ]}>
              {level}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Not (Opsiyonel)</Text>
      <TextInput
        style={styles.textInput}
        value={editedData.notes}
        onChangeText={(text) => setEditedData({ ...editedData, notes: text })}
        placeholder="Ek notlarınız..."
        multiline
      />
    </View>
  );

  const renderCBTForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.label}>Otomatik Düşünce</Text>
      <TextInput
        style={styles.textInput}
        value={editedData.thought || originalText}
        onChangeText={(text) => setEditedData({ ...editedData, thought: text })}
        multiline
      />

      <Text style={styles.label}>Duygular</Text>
      <TextInput
        style={styles.textInput}
        value={editedData.emotions}
        onChangeText={(text) => setEditedData({ ...editedData, emotions: text })}
        placeholder="Hissettiğiniz duygular..."
      />

      <Text style={styles.label}>Alternatif Düşünce</Text>
      <TextInput
        style={styles.textInput}
        value={editedData.reframe}
        onChangeText={(text) => setEditedData({ ...editedData, reframe: text })}
        placeholder="Daha dengeli bir bakış açısı..."
        multiline
      />
    </View>
  );

  const renderMoodForm = () => (
    <View style={styles.formContainer}>
      <Text style={styles.label}>Mood: {Math.round(editedData.mood || 50)}/100</Text>
      <View style={styles.sliderContainer}>
        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
          <Pressable
            key={value}
            style={[
              styles.moodButton,
              Math.abs((editedData.mood || 50) - value) <= 5 && styles.moodButtonActive,
            ]}
            onPress={() => {
              setEditedData({ ...editedData, mood: value });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.moodText}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Enerji Seviyesi: {editedData.energy || 5}/10</Text>
      <View style={styles.resistanceButtons}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
          <Pressable
            key={level}
            style={[
              styles.levelButton,
              (editedData.energy || 5) >= level && styles.levelButtonActive,
            ]}
            onPress={() => {
              setEditedData({ ...editedData, energy: level });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[
              styles.levelText,
              (editedData.energy || 5) >= level && styles.levelTextActive,
            ]}>
              {level}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Anksiyete: {editedData.anxiety || 5}/10</Text>
      <View style={styles.resistanceButtons}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => (
          <Pressable
            key={level}
            style={[
              styles.levelButton,
              (editedData.anxiety || 5) >= level && styles.levelButtonActive,
            ]}
            onPress={() => {
              setEditedData({ ...editedData, anxiety: level });
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={[
              styles.levelText,
              (editedData.anxiety || 5) >= level && styles.levelTextActive,
            ]}>
              {level}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Not (Opsiyonel)</Text>
      <TextInput
        style={styles.textInput}
        value={editedData.notes}
        onChangeText={(text) => setEditedData({ ...editedData, notes: text })}
        placeholder="Nasıl hissediyorsunuz?"
        multiline
      />
    </View>
  );



  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isEditing) {
      onEdit(editedData);
    } else {
      onConfirm(editedData);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <MaterialCommunityIcons name={getIcon()} size={32} color="#10B981" />
            <Text style={styles.title}>{getTitle()}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </Pressable>
          </View>

          <Text style={styles.description}>{getDescription()}</Text>
          
          <View style={styles.originalTextContainer}>
            <Text style={styles.originalTextLabel}>Söylediğiniz:</Text>
            <Text style={styles.originalText}>"{originalText}"</Text>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {isEditing && (
              <>
                {recordType === 'OCD' && renderOCDForm()}
                {recordType === 'CBT' && renderCBTForm()}
                {recordType === 'MOOD' && renderMoodForm()}

              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              variant="secondary"
              onPress={onClose}
              style={styles.button}
            >
              İptal
            </Button>
            
            {!isEditing && (
              <Button
                variant="secondary"
                onPress={() => {
                  setIsEditing(true);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={styles.button}
              >
                Düzenle
              </Button>
            )}

            <Button
              variant="primary"
              onPress={handleConfirm}
              style={styles.button}
            >
              Kaydet
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 10,
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  description: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 15,
  },
  originalTextContainer: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  originalTextLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 5,
  },
  originalText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
  },
  formScroll: {
    maxHeight: 300,
  },
  formContainer: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 50,
  },
  categoryChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#10B981',
  },
  chipText: {
    fontSize: 12,
    color: '#6B7280',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  resistanceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  levelButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelButtonActive: {
    backgroundColor: '#10B981',
  },
  levelText: {
    fontSize: 12,
    color: '#6B7280',
  },
  levelTextActive: {
    color: '#FFFFFF',
  },
  sliderContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  moodButton: {
    padding: 8,
    marginBottom: 5,
  },
  moodButtonActive: {
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
  },
  moodText: {
    fontSize: 12,
    color: '#374151',
  },
  infoText: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 10,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
});
