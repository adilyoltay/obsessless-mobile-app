
// Auth Stack - Kimlik doğrulama akışı
export type AuthStackParamList = {
  login: undefined;
  signup: undefined;
  onboarding: { userId: string };
  'forgot-password': undefined;
};

// Main Tab Navigator - Ana sekme navigasyonu
export type MainTabParamList = {
  index: undefined;        // Today/Dashboard
  // tracking removed

  settings: undefined;    // Ayarlar
};

// Tracking Stack - Takip alt navigasyonu
export type TrackingStackParamList = {
  // Removed compulsion routes
};



// Settings Stack - Ayarlar alt navigasyonu
export type SettingsStackParamList = {
  'settings-main': undefined;
  profile: undefined;
  notifications: undefined;
  language: undefined;
  about: undefined;
  'privacy-policy': undefined;
};

// Root Stack - Ana navigator
export type RootStackParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
  // 'ybocs-assessment' removed
  achievements: undefined;
  'crisis-support': undefined;
  modal: undefined;
};

// Screen Props Types
export type AuthScreenProps<T extends keyof AuthStackParamList> = {
  route: { params: AuthStackParamList[T] };
  navigation: any;
};

export type MainTabScreenProps<T extends keyof MainTabParamList> = {
  route: { params: MainTabParamList[T] };
  navigation: any;
};

// Navigation guard types
export type NavigationGuardProps = {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireProfile?: boolean;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
