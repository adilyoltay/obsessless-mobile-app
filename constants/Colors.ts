
/**
 * ObsessLess Color Palette - Based on Documentation
 */

export const Colors = {
  // Primary Colors from Documentation
  primary: {
    green: '#10B981',      // Ana renk
    lightGreen: '#F0FDF4', // Arka plan
  },
  
  // Text Colors
  text: {
    primary: '#111827',    // Başlıklar (Dark Gray)
    secondary: '#6B7280',  // Alt metin (Medium Gray)
    tertiary: '#9CA3AF',   // Caption
  },
  
  // UI Colors
  ui: {
    border: '#E5E7EB',     // Çizgiler (Light Gray)
    background: '#FFFFFF',  // Pure white
    backgroundSecondary: '#F3F4F6', // Very light gray
  },
  
  // Status Colors
  status: {
    error: '#EF4444',      // Hata (Error Red)
    warning: '#F59E0B',    // Uyarı (Warning Orange)
    success: '#10B981',    // Same as primary green
    info: '#3B82F6',       // Blue
  },
  
  // Legacy support (will be refactored)
  light: {
    text: '#111827',
    background: '#FFFFFF',
    backgroundSecondary: '#F3F4F6',
    tint: '#10B981',
    icon: '#6B7280',
    tabIconDefault: '#6B7280',
    tabIconSelected: '#10B981',
    border: '#E5E7EB',
    card: '#FFFFFF',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    gradient: ['#10B981', '#059669'],
    accent: '#F0FDF4',
  },
  dark: {
    // Dark mode not specified in documentation
    text: '#f8fafc',
    background: '#0f172a',
    backgroundSecondary: '#1e293b',
    tint: '#10B981',
    icon: '#94a3b8',
    tabIconDefault: '#64748b',
    tabIconSelected: '#10B981',
    border: '#334155',
    card: '#1e293b',
    success: '#10B981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    gradient: ['#10B981', '#059669'],
    accent: '#334155',
  },
};

// Spacing from Documentation
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,  // default
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border Radius from Documentation
export const BorderRadius = {
  sm: 8,   // chips, small buttons
  md: 12,  // buttons, inputs
  lg: 16,  // cards
  xl: 24,  // bottom sheets
  full: 9999,
};

// Typography from Documentation
export const Typography = {
  fontSize: {
    caption: 12,    // Caption
    bodyS: 14,      // Body S
    bodyM: 16,      // Body M
    bodyL: 18,      // Body L
    headingS: 20,   // Heading S
    headingM: 24,   // Heading M
    headingL: 28,   // Heading L
    headingXL: 32,  // Heading XL
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },
  fontFamily: {
    regular: 'Inter',
    medium: 'Inter-Medium',
  },
};
