import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useAIChatStore } from '@/features/ai/store/aiChatStore';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';

export default function AIChatScreen() {
  const { user } = useAuthContext();
  const {
    conversations,
    activeConversationId,
    sendMessage,
    setInputText,
    ui,
    clearError,
    dismissCrisisHelp
  } = useAIChatStore();
  const { sendMotivationalNotification } = useNotifications();
  const [delayWarning, setDelayWarning] = useState(false);

  const messages = conversations.find(c => c.id === activeConversationId)?.messages || [];

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (ui.isTyping) {
      timer = setTimeout(() => setDelayWarning(true), 10000);
    } else {
      if (timer) clearTimeout(timer);
      setDelayWarning(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [ui.isTyping]);

  useEffect(() => {
    if (ui.redirectToEmergency) {
      sendMotivationalNotification?.('Acil destek öneriliyor');
      Alert.alert('Acil Destek', 'Kriz tespit edildi, lütfen güvenlik planınıza başvurun.');
      dismissCrisisHelp();
    }
  }, [ui.redirectToEmergency]);

  const handleSend = useCallback(() => {
    if (!ui.inputText.trim()) return;
    sendMessage(ui.inputText, user?.id || '');
  }, [ui.inputText, user?.id]);

  const renderMessage = ({ item }: any) => (
    <View style={[styles.message, item.role === 'user' ? styles.userMessage : styles.aiMessage]}>
      <Text>{item.content}</Text>
      {item.role === 'assistant' && (
        <View style={styles.feedbackRow}>
          <TouchableOpacity style={styles.feedbackBtn} onPress={() => console.log('feedback:up', item.id)}>
            <Text>👍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.feedbackBtn} onPress={() => console.log('feedback:down', item.id)}>
            <Text>👎</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {(ui.error || delayWarning) && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{ui.error || 'Yanıt gecikti, lütfen bekleyin...'}</Text>
          {ui.error && (
            <TouchableOpacity onPress={clearError}>
              <Text style={styles.dismiss}>Kapat</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        style={styles.list}
      />

      {ui.isTyping && <ActivityIndicator style={styles.typingIndicator} />}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={ui.inputText}
          onChangeText={setInputText}
          placeholder="Mesajınızı yazın"
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Gönder</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  list: { flex: 1 },
  message: { padding: 8, marginVertical: 4, borderRadius: 8 },
  userMessage: { backgroundColor: '#DCF8C6', alignSelf: 'flex-end' },
  aiMessage: { backgroundColor: '#F1F5F9', alignSelf: 'flex-start' },
  feedbackRow: { flexDirection: 'row', marginTop: 4 },
  feedbackBtn: { marginRight: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#CBD5E0', borderRadius: 8, padding: 8 },
  sendButton: { marginLeft: 8, backgroundColor: '#10B981', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  sendButtonText: { color: '#FFF' },
  typingIndicator: { marginVertical: 8 },
  notice: { backgroundColor: '#FEE2E2', padding: 8, borderRadius: 8, marginBottom: 8 },
  noticeText: { color: '#B91C1C' },
  dismiss: { marginTop: 4, color: '#2563EB' }
});
