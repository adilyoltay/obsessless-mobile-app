/**
 * Feature Flag Sistemi
 * 
 * KRITIK: Tüm AI özellikleri varsayılan olarak KAPALI olmalıdır
 * Bu dosya, AI özelliklerinin güvenli bir şekilde açılıp kapatılmasını sağlar
 */

export const FEATURE_FLAGS = {
  // AI özellikleri - Kademeli aktifleştirme
  AI_CHAT: __DEV__, // Development'ta aktif
  AI_ONBOARDING: __DEV__, // Development'ta aktif
  AI_INSIGHTS: false, // Henüz test aşamasında
  AI_VOICE: false, // Henüz test aşamasında
  
  // Güvenlik kontrolleri
  isEnabled: (feature: keyof typeof FEATURE_FLAGS): boolean => {
    // Ek runtime kontrolleri
    const isFeatureEnabled = FEATURE_FLAGS[feature] || false;
    
    // Feature kullanımını logla
    if (__DEV__) {
      console.log(`[FeatureFlag] ${feature}: ${isFeatureEnabled ? 'ENABLED' : 'DISABLED'}`);
    }
    
    return isFeatureEnabled;
  },
  
  // Acil durum kapatma
  disableAll: () => {
    Object.keys(FEATURE_FLAGS).forEach(key => {
      if (key !== 'isEnabled' && key !== 'disableAll') {
        (FEATURE_FLAGS as any)[key] = false;
      }
    });
    
    console.warn('[FeatureFlag] All AI features have been disabled!');
  },
  
  // Remote toggle capability için hazırlık
  updateFromRemote: (remoteFlags: Partial<typeof FEATURE_FLAGS>) => {
    Object.entries(remoteFlags).forEach(([key, value]) => {
      if (key in FEATURE_FLAGS && typeof value === 'boolean') {
        (FEATURE_FLAGS as any)[key] = value;
      }
    });
  }
};

// Development'ta feature flag durumunu göster
if (__DEV__) {
  console.log('[FeatureFlags] Current state:', {
    AI_CHAT: FEATURE_FLAGS.AI_CHAT,
    AI_ONBOARDING: FEATURE_FLAGS.AI_ONBOARDING,
    AI_INSIGHTS: FEATURE_FLAGS.AI_INSIGHTS,
    AI_VOICE: FEATURE_FLAGS.AI_VOICE
  });
} 