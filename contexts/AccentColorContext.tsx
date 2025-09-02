import React, { createContext, useContext, useMemo, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAdvancedMoodColor, getMoodGradient } from '@/utils/colorUtils';
import { StorageKeys } from '@/utils/storage';

type ColorMode = 'static' | 'today' | 'weekly';

type AccentContextValue = {
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  score: number; // 0-100
  setScore: (s: number) => void;
  color: string;
  gradient: [string, string];
};

const AccentColorContext = createContext<AccentContextValue | undefined>(undefined);

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>('today');
  const [score, setScore] = useState<number>(55);

  // Load color mode once
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(StorageKeys.SETTINGS);
        if (saved) {
          const parsed = JSON.parse(saved);
          const mode = parsed?.colorMode as ColorMode | undefined;
          if (mode) setColorModeState(mode);
        }
      } catch {}
    })();
  }, []);

  const setColorMode = useCallback((m: ColorMode) => {
    setColorModeState(m);
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(StorageKeys.SETTINGS);
        const parsed = saved ? JSON.parse(saved) : {};
        parsed.colorMode = m;
        await AsyncStorage.setItem(StorageKeys.SETTINGS, JSON.stringify(parsed));
      } catch {}
    })();
  }, []);

  const color = useMemo(() => (colorMode === 'static' ? '#10B981' : getAdvancedMoodColor(score)), [colorMode, score]);
  const gradient = useMemo(() => getMoodGradient(score), [score]);

  const value = useMemo(() => ({ colorMode, setColorMode, score, setScore, color, gradient }), [colorMode, setColorMode, score, color, gradient]);

  return <AccentColorContext.Provider value={value}>{children}</AccentColorContext.Provider>;
}

export function useAccentColor() {
  const ctx = useContext(AccentColorContext);
  if (!ctx) throw new Error('useAccentColor must be used within AccentColorProvider');
  return ctx;
}

