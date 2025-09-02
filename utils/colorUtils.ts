// Color utilities shared across screens

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export const mixHex = (a: string, b: string, t: number) => {
  t = clamp01(t);
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ra = (A >> 16) & 255, ga = (A >> 8) & 255, ba = A & 255;
  const rb = (B >> 16) & 255, gb = (B >> 8) & 255, bb = B & 255;
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  const hx = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hx(m(ra, rb))}${hx(m(ga, gb))}${hx(m(ba, bb))}`;
};

export const lighten = (hex: string, amt: number) => mixHex(hex, '#ffffff', clamp01(amt));
export const darken = (hex: string, amt: number) => mixHex(hex, '#000000', clamp01(amt));

// Mood spectrum mapping (0-100)
export const getAdvancedMoodColor = (score: number): string => {
  if (score >= 90) return '#C2185B'; // Heyecanlı
  if (score >= 80) return '#7E57C2'; // Enerjik
  if (score >= 70) return '#4CAF50'; // Mutlu
  if (score >= 60) return '#26A69A'; // Sakin
  if (score >= 50) return '#66BB6A'; // Normal
  if (score >= 40) return '#FFA726'; // Endişeli
  if (score >= 30) return '#FF7043'; // Sinirli
  if (score >= 20) return '#5C6BC0'; // Üzgün
  return '#F06292'; // Kızgın
};

// Generate a subtle gradient pair from base mood color
export const getMoodGradient = (score: number): [string, string] => {
  const base = getAdvancedMoodColor(score || 55);
  // Slight lighten and darken around the base for depth
  const start = lighten(base, 0.08);
  const end = darken(base, 0.06);
  return [start, end];
};

