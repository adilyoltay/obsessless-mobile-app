import React from 'react';
import Svg, { Circle, Path, Line } from 'react-native-svg';

export type MoodFaceColorSet = [string, string, string, string, string];

type Props = {
  score: number; // 0–100
  size?: number; // pixel size of square
  colors?: MoodFaceColorSet; // optional external color mapping (bad→good)
  strokeOpacity?: number;
  strokeColor?: string;
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/**
 * SVG-based mood face, mapped to 5 ranges using the provided vectors.
 * - 0–20: Çok Kötü
 * - 21–40: Kötü
 * - 41–60: Orta
 * - 61–80: İyi
 * - 81–100: Çok İyi
 */
export default function MoodFace({ score, size = 160, colors, strokeOpacity, strokeColor }: Props) {
  const s = clamp(Math.round(score), 0, 100);

  const defaults: MoodFaceColorSet = ['#e85d5d', '#f09359', '#fcd250', '#53bdae', '#69c47f'];
  const palette: MoodFaceColorSet = colors && colors.length === 5 ? colors : defaults;
  const seg = s <= 20 ? 0 : s <= 40 ? 1 : s <= 60 ? 2 : s <= 80 ? 3 : 4;
  const fill = palette[seg];
  const mouth: 'sad1' | 'sad2' | 'flat' | 'smile1' | 'smile2' = seg === 0 ? 'sad1' : seg === 1 ? 'sad2' : seg === 2 ? 'flat' : seg === 3 ? 'smile1' : 'smile2';

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityLabel="Mood Face">
      {/* Face background */}
      <Circle cx={16} cy={16} r={15} fill={fill} stroke={strokeColor || "#000"} strokeOpacity={typeof strokeOpacity === 'number' ? strokeOpacity : 0.5} strokeWidth={0.8} />
      {/* Eyes */}
      <Circle cx={11} cy={13} r={1.5} fill="#000" fillOpacity={0.6} />
      <Circle cx={21} cy={13} r={1.5} fill="#000" fillOpacity={0.6} />
      {/* Mouth (by range) */}
      {mouth === 'flat' ? (
        <Line x1={10} y1={20} x2={22} y2={20} stroke="#000" strokeOpacity={0.6} strokeWidth={2} strokeLinecap="round" />
      ) : mouth === 'sad1' ? (
        <Path d="M 10 22 Q 16 16 22 22" stroke="#000" strokeOpacity={0.6} strokeWidth={2} fill="none" strokeLinecap="round" />
      ) : mouth === 'sad2' ? (
        <Path d="M 10 21 Q 16 18 22 21" stroke="#000" strokeOpacity={0.6} strokeWidth={2} fill="none" strokeLinecap="round" />
      ) : mouth === 'smile1' ? (
        <Path d="M 10 18 Q 16 24 22 18" stroke="#000" strokeOpacity={0.6} strokeWidth={2} fill="none" strokeLinecap="round" />
      ) : (
        <Path d="M 10 17 Q 16 26 22 17" stroke="#000" strokeOpacity={0.6} strokeWidth={2} fill="none" strokeLinecap="round" />
      )}
    </Svg>
  );
}
