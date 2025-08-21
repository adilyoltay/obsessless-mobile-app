import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutDown } from 'react-native-reanimated';

interface OAuthWebViewProps {
  url: string;
  onSuccess: (callbackUrl: string) => void;
  onError: (error: string) => void;
  onClose: () => void;
  visible: boolean;
}

export default function OAuthWebView({ 
  url, 
  onSuccess, 
  onError, 
  onClose, 
  visible 
}: OAuthWebViewProps) {
  const [loading, setLoading] = useState(true);
  const webViewRef = useRef<WebView>(null);

  console.log('🌐 OAuthWebView render:', { visible, url: url ? 'present' : 'missing' });

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    const { url: currentUrl } = navState;
    console.log('🌐 WebView navigation:', currentUrl);

    // Check if this is our callback URL
    if (currentUrl.includes('obslesstest://auth/callback')) {
      console.log('✅ OAuth callback detected:', currentUrl);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess(currentUrl);
      return false; // Prevent navigation
    }

    // Check for OAuth errors
    if (currentUrl.includes('error=')) {
      const urlParams = new URLSearchParams(currentUrl.split('?')[1]);
      const error = urlParams.get('error') || 'OAuth hatası';
      console.error('❌ OAuth error in URL:', error);
      onError(error);
      return false;
    }

    return true;
  };

  const handleClose = () => {
    console.log('🔐 OAuthWebView close button pressed');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  if (!visible) {
    console.log('🌐 OAuthWebView not visible, returning null');
    return null;
  }

  console.log('🌐 OAuthWebView rendering with URL:', url);

  return (
    <Animated.View 
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={styles.overlay}
    >
      <Animated.View 
        entering={SlideInUp.duration(400).springify()}
        exiting={SlideOutDown.duration(300)}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Google ile Giriş</Text>
          <Pressable
            onPress={handleClose}
            style={styles.closeButton}
            hitSlop={10}
          >
            <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
          </Pressable>
        </View>

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Google sayfası yükleniyor...</Text>
          </View>
        )}

        {/* WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: url }}
          style={styles.webView}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('❌ WebView error:', nativeEvent);
            onError('Sayfa yüklenirken hata oluştu');
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('❌ WebView HTTP error:', nativeEvent);
            onError('Bağlantı hatası');
          }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          scalesPageToFit={true}
          mixedContentMode="compatibility"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    fontFamily: 'Inter_500Medium',
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontFamily: 'Inter_400Regular',
  },
  webView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
}); 