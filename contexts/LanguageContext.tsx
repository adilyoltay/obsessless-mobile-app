
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

// Import translation files
import trTranslations from '@/localization/tr.json';
import enTranslations from '@/localization/en.json';

export type Language = 'tr' | 'en';

// Translation type definitions
type TranslationKeys = typeof trTranslations;

// Deep path extraction for type safety
type PathsToStringProps<T> = T extends string 
  ? [] 
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>]
    }[Extract<keyof T, string>];

type Join<T extends string[], D extends string> = T extends readonly [infer F, ...infer R]
  ? F extends string
    ? R extends readonly string[]
      ? R['length'] extends 0
        ? F
        : `${F}${D}${Join<R, D>}`
      : never
    : never
  : never;

export type TranslationPath = Join<PathsToStringProps<TranslationKeys>, '.'>;

interface LanguageContextType {
  language: Language;
  t: (key: TranslationPath, fallback?: string) => string;
  isRTL: boolean;
  systemLanguage: string;
  availableLanguages: Language[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  tr: trTranslations,
  en: enTranslations,
};

const STORAGE_KEY = '@obsessless_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('tr');
  const [systemLanguage, setSystemLanguage] = useState<string>('tr');

  // Detect system language
  const detectSystemLanguage = (): Language => {
    const locale = (Localization as any)?.locale || (Array.isArray((Localization as any)?.locales) ? (Localization as any).locales[0] : 'en');
    const languageCode = locale.split('-')[0].toLowerCase();
    
    // Map common locale codes to supported languages
    const languageMap: Record<string, Language> = {
      'tr': 'tr',
      'en': 'en',
      'en-us': 'en',
      'en-gb': 'en',
      'en-au': 'en',
      'en-ca': 'en',
    };

    return languageMap[languageCode] || languageMap[locale] || 'en';
  };

  // Initialize language settings (no manual override; follow system)
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        // Get system language
        const systemLang = detectSystemLanguage();
        setSystemLanguage(systemLang);

        // Always follow system language
        setLanguageState(systemLang);
        try { await AsyncStorage.setItem(STORAGE_KEY, systemLang); } catch {}
    } catch (error) {
        console.error('Error initializing language:', error);
        // Fallback to Turkish
        setLanguageState('tr');
    }
  };

    initializeLanguage();
  }, []);

  // Manual setLanguage is disabled; we keep API shape minimal in context value

  // Translation function with type safety
  const t = (key: TranslationPath, fallback?: string): string => {
    try {
      const keys = key.split('.');
      let value: any = translations[language];
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          // Key not found, try fallback language (English)
          if (language !== 'en') {
            let fallbackValue: any = translations.en;
            for (const k of keys) {
              if (fallbackValue && typeof fallbackValue === 'object' && k in fallbackValue) {
                fallbackValue = fallbackValue[k];
              } else {
                fallbackValue = null;
                break;
              }
            }
            if (typeof fallbackValue === 'string') {
              return fallbackValue;
            }
          }
          
          // Return fallback or key if provided
          return fallback || key;
        }
      }
      
      return typeof value === 'string' ? value : (fallback || key);
    } catch (error) {
      console.error('Translation error:', error);
      return fallback || key;
    }
  };

  // RTL language detection
  const isRTL = false; // Turkish and English are LTR languages

  const availableLanguages: Language[] = ['tr', 'en'];

  const value: LanguageContextType = {
    language,
    t,
    isRTL,
    systemLanguage,
    availableLanguages,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Hook for translation only (lighter)
export function useTranslation() {
  const { t, language } = useLanguage();
  return { t, language };
}

// Language utilities
export const languageUtils = {
  // Get language name in native language
  getLanguageName: (lang: Language): string => {
    const names = {
      tr: 'Türkçe',
      en: 'English',
    };
    return names[lang];
  },

  // Get language flag emoji
  getLanguageFlag: (lang: Language): string => {
    const flags = {
      tr: '🇹🇷',
      en: '🇺🇸',
    };
    return flags[lang];
  },

  // Format date according to language
  formatDate: (date: Date, lang: Language): string => {
    const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  },

  // Format time according to language
  formatTime: (date: Date, lang: Language): string => {
    const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  // Format number according to language
  formatNumber: (num: number, lang: Language): string => {
    const locale = lang === 'tr' ? 'tr-TR' : 'en-US';
    return num.toLocaleString(locale);
  },
};
