/**
 * 🎨 Lindsay Braman Tarzı Art Therapy Çizim Şablonları
 * El çizimi, terapötik ve empatik görsel rehberler
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText, Ellipse, Line, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

interface TemplateProps {
  size?: number;
  style?: any;
}

// Lindsay Braman Renk Paleti
const BramanColors = {
  // Ana renkler - soft pastel tonlar
  primary: '#7C9885',      // Sage green
  secondary: '#E4B4B4',    // Dusty rose
  accent: '#94B49F',       // Mint green
  warm: '#F2A774',         // Peach
  cool: '#8FA9C7',         // Soft blue
  purple: '#B599CC',       // Lavender
  yellow: '#E8C473',       // Soft yellow
  coral: '#E8857C',        // Soft coral
  
  // Nötr renkler
  dark: '#5A5A5A',         // Soft charcoal
  medium: '#8E8E8E',       // Medium gray
  light: '#D4D4D4',        // Light gray
  paper: '#FAF8F3',        // Warm paper
  
  // Gölge ve vurgular
  shadow: 'rgba(0, 0, 0, 0.08)',
  highlight: 'rgba(255, 255, 255, 0.8)',
};

// 1. Mandala Şablonu - Merkezi simetri ve denge
export const MandalaTemplate: React.FC<TemplateProps> = ({ size = 300, style }) => {
  const center = size / 2;
  const radius1 = size * 0.15;
  const radius2 = size * 0.25;
  const radius3 = size * 0.35;
  const radius4 = size * 0.45;
  
  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Arka plan */}
        <Circle cx={center} cy={center} r={size/2} fill={BramanColors.paper} />
        
        {/* Merkez çember */}
        <Circle cx={center} cy={center} r={radius1} fill="none" stroke={BramanColors.light} strokeWidth="1" strokeDasharray="4,2" />
        
        {/* İkinci halka - 6 yapraklı çiçek */}
        {[0, 60, 120, 180, 240, 300].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x = center + radius2 * Math.cos(rad);
          const y = center + radius2 * Math.sin(rad);
          
          return (
            <G key={angle}>
              <Circle cx={x} cy={y} r={radius1/2} fill="none" stroke={BramanColors.light} strokeWidth="1" />
              <Ellipse 
                cx={x} 
                cy={y} 
                rx={radius1/3} 
                ry={radius1/1.5}
                fill="none" 
                stroke={BramanColors.light} 
                strokeWidth="0.8"
                strokeDasharray="2,1"
                transform={`rotate(${angle + 90} ${x} ${y})`}
              />
            </G>
          );
        })}
        
        {/* Üçüncü halka - 12 nokta */}
        {Array.from({length: 12}, (_, i) => i * 30).map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const x = center + radius3 * Math.cos(rad);
          const y = center + radius3 * Math.sin(rad);
          
          return (
            <Circle key={angle} cx={x} cy={y} r="2" fill={BramanColors.light} opacity="0.6" />
          );
        })}
        
        {/* Dış halka */}
        <Circle cx={center} cy={center} r={radius4} fill="none" stroke={BramanColors.light} strokeWidth="1" strokeDasharray="6,3" />
        
        {/* Merkez nokta */}
        <Circle cx={center} cy={center} r="3" fill={BramanColors.medium} opacity="0.5" />
      </Svg>
    </View>
  );
};

