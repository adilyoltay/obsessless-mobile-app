import { useLanguage } from '@/contexts/LanguageContext';

// Translation keys type (simplified)
export type TranslationKey = string;

// Comprehensive translations object
const translations = {
  tr: {
    // Navigation
    'navigation.today': 'Bugün',
    'navigation.tracking': 'Takip',
    'navigation.erp': 'ERP',
    'navigation.settings': 'Ayarlar',
    'navigation.back': 'Geri',
    'navigation.home': 'Ana Sayfa',

    // General
    'general.save': 'Kaydet',
    'general.cancel': 'İptal',
    'general.delete': 'Sil',
    'general.edit': 'Düzenle',
    'general.loading': 'Yükleniyor...',
    'general.error': 'Hata oluştu',
    'general.success': 'Başarılı',
    'general.next': 'İleri',
    'general.previous': 'Geri',
    'general.finish': 'Bitir',
    'general.apply': 'Uygula',
    'general.clear': 'Temizle',
    'general.refresh': 'Yenile',

    // Home
    'home.welcome': 'Hoş Geldiniz',
    'home.quickActions': 'Hızlı İşlemler',
    'home.recentActivity': 'Son Aktiviteler',
    'home.tipOfTheDay': 'Günün İpucu',
    'home.logCompulsion': 'Kompülsiyon Kaydet',
    'home.ybocs': 'Y-BOCS Testi',
    'home.erpExercise': 'ERP Egzersizi',
    'home.viewHistory': 'Geçmişi Görüntüle',

    // Compulsions
    'compulsions.compulsionHistory': 'Kompülsiyon Geçmişi',
    'compulsions.type': 'Tür',
    'compulsions.intensity': 'Şiddet',
    'compulsions.resistance': 'Direnç',
    'compulsions.duration': 'Süre',
    'compulsions.mood': 'Ruh Hali',
    'compulsions.triggers': 'Tetikleyiciler',
    'compulsions.notes': 'Notlar',
    'compulsions.completed': 'Tamamlandı',
    'compulsions.stopped': 'Durduruldu',
    'compulsions.helpUsed': 'Yardım Kullanıldı',

    // Stats
    'compulsions.stats.totalEntries': 'Toplam Kayıt',
    'compulsions.stats.averageIntensity': 'Ortalama Şiddet',
    'compulsions.stats.averageResistance': 'Ortalama Direnç',
    'compulsions.stats.longestDuration': 'En Uzun Süre',
    'compulsions.stats.mostCommonType': 'En Yaygın Tür',
    'compulsions.stats.dailyTrend': 'Günlük Trend',

    // Filters
    'compulsions.filters.filtersAndSorting': 'Filtreler ve Sıralama',
    'compulsions.filters.compulsionType': 'Kompülsiyon Türü',
    'compulsions.filters.sorting': 'Sıralama',
    'compulsions.filters.byDate': 'Tarihe Göre',
    'compulsions.filters.byIntensity': 'Şiddete Göre',
    'compulsions.filters.byResistance': 'Dirençe Göre',
    'compulsions.filters.ascending': 'Artan',
    'compulsions.filters.descending': 'Azalan',
    'compulsions.filters.clearFilters': 'Filtreleri Temizle',

    // Summary Periods
    'compulsions.summaryPeriods.today': 'Bugün',
    'compulsions.summaryPeriods.week': 'Bu Hafta',
    'compulsions.summaryPeriods.month': 'Bu Ay',

    // Messages
    'compulsions.messages.noRecords': 'Henüz kayıt yok',
    'compulsions.messages.noRecordsSubtitle': 'İlk kompülsiyonunuzu kaydetmek için Takip sekmesini kullanın',
    'compulsions.messages.loadingRecords': 'Kayıtlar yükleniyor...',

    // Y-BOCS
    'ybocs.title': 'Y-BOCS Değerlendirmesi',
    'ybocs.subtitle': 'Yale-Brown Obsesif Kompulsif Ölçeği',
    'ybocs.question': 'Soru',
    'ybocs.next': 'Sonraki',
    'ybocs.previous': 'Önceki',
    'ybocs.submit': 'Gönder',
    'ybocs.results': 'Sonuçlar',
    'ybocs.score': 'Puan',

    // Settings
    'settings.title': 'Ayarlar',
    'settings.language': 'Dil',
    'settings.languageSelection': 'Dil Seçimi',
    'settings.notifications': 'Bildirimler',
    'settings.account': 'Hesap',

    // Tips
    'tips.motivation1': 'Kompülsiyonlarınızla başa çıkarken, küçük adımlar atmanın büyük değişimler yaratabileceğini unutmayın.',
    'tips.motivation2': 'Her direnişiniz bir başarıdır! Kendinizi tebrik etmeyi unutmayın.',
  },
  en: {
    // Navigation
    'navigation.today': 'Today',
    'navigation.tracking': 'Tracking',
    'navigation.erp': 'ERP',
    'navigation.settings': 'Settings',
    'navigation.back': 'Back',
    'navigation.home': 'Home',

    // General
    'general.save': 'Save',
    'general.cancel': 'Cancel',
    'general.delete': 'Delete',
    'general.edit': 'Edit',
    'general.loading': 'Loading...',
    'general.error': 'An error occurred',
    'general.success': 'Success',
    'general.next': 'Next',
    'general.previous': 'Previous',
    'general.finish': 'Finish',
    'general.apply': 'Apply',
    'general.clear': 'Clear',
    'general.refresh': 'Refresh',

    // Home
    'home.welcome': 'Welcome',
    'home.quickActions': 'Quick Actions',
    'home.recentActivity': 'Recent Activity',
    'home.tipOfTheDay': 'Tip of the Day',
    'home.logCompulsion': 'Log Compulsion',
    'home.ybocs': 'Y-BOCS Test',
    'home.erpExercise': 'ERP Exercise',
    'home.viewHistory': 'View History',

    // Compulsions
    'compulsions.compulsionHistory': 'Compulsion History',
    'compulsions.type': 'Type',
    'compulsions.intensity': 'Intensity',
    'compulsions.resistance': 'Resistance',
    'compulsions.duration': 'Duration',
    'compulsions.mood': 'Mood',
    'compulsions.triggers': 'Triggers',
    'compulsions.notes': 'Notes',
    'compulsions.completed': 'Completed',
    'compulsions.stopped': 'Stopped',
    'compulsions.helpUsed': 'Help Used',

    // Stats
    'compulsions.stats.totalEntries': 'Total Entries',
    'compulsions.stats.averageIntensity': 'Average Intensity',
    'compulsions.stats.averageResistance': 'Average Resistance',
    'compulsions.stats.longestDuration': 'Longest Duration',
    'compulsions.stats.mostCommonType': 'Most Common Type',
    'compulsions.stats.dailyTrend': 'Daily Trend',

    // Filters
    'compulsions.filters.filtersAndSorting': 'Filters and Sorting',
    'compulsions.filters.compulsionType': 'Compulsion Type',
    'compulsions.filters.sorting': 'Sorting',
    'compulsions.filters.byDate': 'By Date',
    'compulsions.filters.byIntensity': 'By Intensity',
    'compulsions.filters.byResistance': 'By Resistance',
    'compulsions.filters.ascending': 'Ascending',
    'compulsions.filters.descending': 'Descending',
    'compulsions.filters.clearFilters': 'Clear Filters',

    // Summary Periods
    'compulsions.summaryPeriods.today': 'Today',
    'compulsions.summaryPeriods.week': 'This Week',
    'compulsions.summaryPeriods.month': 'This Month',

    // Messages
    'compulsions.messages.noRecords': 'No records yet',
    'compulsions.messages.noRecordsSubtitle': 'Use the Tracking tab to log your first compulsion',
    'compulsions.messages.loadingRecords': 'Loading records...',

    // Y-BOCS
    'ybocs.title': 'Y-BOCS Assessment',
    'ybocs.subtitle': 'Yale-Brown Obsessive Compulsive Scale',
    'ybocs.question': 'Question',
    'ybocs.next': 'Next',
    'ybocs.previous': 'Previous',
    'ybocs.submit': 'Submit',
    'ybocs.results': 'Results',
    'ybocs.score': 'Score',

    // Settings
    'settings.title': 'Settings',
    'settings.language': 'Language',
    'settings.languageSelection': 'Language Selection',
    'settings.notifications': 'Notifications',
    'settings.account': 'Account',

    // Tips
    'tips.motivation1': 'When dealing with compulsions, remember that small steps can create big changes.',
    'tips.motivation2': 'Every resistance is a success! Don\'t forget to congratulate yourself.',
  },
};

export function useTranslation() {
  const { language } = useLanguage();

  const t = (key: TranslationKey, fallback?: string): string => {
    const translation = (translations[language] as any)?.[key] || (translations.en as any)?.[key] || fallback || key;
    return translation;
  };

  return { t, language };
} 