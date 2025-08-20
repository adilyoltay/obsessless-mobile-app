import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import BreathworkPro from '@/components/breathwork/BreathworkPro';
import { Toast } from '@/components/ui/Toast';

export default function BreathworkTab() {
  const params = useLocalSearchParams<{ 
    protocol?: 'box' | '478' | 'paced',
    autoStart?: string,
    source?: string,
    anxietyLevel?: string 
  }>();
  
  const [showToast, setShowToast] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const hasAutoStarted = useRef(false);
  
  // Parametreleri parse et
  const protocol = (params.protocol as 'box' | '478' | 'paced') || 'box';
  const shouldAutoStart = params.autoStart === 'true' && !hasAutoStarted.current;
  const source = params.source || '';
  
  useEffect(() => {
    if (shouldAutoStart && source === 'checkin') {
      hasAutoStarted.current = true;
      
      // Kullanıcıya bilgi ver
      const anxietyLevel = Number(params.anxietyLevel || 5);
      const message = anxietyLevel >= 7 
        ? '🌬️ Yüksek anksiyete algılandı. 4-7-8 nefesi ile sakinleşelim.'
        : '🌬️ Birlikte nefes alalım. Box breathing başlıyor...';
      
      setToastMessage(message);
      setShowToast(true);
      
      // Toast'tan sonra auto-start için BreathworkPro'ya sinyal gönder
      // (BreathworkPro bileşenine autoStart prop eklemek gerekecek)
    }
  }, [shouldAutoStart, source, params.anxietyLevel]);
  
  return (
    <View style={styles.container}>
      <BreathworkPro 
        protocol={protocol}
        autoStart={shouldAutoStart}
      />
      <Toast
        visible={showToast}
        message={toastMessage}
        onHide={() => setShowToast(false)}
        type="info"
        duration={3000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});


