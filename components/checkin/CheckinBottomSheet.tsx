import React from 'react';

// Components
import SimpleVoiceRecorder from './SimpleVoiceRecorder';

interface CheckinBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

/**
 * CheckinBottomSheet - iPhone Tarzı Minimalist Voice Check-in
 * Sade, kırmızı yuvarlak butonlu ses kayıt sistemi
 * 
 * Özellikler:
 * - iPhone Voice Memos tarzı tasarım
 * - Büyük kırmızı kayıt butonu
 * - Ding/dong ses efektleri
 * - Minimalist timer ve wave animasyonu
 * - Native speech-to-text
 * - Heuristik mood analizi
 */
export default function CheckinBottomSheet({
  isVisible,
  onClose,
  onComplete,
}: CheckinBottomSheetProps) {
  return (
    <SimpleVoiceRecorder
      isVisible={isVisible}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
}
