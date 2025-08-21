import React from 'react';
import Svg, { Circle, Path, Line, Ellipse, G, Rect } from 'react-native-svg';

// Lindsay Braman tarzında hedef illüstrasyonları

export const ReduceAnxietyIcon = ({ width = 60, height = 60 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 100 100">
    {/* Sakin yüz ve nefes dalgaları */}
    <Circle cx="50" cy="45" r="20" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <Path d="M40 42 Q50 38 60 42" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" /> {/* Gülümseme */}
    <Circle cx="42" cy="40" r="2" fill="#10B981" />
    <Circle cx="58" cy="40" r="2" fill="#10B981" />
    {/* Nefes dalgaları */}
    <Path d="M25 65 Q30 60 35 65 T45 65" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
    <Path d="M55 65 Q60 60 65 65 T75 65" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
    <Path d="M30 75 Q35 70 40 75 T50 75" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
    <Path d="M50 75 Q55 70 60 75 T70 75" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.4" strokeLinecap="round" />
  </Svg>
);

export const ControlCompulsionsIcon = ({ width = 60, height = 60 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 100 100">
    {/* El ve kontrol çizgileri */}
    <G>
      {/* El */}
      <Path d="M30 50 L30 70 L35 70 L35 45 L40 45 L40 70 L45 70 L45 42 L50 42 L50 70 L55 70 L55 45 L60 45 L60 70 L65 70 L65 52" 
            fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M30 50 Q25 45 30 40" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" /> {/* Başparmak */}
      {/* Güç çizgileri */}
      <Line x1="70" y1="35" x2="75" y2="30" stroke="#10B981" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <Line x1="70" y1="45" x2="77" y2="45" stroke="#10B981" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      <Line x1="70" y1="55" x2="75" y2="60" stroke="#10B981" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </G>
  </Svg>
);

export const ImproveDailyLifeIcon = ({ width = 60, height = 60 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 100 100">
    {/* Güneş ve günlük döngü */}
    <Circle cx="50" cy="30" r="12" fill="none" stroke="#10B981" strokeWidth="2" />
    {/* Güneş ışınları */}
    <Line x1="50" y1="10" x2="50" y2="15" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <Line x1="65" y1="15" x2="68" y2="12" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <Line x1="65" y1="45" x2="68" y2="48" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <Line x1="35" y1="15" x2="32" y2="12" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <Line x1="35" y1="45" x2="32" y2="48" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    {/* Ev */}
    <Path d="M30 65 L30 85 L70 85 L70 65 L50 50 Z" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Rect x="42" y="70" width="16" height="15" fill="none" stroke="#10B981" strokeWidth="1.5" />
  </Svg>
);

export const BetterRelationshipsIcon = ({ width = 60, height = 60 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 100 100">
    {/* İki kalp birleşiyor */}
    <Path d="M35 40 Q35 30 45 30 Q50 30 50 35 Q50 30 55 30 Q65 30 65 40 Q65 50 50 65 Q35 50 35 40 Z" 
          fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    {/* Bağlantı çizgileri */}
    <Circle cx="25" cy="35" r="8" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.6" />
    <Circle cx="75" cy="35" r="8" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.6" />
    <Path d="M33 35 L42 35" stroke="#10B981" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" strokeDasharray="2 2" />
    <Path d="M58 35 L67 35" stroke="#10B981" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" strokeDasharray="2 2" />
  </Svg>
);

export const IncreaseFunctionalityIcon = ({ width = 60, height = 60 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 100 100">
    {/* Hedef ve oklar */}
    <Circle cx="50" cy="50" r="25" fill="none" stroke="#10B981" strokeWidth="2" />
    <Circle cx="50" cy="50" r="18" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.7" />
    <Circle cx="50" cy="50" r="10" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.5" />
    <Circle cx="50" cy="50" r="4" fill="#10B981" />
    {/* Ok */}
    <Line x1="15" y1="20" x2="45" y2="50" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <Path d="M40 48 L45 50 L43 45" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const EmotionalRegulationIcon = ({ width = 60, height = 60 }: { width?: number; height?: number }) => (
  <Svg width={width} height={height} viewBox="0 0 100 100">
    {/* Meditasyon pozu ve denge */}
    <Circle cx="50" cy="35" r="10" fill="none" stroke="#10B981" strokeWidth="2" />
    {/* Vücut */}
    <Path d="M50 45 L50 65" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    {/* Kollar - meditasyon pozu */}
    <Path d="M50 55 Q35 50 30 60" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <Path d="M50 55 Q65 50 70 60" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    {/* Bacaklar - lotus pozu */}
    <Path d="M50 65 Q35 70 30 75" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    <Path d="M50 65 Q65 70 70 75" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    {/* Denge dalgaları */}
    <Path d="M20 85 Q30 82 40 85 T60 85 T80 85" fill="none" stroke="#10B981" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
  </Svg>
);
