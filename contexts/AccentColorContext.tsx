import React, { createContext, useContext, useMemo, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAdvancedMoodColor, getMoodGradient, getVAColor, getGradientFromBase } from '@/utils/colorUtils';
import { StorageKeys } from '@/utils/storage';

type ColorMode = 'static' | 'today' | 'weekly';

type AccentContextValue = {
  colorMode: ColorMode;
  setColorMode: (m: ColorMode) => void;
  score: number; // 0-100
  setScore: (s: number) => void;
  color: string;
  gradient: [string, string];
  va: { x: number; y: number } | null;
  setVA: (v: { x: number; y: number } | null) => void;
};

const AccentColorContext = createContext<AccentContextValue | undefined>(undefined);

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [colorMode, setColorModeState] = useState<ColorMode>('today');
  const [score, setScore] = useState<number>(55);
  const [va, setVAState] = useState<{ x: number; y: number } | null>(null);

  // Load color mode once
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(StorageKeys.SETTINGS);
        if (saved) {
          const parsed = JSON.parse(saved);
          const mode = parsed?.colorMode as ColorMode | undefined;
          if (mode) setColorModeState(mode);
          if (parsed?.accentVA && typeof parsed.accentVA.x === 'number' && typeof parsed.accentVA.y === 'number') {
            setVAState({ x: parsed.accentVA.x, y: parsed.accentVA.y });
          }
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

  const setVA = useCallback((v: { x: number; y: number } | null) => {
    setVAState(v);
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(StorageKeys.SETTINGS);
        const parsed = saved ? JSON.parse(saved) : {};
        parsed.accentVA = v ? { x: v.x, y: v.y } : null;
        await AsyncStorage.setItem(StorageKeys.SETTINGS, JSON.stringify(parsed));
      } catch {}
    })();
  }, []);

  const color = useMemo(() => {
    if (colorMode === 'static') return '#10B981';
    if (va) return getVAColor(va.x, va.y);
    return getAdvancedMoodColor(score);
  }, [colorMode, score, va]);

  const gradient = useMemo(() => {
    if (va) return getGradientFromBase(getVAColor(va.x, va.y));
    return getMoodGradient(score);
  }, [score, va]);

  const value = useMemo(() => ({ colorMode, setColorMode, score, setScore, color, gradient, va, setVA }), [colorMode, setColorMode, score, color, gradient, va, setVA]);

  return <AccentColorContext.Provider value={value}>{children}</AccentColorContext.Provider>;
}

export function useAccentColor() {
  const ctx = useContext(AccentColorContext);
  if (!ctx) throw new Error('useAccentColor must be used within AccentColorProvider');
  return ctx;
}
