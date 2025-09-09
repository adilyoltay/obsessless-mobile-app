import React, { useEffect, useState } from 'react';

// Components
import VAMoodCheckin from './VAMoodCheckin';
import healthSignals from '@/services/ai/healthSignals';
import modelRunner from '@/services/ai/modelRunner';
import { getUserDateString } from '@/utils/timezoneUtils';

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
  const [prefillMEA, setPrefillMEA] = useState<{ mood: number; energy: number; anxiety: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isVisible) return;
      try {
        setLoading(true);
        await healthSignals.ensurePermissions().catch(() => {});
        const ymd = getUserDateString(new Date());
        const feats = await healthSignals.getDailyFeatures(ymd);
        const out = await modelRunner.runBigMoodDetector(feats as any);
        if (!mounted) return;
        setPrefillMEA({
          mood: Number(out.mood_score_pred ?? 50),
          energy: Number(out.energy_level_pred ?? 6),
          anxiety: Number(out.anxiety_level_pred ?? 5),
        });
      } catch {
        if (!mounted) return;
        setPrefillMEA(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    run();
    return () => { mounted = false; };
  }, [isVisible]);

  return (
    <VAMoodCheckin
      isVisible={isVisible}
      onClose={onClose}
      onComplete={onComplete}
      disableVoice={true}
      initialMEA={prefillMEA}
    />
  );
}
