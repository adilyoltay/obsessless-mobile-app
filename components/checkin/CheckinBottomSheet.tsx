import React, { useEffect, useState } from 'react';

// Components
import VAMoodCheckin from './VAMoodCheckin';
import healthSignals from '@/services/heartpy/healthSignals';
import { runOnRecentSignal } from '@/services/heartpy';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import calibrationService from '@/services/heartpy/calibration';
import { getLastInferenceMeta } from '@/services/heartpy/inferenceMetaStore';

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
  const { user } = useAuth();
  const [prefillMEA, setPrefillMEA] = useState<{ mood: number; energy: number; anxiety: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [serviceMeta, setServiceMeta] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isVisible) return;
      try {
        setLoading(true);
        await healthSignals.ensurePermissions().catch(() => {});
        const out = await runOnRecentSignal(120);
        if (!mounted) return;
        const mea = out ? {
          mood: Number(out.mood ?? 50),
          energy: Number(out.energy ?? 6),
          anxiety: Number(out.anxiety ?? 5),
        } : null;
        // Apply personal bias if available
        const adj = mea && user?.id ? await calibrationService.applyBias(user.id, mea, 1.0) : mea || undefined as any;
        if (adj) setPrefillMEA(adj);
        // Attach meta for panel
        const meta = getLastInferenceMeta();
        setServiceMeta(out ? { ...meta, confidence: out.confidence ?? null, prefillMEA: adj } : null);
      } catch {
        if (!mounted) return;
        setPrefillMEA(null);
        setServiceMeta(null);
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
      onComplete={(result?: any) => {
        try {
          if (onComplete) onComplete(result);
          // Update personal bias from user's calibration delta
          if (user?.id && prefillMEA && result?.data) {
            const finalMood = Number(result.data.mood_score);
            const finalEnergy = Number(result.data.energy_level);
            const finalAnxiety = Number(result.data.anxiety_level);
            const delta = {
              mood: (isFinite(finalMood) ? finalMood : 0) - prefillMEA.mood,
              energy: (isFinite(finalEnergy) ? finalEnergy : 0) - prefillMEA.energy,
              anxiety: (isFinite(finalAnxiety) ? finalAnxiety : 0) - prefillMEA.anxiety,
            };
            calibrationService.updateBias(user.id, delta).catch(()=>{});
          }
        } catch {}
      }}
      disableVoice={true}
      initialMEA={prefillMEA}
      serviceMeta={serviceMeta}
    />
  );
}
