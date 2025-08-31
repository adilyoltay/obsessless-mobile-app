import React from 'react';

// Components
import VAMoodCheckin from './VAMoodCheckin';

interface CheckinBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: (result?: any) => void;
}

/**
 * CheckinBottomSheet - VA Pad tabanlı Duygu Kontrolü
 * Gelişmiş mood check-in sistemi
 * 
 * Özellikler:
 * - VA (Valence-Arousal) Pad ile görsel mood seçimi
 * - Valans slider ile ince ayar
 * - Voice check-in ile otomatik analiz
 * - Native speech-to-text
 * - Heuristik mood analizi
 * - Dinamik renk ve animasyonlar
 */
export default function CheckinBottomSheet({
  isVisible,
  onClose,
  onComplete,
}: CheckinBottomSheetProps) {
  return (
    <VAMoodCheckin
      isVisible={isVisible}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
}
