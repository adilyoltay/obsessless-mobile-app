import React from 'react';
import {
  View,
  StyleSheet,
  StatusBar,
  SafeAreaView
} from 'react-native';
import { Stack } from 'expo-router';
import { ChatInterface } from '@/features/ai/components/ChatInterface';
import { ConversationState } from '@/features/ai/types';

export default function AIChatScreen() {
  const handleConversationStateChange = (state: ConversationState) => {
    console.log('Conversation state changed:', state);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      <Stack.Screen
        options={{
          title: 'AI Uzman Desteği',
          headerStyle: { backgroundColor: '#F9FAFB' },
          headerTitleStyle: { color: '#374151', fontSize: 18, fontWeight: '600' },
          headerShadowVisible: false,
        }}
      />

      <ChatInterface 
        onConversationStateChange={handleConversationStateChange}
        showHeader={false}
        containerStyle={styles.chatContainer}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  chatContainer: {
    flex: 1,
  },
}); 