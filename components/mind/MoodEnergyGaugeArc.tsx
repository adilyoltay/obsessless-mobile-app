import React from 'react';
import Svg, { G, Path, Line, Polygon } from 'react-native-svg';

type Props = {
  width?: number;
  height?: number;
  mood: number;   // 0..100
  energy: number; // 1..10
};

/**
 * Compact semi-circle gauge inspired by provided SVG.
 * - Static colored segments
 * - Pointer angle reflects energy (1..10 → -90..+90)
 * - Mood maps to arc coloring implicitly via MindScoreCard color usage around it
 *
 * Note: We only render the gauge (without background/emojis) for compact fit.
 */
const MoodEnergyGaugeArc: React.FC<Props> = ({ width = 160, height = 110, mood, energy }) => {
  const viewBox = '0 0 800 500';
  // Map energy (1..10) to pointer angle (-90..+90)
  const e10 = Math.max(1, Math.min(10, Math.round(energy)));
  const pointerDeg = -90 + ((e10 - 1) / 9) * 180; // -90..+90

  return (
    <Svg width={width} height={height} viewBox={viewBox}>
      {/* Gauge group translated to center bottom (as in original art) */}
      <G transform="translate(400, 350)">
        {/* Segments */}
        <G stroke="#003366" strokeWidth={2.5}>
          {/* Çok Kötü (Kırmızı) */}
          <Path d="M -180,0 A 180,180 0 0 1 -111.2, -145.6 L -86.5, -113.2 A 140,140 0 0 0 -140,0 Z" fill="#e85d5d" />
          {/* Kötü (Turuncu) */}
          <Path d="M -111.2, -145.6 A 180,180 0 0 1 0, -180 L 0, -140 A 140,140 0 0 0 -86.5, -113.2 Z" fill="#f09359" />
          {/* Orta (Sarı) */}
          <Path d="M 0, -180 A 180,180 0 0 1 111.2, -145.6 L 86.5, -113.2 A 140,140 0 0 0 0, -140 Z" fill="#fcd250" />
          {/* İyi (Turkuaz) */}
          <Path d="M 111.2, -145.6 A 180,180 0 0 1 180, 0 L 140, 0 A 140,140 0 0 0 86.5, -113.2 Z" fill="#53bdae" />
          {/* Çok İyi (Yeşil) - alt segmenti göstermeyelim (yarım çember) */}
        </G>

        {/* Pointer (energy) */}
        <G transform={`rotate(${pointerDeg})`}>
          {/* hub */}
          <Path d="M -40,0 A 40,40 0 0 1 40,0 Z" fill="#003366" />
          {/* pointer triangle */}
          <Polygon points="0,-165 -8,-145 8,-145" fill="#003366" />
          {/* pointer shaft */}
          <Line x1={0} y1={0} x2={0} y2={-155} stroke="#003366" strokeWidth={5} />
        </G>
      </G>
    </Svg>
  );
};

export default MoodEnergyGaugeArc;

