export type ColorBlindMode = 'protanopia' | 'deuteranopia' | 'tritanopia' | 'none';

const DEFAULT_PALETTE = {
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#60a5fa',
};

export const getAccessiblePalette = (mode: ColorBlindMode) => {
  switch (mode) {
    case 'protanopia':
      return { positive: '#0066CC', negative: '#FF9900', neutral: '#999999' };
    case 'deuteranopia':
      return { positive: '#0099FF', negative: '#FF6600', neutral: '#999999' };
    case 'tritanopia':
      return { positive: '#00AA00', negative: '#FF0066', neutral: '#999999' };
    default:
      return DEFAULT_PALETTE;
  }
};