// 2. Duygu Haritası - Emotion Mapping
export const EmotionMapTemplate: React.FC<TemplateProps> = ({ size = 300, style }) => {
  const center = size / 2;
  
  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Arka plan */}
        <Rect x="0" y="0" width={size} height={size} fill={BramanColors.paper} />
        
        {/* Kafa silüeti */}
        <Path
          d={`M${center} ${size*0.7} 
              Q${center*0.5} ${size*0.7} ${center*0.4} ${size*0.4}
              Q${center*0.4} ${size*0.2} ${center} ${size*0.15}
              Q${center*1.6} ${size*0.2} ${center*1.6} ${size*0.4}
              Q${center*1.5} ${size*0.7} ${center} ${size*0.7}`}
          fill="none"
          stroke={BramanColors.light}
          strokeWidth="2"
          strokeDasharray="8,4"
        />
        
        {/* Duygu bölgeleri */}
        <G opacity="0.3">
          {/* Mutluluk - üst */}
          <Circle cx={center} cy={size*0.25} r="25" fill={BramanColors.yellow} />
          <SvgText x={center} y={size*0.25} fontSize="10" fill={BramanColors.dark} textAnchor="middle">Mutluluk</SvgText>
          
          {/* Üzüntü - alt sol */}
          <Circle cx={center*0.7} cy={size*0.5} r="20" fill={BramanColors.cool} />
          <SvgText x={center*0.7} y={size*0.5} fontSize="10" fill={BramanColors.dark} textAnchor="middle">Üzüntü</SvgText>
          
          {/* Öfke - alt sağ */}
          <Circle cx={center*1.3} cy={size*0.5} r="20" fill={BramanColors.coral} />
          <SvgText x={center*1.3} y={size*0.5} fontSize="10" fill={BramanColors.dark} textAnchor="middle">Öfke</SvgText>
          
          {/* Korku - orta */}
          <Circle cx={center} cy={size*0.45} r="18" fill={BramanColors.purple} />
          <SvgText x={center} y={size*0.45} fontSize="10" fill={BramanColors.dark} textAnchor="middle">Korku</SvgText>
        </G>
        
        {/* Bağlantı çizgileri */}
        <G opacity="0.2">
          <Line x1={center} y1={size*0.25} x2={center*0.7} y2={size*0.5} stroke={BramanColors.medium} strokeWidth="1" strokeDasharray="2,2" />
          <Line x1={center} y1={size*0.25} x2={center*1.3} y2={size*0.5} stroke={BramanColors.medium} strokeWidth="1" strokeDasharray="2,2" />
          <Line x1={center*0.7} y1={size*0.5} x2={center*1.3} y2={size*0.5} stroke={BramanColors.medium} strokeWidth="1" strokeDasharray="2,2" />
        </G>
      </Svg>
    </View>
  );
};

// 3. Nefes Görselleştirme - Breathing Pattern
export const BreathingPatternTemplate: React.FC<TemplateProps> = ({ size = 300, style }) => {
  const center = size / 2;
  
  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Arka plan */}
        <Circle cx={center} cy={center} r={size/2} fill={BramanColors.paper} />
        
        {/* Nefes dalgaları - organik çizgiler */}
        {[0.2, 0.3, 0.4].map((ratio, index) => {
          const r = size * ratio;
          return (
            <Circle
              key={index}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={BramanColors.accent}
              strokeWidth="1.5"
              strokeDasharray={`${8 - index * 2},${4 + index}`}
              opacity={0.6 - index * 0.15}
            />
          );
        })}
        
        {/* Merkez nokta - nefes odağı */}
        <Circle cx={center} cy={center} r="8" fill={BramanColors.cool} opacity="0.4" />
        <Circle cx={center} cy={center} r="3" fill={BramanColors.cool} opacity="0.8" />
        
        {/* Yön okları - nefes alış veriş */}
        <G opacity="0.3">
          {/* Yukarı - nefes al */}
          <Path
            d={`M${center} ${size*0.15} L${center-5} ${size*0.2} M${center} ${size*0.15} L${center+5} ${size*0.2}`}
            stroke={BramanColors.accent}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <SvgText x={center} y={size*0.1} fontSize="10" fill={BramanColors.medium} textAnchor="middle">Nefes Al</SvgText>
          
          {/* Aşağı - nefes ver */}
          <Path
            d={`M${center} ${size*0.85} L${center-5} ${size*0.8} M${center} ${size*0.85} L${center+5} ${size*0.8}`}
            stroke={BramanColors.warm}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <SvgText x={center} y={size*0.92} fontSize="10" fill={BramanColors.medium} textAnchor="middle">Nefes Ver</SvgText>
        </G>
      </Svg>
    </View>
  );
};

