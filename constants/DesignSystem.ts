export const ObsessLessColors = {
  primary: '#10B981',
  secondary: '#059669',
  accent: '#34D399',
  warning: '#F59E0B',
  error: '#EF4444',
  darkestBg: '#0F172A',
  darkerBg: '#111827',
  darkBg: '#1F2937',
  white: '#FFFFFF',
  lightGray: '#E5E7EB',
  primaryText: '#374151',
  secondaryText: '#6B7280',
  overlay: 'rgba(15, 23, 42, 0.85)',
  cardBg: 'rgba(255, 255, 255, 0.05)',
  borderColor: 'rgba(255, 255, 255, 0.1)',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const Sizes = {
  breathingCircle: 224,
  outerRing1: 288,
  outerRing2: 256,
  buttonSize: 80,
  buttonGap: 24,
  headerIcon: 32,
  progressHeight: 6,
} as const;

export const AnimationConfig = {
  phases: {
    inhale: { duration: 4000, scale: 1.4, opacity: 1 },
    hold: { duration: 7000, scale: 1.4, opacity: 1 },
    exhale: { duration: 8000, scale: 1.0, opacity: 0.7 },
  },
  transitions: {
    fadeIn: { duration: 300 },
    slideUp: { duration: 500 },
    buttonPress: { duration: 150 },
  },
  wave: {
    totalCycle: 19000,
    pathDuration: 600,
    dotSpeed: 1200,
  },
} as const;
