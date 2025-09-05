import React from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/Colors';

export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  scheme: 'light' | 'dark';
  colors: {
    background: string;
    card: string;
    text: string;
  };
};

export const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = React.useState<ThemeMode>('system');
  const scheme: 'light' | 'dark' = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('app_settings');
        if (raw) {
          const parsed = JSON.parse(raw);
          const saved: ThemeMode | undefined = parsed?.themeMode;
          if (saved === 'system' || saved === 'light' || saved === 'dark') setMode(saved);
        }
      } catch {}
    })();
  }, []);

  const setModePersist = React.useCallback(async (m: ThemeMode) => {
    setMode(m);
    try {
      const raw = await AsyncStorage.getItem('app_settings');
      const parsed = raw ? JSON.parse(raw) : {};
      parsed.themeMode = m;
      await AsyncStorage.setItem('app_settings', JSON.stringify(parsed));
    } catch {}
  }, []);

  const value: ThemeContextValue = React.useMemo(() => ({
    mode,
    setMode: setModePersist,
    scheme,
    colors: {
      background: scheme === 'dark' ? Colors.dark.background : Colors.light.background,
      card: scheme === 'dark' ? Colors.dark.card : Colors.light.card,
      text: scheme === 'dark' ? Colors.dark.text : Colors.light.text,
    }
  }), [mode, setModePersist, scheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) {
    // Safe fallback for early mounts outside provider (e.g., during navigation tree setup)
    const scheme: 'light' | 'dark' = 'light';
    return {
      mode: 'system' as ThemeMode,
      setMode: () => {},
      scheme,
      colors: {
        background: Colors.light.background,
        card: Colors.light.card,
        text: Colors.light.text,
      },
    } as ThemeContextValue;
  }
  return ctx;
}

export function useThemeColors() {
  return useTheme().colors;
}
