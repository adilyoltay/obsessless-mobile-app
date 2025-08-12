import { useLanguage } from '@/contexts/LanguageContext';

export type TranslationKey = string;

export function useTranslation() {
  const { t, language } = useLanguage();
  return { t, language };
} 