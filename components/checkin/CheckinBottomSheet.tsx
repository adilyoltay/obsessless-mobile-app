import React from 'react';

// Components
import VoiceCheckinModern from './VoiceCheckinModern';

interface CheckinBottomSheetProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

/**
 * CheckinBottomSheet - Sade Voice Check-in Sheet
 * Modern ve minimal tasarım ile ses tabanlı check-in deneyimi
 * 
 * Özellikler:
 * - Sade UI tasarımı (quick route buttonları kaldırıldı)
 * - Modern ses kayıt bileşeni
 * - Basit kullanım talimatları ve örnek
 * - Wave animasyonları
 * - Real-time timer
 */
export default function CheckinBottomSheet({
  isVisible,
  onClose,
  onComplete,
}: CheckinBottomSheetProps) {
  return (
    <VoiceCheckinModern
      isVisible={isVisible}
      onClose={onClose}
      onComplete={onComplete}
    />
  );
}
