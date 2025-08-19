/**
 * 🆘 Emergency Contacts Manager Component
 * 
 * Acil durum kişilerini yönetmek için UI bileşeni
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Switch
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
// Background crisis monitor kaldırıldı; tip yerel olarak tanımlanır
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: 'therapist' | 'family' | 'friend' | 'emergency';
  autoAlert: boolean;
  priority: number;
}
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { FEATURE_FLAGS } from '@/constants/featureFlags';

export default function EmergencyContactsManager() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    relationship: 'family' as EmergencyContact['relationship'],
    autoAlert: false,
    priority: 1
  });

  useEffect(() => {
    if (user?.id) {
      loadContacts();
    }
  }, [user?.id]);

  const loadContacts = async () => {
    if (!user?.id) return;
    
    try {
      const stored = await AsyncStorage.getItem(`emergency_contacts_${user?.id || 'anon'}`);
      if (stored) {
        setContacts(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  };

  const saveContact = async () => {
    if (!user?.id) return;
    
    if (!formData.name || !formData.phone) {
      Alert.alert('Hata', 'Lütfen tüm alanları doldurun');
      return;
    }

    try {
      setIsLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      let updatedContacts: EmergencyContact[];
      
      if (editingContact) {
        // Update existing
        updatedContacts = contacts.map(c => 
          c.id === editingContact.id 
            ? { ...editingContact, ...formData }
            : c
        );
      } else {
        // Add new
        const newContact: EmergencyContact = {
          id: `contact_${Date.now()}`,
          ...formData
        };
        updatedContacts = [...contacts, newContact];
      }

      // Save to storage
      await AsyncStorage.setItem(
        `emergency_contacts_${user?.id || 'anon'}`,
        JSON.stringify(updatedContacts)
      );

      // Background crisis monitor kaldırıldığı için yalnızca lokal saklama yapılır

      setContacts(updatedContacts);
      resetForm();
      
      Alert.alert(
        'Başarılı',
        editingContact ? 'Kişi güncellendi' : 'Kişi eklendi'
      );
    } catch (error) {
      console.error('Failed to save contact:', error);
      Alert.alert('Hata', 'Kişi kaydedilemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!user?.id) return;

    Alert.alert(
      'Kişiyi Sil',
      'Bu kişiyi silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              
              const updatedContacts = contacts.filter(c => c.id !== contactId);
              
              await AsyncStorage.setItem(
                `emergency_contacts_${user?.id || 'anon'}`,
                JSON.stringify(updatedContacts)
              );
              
              // Background crisis monitor kaldırıldığı için yalnızca lokal saklama yapılır
              
              setContacts(updatedContacts);
            } catch (error) {
              console.error('Failed to delete contact:', error);
              Alert.alert('Hata', 'Kişi silinemedi');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      relationship: 'family',
      autoAlert: false,
      priority: 1
    });
    setEditingContact(null);
    setShowAddModal(false);
  };

  const openEditModal = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      autoAlert: contact.autoAlert,
      priority: contact.priority
    });
    setShowAddModal(true);
  };

  const getRelationshipText = (relationship: EmergencyContact['relationship']) => {
    const texts = {
      therapist: 'Terapist',
      family: 'Aile',
      friend: 'Arkadaş',
      emergency: 'Acil Durum'
    };
    return texts[relationship] || relationship;
  };

  const getRelationshipIcon = (relationship: EmergencyContact['relationship']) => {
    const icons = {
      therapist: 'doctor',
      family: 'home-heart',
      friend: 'account-heart',
      emergency: 'hospital-box'
    };
    return icons[relationship] || 'account';
  };

  // Crisis detection modülü kaldırıldı – bu ekran her zaman kullanılabilir

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {/** cast entire props to any to silence very strict name union types */}
        {React.createElement(MaterialCommunityIcons as any, { name: 'phone-alert', size: 24, color: '#dc2626' })}
        <Text style={styles.title}>Acil Durum Kişileri</Text>
      </View>

      <Text style={styles.description}>
        Kriz durumlarında otomatik olarak bilgilendirilecek kişiler
      </Text>

      {/* Contacts List */}
      <ScrollView style={styles.contactsList} showsVerticalScrollIndicator={false}>
        {contacts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons name="account-plus" size={48} color="#9ca3af" />
            <Text style={styles.emptyText}>Henüz acil durum kişisi eklenmemiş</Text>
            <Text style={styles.emptySubtext}>
              Güvenliğiniz için en az bir kişi eklemenizi öneririz
            </Text>
          </Card>
        ) : (
          contacts.map(contact => (
            <Card key={contact.id} style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <View style={styles.contactIcon}>
                  <MaterialCommunityIcons 
                    name={getRelationshipIcon(contact.relationship) as any} 
                    size={24} 
                    color="#7c3aed" 
                  />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                  <View style={styles.contactMeta}>
                    <Text style={styles.contactRelation}>
                      {getRelationshipText(contact.relationship)}
                    </Text>
                    {contact.autoAlert && (
                      <View style={styles.autoAlertBadge}>
                        <MaterialCommunityIcons name="bell" size={12} color="#059669" />
                        <Text style={styles.autoAlertText}>Otomatik</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.contactActions}>
                  <Pressable 
                    onPress={() => openEditModal(contact)}
                    style={styles.actionButton}
                  >
                    {React.createElement(MaterialCommunityIcons as any, { name: 'pencil', size: 20, color: '#6b7280' })}
                  </Pressable>
                  <Pressable 
                    onPress={() => deleteContact(contact.id)}
                    style={styles.actionButton}
                  >
                    {React.createElement(MaterialCommunityIcons as any, { name: 'delete', size: 20, color: '#ef4444' })}
                  </Pressable>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add Button */}
      <Button
        onPress={() => setShowAddModal(true)}
        variant="primary"
        style={styles.addButton}
      >
        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Kişi Ekle</Text>
      </Button>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        onClose={resetForm}
      >
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>İsim</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
              placeholder="Örn: Dr. Ahmet Yılmaz"
              placeholderTextColor="#9ca3af"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Telefon</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              placeholder="Örn: 0532 123 45 67"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>İlişki</Text>
            <View style={styles.relationshipOptions}>
              {(['therapist', 'family', 'friend', 'emergency'] as const).map(rel => (
                <Pressable
                  key={rel}
                  style={[
                    styles.relationOption,
                    formData.relationship === rel && styles.relationOptionActive
                  ]}
                  onPress={() => setFormData(prev => ({ ...prev, relationship: rel }))}
                >
                  <MaterialCommunityIcons 
                    name={getRelationshipIcon(rel) as any} 
                    size={20} 
                    color={formData.relationship === rel ? '#7c3aed' : '#6b7280'} 
                  />
                  <Text style={[
                    styles.relationOptionText,
                    formData.relationship === rel && styles.relationOptionTextActive
                  ]}>
                    {getRelationshipText(rel)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.switchGroup}>
            <View style={styles.switchInfo}>
              <Text style={styles.label}>Otomatik Bildirim</Text>
              <Text style={styles.switchDescription}>
                Kriz durumunda otomatik olarak bilgilendirilsin
              </Text>
            </View>
            <Switch
              value={formData.autoAlert}
              onValueChange={(value) => setFormData(prev => ({ ...prev, autoAlert: value }))}
              trackColor={{ false: '#e5e7eb', true: '#a78bfa' }}
              thumbColor={formData.autoAlert ? '#7c3aed' : '#f3f4f6'}
            />
          </View>

          <View style={styles.modalActions}>
            <Button
              onPress={resetForm}
              variant="secondary"
              style={styles.modalButton}
            >
              İptal
            </Button>
            <Button
              onPress={saveContact}
              variant="primary"
              style={styles.modalButton}
              disabled={isLoading}
            >
              {isLoading ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  contactsList: {
    flex: 1,
  },
  contactCard: {
    marginBottom: 12,
    padding: 16,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  contactPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  contactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  contactRelation: {
    fontSize: 12,
    color: '#9ca3af',
  },
  autoAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  autoAlertText: {
    fontSize: 11,
    color: '#059669',
    marginLeft: 4,
    fontWeight: '500',
  },
  contactActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledCard: {
    alignItems: 'center',
    padding: 32,
    margin: 16,
  },
  disabledText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 16,
  },
  disabledSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  relationshipOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  relationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  relationOptionActive: {
    borderColor: '#7c3aed',
    backgroundColor: '#f3e8ff',
  },
  relationOptionText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
  },
  relationOptionTextActive: {
    color: '#7c3aed',
    fontWeight: '500',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  switchInfo: {
    flex: 1,
  },
  switchDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
});
