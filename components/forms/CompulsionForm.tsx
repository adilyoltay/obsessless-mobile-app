import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, TextInput, HelperText } from 'react-native-paper';
import { Picker, PickerItem } from '@/components/ui/Picker';
import Slider from '@react-native-community/slider';
import { useCreateCompulsion } from '@/hooks/useCompulsions';
import Toast from 'react-native-toast-message';

const COMPULSION_TYPES = [
  { value: 'checking', label: 'Kontrol Etme' },
  { value: 'washing', label: 'Yıkama/Temizlik' },
  { value: 'counting', label: 'Sayma' },
  { value: 'ordering', label: 'Düzenleme' },
  { value: 'mental', label: 'Zihinsel Ritüeller' },
  { value: 'reassurance', label: 'Güvence Arama' },
  { value: 'avoidance', label: 'Kaçınma' },
  { value: 'other', label: 'Diğer' }
];

export function CompulsionForm({ onSubmit }: { onSubmit?: (data: any) => void }) {
  const [formData, setFormData] = useState({
    type: '',
    frequency: 1,
    duration: 5,
    severity: 5,
    resistanceLevel: 5,
    trigger: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!formData.type) {
      Alert.alert('Hata', 'Lütfen kompulsiyon türünü seçiniz');
      return;
    }

    setLoading(true);
    try {
      const compulsionData = {
        ...formData,
        timestamp: new Date().toISOString(),
        id: Date.now().toString()
      };

      // Save to AsyncStorage
      // const existingData = await AsyncStorage.getItem('compulsions');
      // const compulsions = existingData ? JSON.parse(existingData) : [];
      // compulsions.push(compulsionData);
      // await AsyncStorage.setItem('compulsions', JSON.stringify(compulsions));

      // Reset form
      setFormData({
        type: '',
        frequency: 1,
        duration: 5,
        severity: 5,
        resistanceLevel: 5,
        trigger: '',
        notes: ''
      });

      Alert.alert('Başarılı', 'Kompulsiyon kaydedildi');
      onSubmit?.(compulsionData);
    } catch (error) {
      Alert.alert('Hata', 'Kaydetme sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.title}>
            Kompulsiyon Kaydı
          </Text>

          {/* Type Selection */}
          <Text variant="bodyMedium" style={styles.label}>
            Kompulsiyon Türü *
          </Text>
          <Picker
            selectedValue={formData.type}
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
            style={styles.picker}
          >
            <PickerItem label="Seçiniz..." value="" />
            {COMPULSION_TYPES.map(type => (
              <PickerItem 
                key={type.value} 
                label={type.label} 
                value={type.value} 
              />
            ))}
          </Picker>

          {/* Frequency */}
          <Text variant="bodyMedium" style={styles.label}>
            Sıklık (günde kaç kez): {formData.frequency}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={20}
            step={1}
            value={formData.frequency}
            onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value }))}
            minimumTrackTintColor="#10B981"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#10B981"
          />

          {/* Duration */}
          <Text variant="bodyMedium" style={styles.label}>
            Süre (dakika): {formData.duration}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={120}
            step={1}
            value={formData.duration}
            onValueChange={(value) => setFormData(prev => ({ ...prev, duration: value }))}
            minimumTrackTintColor="#10B981"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#10B981"
          />

          {/* Severity */}
          <Text variant="bodyMedium" style={styles.label}>
            Şiddet (1-10): {formData.severity}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={formData.severity}
            onValueChange={(value) => setFormData(prev => ({ ...prev, severity: value }))}
            minimumTrackTintColor="#EF4444"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#EF4444"
          />

          {/* Resistance Level */}
          <Text variant="bodyMedium" style={styles.label}>
            Direnç Seviyesi (1-10): {formData.resistanceLevel}
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={10}
            step={1}
            value={formData.resistanceLevel}
            onValueChange={(value) => setFormData(prev => ({ ...prev, resistanceLevel: value }))}
            minimumTrackTintColor="#10B981"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#10B981"
          />

          {/* Trigger */}
          <TextInput
            label="Tetikleyici"
            value={formData.trigger}
            onChangeText={(text) => setFormData(prev => ({ ...prev, trigger: text }))}
            style={styles.input}
            multiline
            numberOfLines={2}
          />

          {/* Notes */}
          <TextInput
            label="Notlar"
            value={formData.notes}
            onChangeText={(text) => setFormData(prev => ({ ...prev, notes: text }))}
            style={styles.input}
            multiline
            numberOfLines={3}
          />

          <Button
            mode="contained"
            onPress={handleSave}
            loading={loading}
            style={styles.button}
          >
            Kaydet
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  card: {
    elevation: 2,
    borderRadius: 12,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
    color: '#1F2937',
    fontWeight: 'bold',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    marginBottom: 8,
    color: '#374151',
    fontWeight: '600',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  picker: {
    height: 50,
  },
  slider: {
    height: 40,
    marginVertical: 8,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
  },
  submitButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  button: {
    marginTop: 16,
    paddingVertical: 8,
  },
});