// 4. Güvenli Alan - Safe Space
export const SafeSpaceTemplate: React.FC<TemplateProps> = ({ size = 300, style }) => {
  const center = size / 2;
  
  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Arka plan */}
        <Rect x="0" y="0" width={size} height={size} fill={BramanColors.paper} />
        
        {/* Ev/sığınak şekli */}
        <Path
          d={`M${center} ${size*0.2} L${size*0.25} ${size*0.4} L${size*0.25} ${size*0.7} L${size*0.75} ${size*0.7} L${size*0.75} ${size*0.4} Z`}
          fill="none"
          stroke={BramanColors.secondary}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        
        {/* Çatı */}
        <Path
          d={`M${size*0.2} ${size*0.4} L${center} ${size*0.2} L${size*0.8} ${size*0.4}`}
          fill="none"
          stroke={BramanColors.secondary}
          strokeWidth="2"
          strokeLinecap="round"
        />
        
        {/* Kapı */}
        <Rect
          x={center - 15}
          y={size * 0.55}
          width="30"
          height="40"
          fill="none"
          stroke={BramanColors.warm}
          strokeWidth="1.5"
          rx="2"
        />
        
        {/* Pencereler */}
        <Rect x={size*0.35} y={size*0.48} width="20" height="20" fill="none" stroke={BramanColors.accent} strokeWidth="1" />
        <Rect x={size*0.6} y={size*0.48} width="20" height="20" fill="none" stroke={BramanColors.accent} strokeWidth="1" />
        
        {/* Kalp - güven sembolü */}
        <Path
          d={`M${center} ${size*0.35} Q${center-10} ${size*0.3} ${center-5} ${size*0.32} Q${center} ${size*0.35} ${center} ${size*0.4} Q${center} ${size*0.35} ${center+5} ${size*0.32} Q${center+10} ${size*0.3} ${center} ${size*0.35}`}
          fill={BramanColors.coral}
          opacity="0.5"
        />
        
        {/* Zemin çizgisi */}
        <Line x1={size*0.1} y1={size*0.75} x2={size*0.9} y2={size*0.75} stroke={BramanColors.light} strokeWidth="1" strokeDasharray="4,2" />
        
        {/* Bulutlar - huzur */}
        <G opacity="0.3">
          <Ellipse cx={size*0.2} cy={size*0.12} rx="20" ry="10" fill={BramanColors.cool} />
          <Ellipse cx={size*0.7} cy={size*0.15} rx="25" ry="12" fill={BramanColors.cool} />
        </G>
      </Svg>
    </View>
  );
};

// 5. Özgür Çizim Rehberi - Free Drawing Guide
export const FreeDrawingGuide: React.FC<TemplateProps> = ({ size = 300, style }) => {
  const center = size / 2;
  
  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Arka plan */}
        <Rect x="0" y="0" width={size} height={size} fill={BramanColors.paper} />
        
        {/* Rehber çizgiler - çok hafif */}
        <G opacity="0.1">
          {/* Yatay çizgiler */}
          {[0.25, 0.5, 0.75].map(ratio => (
            <Line
              key={`h-${ratio}`}
              x1={size * 0.1}
              y1={size * ratio}
              x2={size * 0.9}
              y2={size * ratio}
              stroke={BramanColors.light}
              strokeWidth="1"
              strokeDasharray="8,8"
            />
          ))}
          
          {/* Dikey çizgiler */}
          {[0.25, 0.5, 0.75].map(ratio => (
            <Line
              key={`v-${ratio}`}
              x1={size * ratio}
              y1={size * 0.1}
              x2={size * ratio}
              y2={size * 0.9}
              stroke={BramanColors.light}
              strokeWidth="1"
              strokeDasharray="8,8"
            />
          ))}
        </G>
        
        {/* Başlangıç noktaları önerileri */}
        <G opacity="0.2">
          <Circle cx={center} cy={center} r="3" fill={BramanColors.accent} />
          <Circle cx={size * 0.25} cy={size * 0.25} r="2" fill={BramanColors.warm} />
          <Circle cx={size * 0.75} cy={size * 0.25} r="2" fill={BramanColors.cool} />
          <Circle cx={size * 0.25} cy={size * 0.75} r="2" fill={BramanColors.purple} />
          <Circle cx={size * 0.75} cy={size * 0.75} r="2" fill={BramanColors.coral} />
        </G>
        
        {/* İlham verici kelimeler */}
        <G opacity="0.25">
          <SvgText x={size * 0.2} y={size * 0.15} fontSize="12" fill={BramanColors.medium} fontStyle="italic">keşfet</SvgText>
          <SvgText x={size * 0.7} y={size * 0.2} fontSize="12" fill={BramanColors.medium} fontStyle="italic">hisset</SvgText>
          <SvgText x={size * 0.15} y={size * 0.85} fontSize="12" fill={BramanColors.medium} fontStyle="italic">ifade et</SvgText>
          <SvgText x={size * 0.65} y={size * 0.9} fontSize="12" fill={BramanColors.medium} fontStyle="italic">özgür ol</SvgText>
        </G>
      </Svg>
    </View>
  );
};

// Export all templates
export const ArtTherapyTemplates = {
  mandala: MandalaTemplate,
  emotionMap: EmotionMapTemplate,
  breathing: BreathingPatternTemplate,
  safeSpace: SafeSpaceTemplate,
  freeDrawing: FreeDrawingGuide,
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
