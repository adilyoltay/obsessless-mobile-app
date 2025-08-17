import { useLanguage } from '@/contexts/LanguageContext';

export function useTranslation() {
  const { t, language } = useLanguage();
  // Expose relaxed signature for component convenience
  const tr = ((key: string, fallback?: string) => t(key as any, fallback)) as (k: string, f?: string) => string;
  return { t: tr, language };
} 