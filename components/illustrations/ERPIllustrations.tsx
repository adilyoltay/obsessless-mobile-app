/**
 * 🎨 Lindsay Braman Tarzı ERP Kategori İllüstrasyonları
 * El çizimi, organik ve empatik görsel dil
 */

import React from 'react';
import Svg, { Path, Circle, G, Text as SvgText, Ellipse, Line, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

interface IllustrationProps {
  size?: number;
  color?: string;
  selected?: boolean;
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

// Contamination (Kirlenme) - Temizlik obsesyonları
export const ContaminationIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color = BramanColors.coral,
  selected = false 
}) => {
  const strokeColor = selected ? BramanColors.dark : BramanColors.medium;
  const fillOpacity = selected ? 1 : 0.8;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* El ve mikroplar - organik çizim */}
      <G opacity={fillOpacity}>
        {/* El silüeti */}
        <Path
          d="M35 60 Q30 45 35 35 Q38 25 45 20 Q50 18 55 20 Q62 25 65 35 Q70 45 65 60 Q60 70 50 72 Q40 70 35 60"
          fill={color}
          opacity="0.3"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="0"
        />
        
        {/* Parmaklar - el çizimi görünümü */}
        <Line x1="42" y1="35" x2="40" y2="25" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        <Line x1="47" y1="32" x2="46" y2="20" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        <Line x1="53" y1="32" x2="54" y2="20" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        <Line x1="58" y1="35" x2="60" y2="25" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />
        
        {/* Mikroplar/bakteriler - organik şekiller */}
        <Circle cx="25" cy="30" r="4" fill={color} opacity="0.6" />
        <Circle cx="27" cy="32" r="2" fill={color} opacity="0.4" />
        
        <Circle cx="70" cy="40" r="5" fill={color} opacity="0.6" />
        <Circle cx="72" cy="43" r="2.5" fill={color} opacity="0.4" />
        
        <Circle cx="30" cy="55" r="3.5" fill={color} opacity="0.5" />
        <Circle cx="68" cy="60" r="4" fill={color} opacity="0.5" />
        
        {/* Mikrop detayları - noktalı desen */}
        <Circle cx="25" cy="30" r="1" fill={strokeColor} />
        <Circle cx="70" cy="40" r="1" fill={strokeColor} />
        <Circle cx="30" cy="55" r="0.8" fill={strokeColor} />
        <Circle cx="68" cy="60" r="0.8" fill={strokeColor} />
        
        {/* Dalga çizgileri - temizlik hareketi */}
        <Path
          d="M20 70 Q30 68 40 70 Q50 72 60 70 Q70 68 80 70"
          fill="none"
          stroke={BramanColors.light}
          strokeWidth="1"
          strokeDasharray="3,2"
          opacity="0.6"
        />
      </G>
    </Svg>
  );
};

// Checking (Kontrol) - Tekrarlayan kontroller
export const CheckingIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color = BramanColors.cool,
  selected = false 
}) => {
  const strokeColor = selected ? BramanColors.dark : BramanColors.medium;
  const fillOpacity = selected ? 1 : 0.8;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G opacity={fillOpacity}>
        {/* Kapı ve kilit - el çizimi görünümü */}
        <Rect
          x="30" y="25" width="40" height="55"
          fill={color}
          opacity="0.3"
          stroke={strokeColor}
          strokeWidth="2"
          rx="2"
        />
        
        {/* Kapı kolu */}
        <Circle cx="60" cy="52" r="3" fill={strokeColor} />
        
        {/* Kilit */}
        <Rect x="44" y="48" width="12" height="10" fill={color} opacity="0.6" stroke={strokeColor} strokeWidth="1.5" rx="1" />
        <Path
          d="M47 48 Q47 44 50 44 Q53 44 53 48"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        
        {/* Kontrol işaretleri - tekrarlama hissi */}
        <Path d="M75 30 L78 33 L82 27" stroke={BramanColors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M75 40 L78 43 L82 37" stroke={BramanColors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        <Path d="M75 50 L78 53 L82 47" stroke={BramanColors.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        
        {/* Soru işaretleri - şüphe */}
        <SvgText x="20" y="45" fontSize="16" fill={BramanColors.light} fontWeight="300">?</SvgText>
        <SvgText x="15" y="60" fontSize="12" fill={BramanColors.light} fontWeight="300">?</SvgText>
      </G>
    </Svg>
  );
};

// Symmetry (Simetri/Düzen) - Mükemmeliyetçilik
export const SymmetryIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color = BramanColors.purple,
  selected = false 
}) => {
  const strokeColor = selected ? BramanColors.dark : BramanColors.medium;
  const fillOpacity = selected ? 1 : 0.8;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G opacity={fillOpacity}>
        {/* Sol taraf - düzenli */}
        <Rect x="20" y="25" width="15" height="15" fill={color} opacity="0.6" stroke={strokeColor} strokeWidth="1.5" />
        <Rect x="20" y="45" width="15" height="15" fill={color} opacity="0.6" stroke={strokeColor} strokeWidth="1.5" />
        <Rect x="20" y="65" width="15" height="15" fill={color} opacity="0.6" stroke={strokeColor} strokeWidth="1.5" />
        
        {/* Orta çizgi - simetri ekseni */}
        <Line 
          x1="50" y1="20" x2="50" y2="80" 
          stroke={strokeColor} 
          strokeWidth="1" 
          strokeDasharray="4,2" 
          opacity="0.5"
        />
        
        {/* Sağ taraf - organik düzensizlik */}
        <Path
          d="M65 25 Q68 23 72 26 Q75 30 73 35 Q70 38 65 37 Q62 34 63 29 Q64 25 65 25"
          fill={color}
          opacity="0.5"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        
        <Path
          d="M67 47 Q69 45 73 46 Q77 48 76 52 Q74 55 70 54 Q66 52 66 49 Q66 47 67 47"
          fill={color}
          opacity="0.4"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        
        <Path
          d="M64 67 Q66 65 70 66 Q74 68 73 72 Q71 75 67 74 Q63 72 63 69 Q63 67 64 67"
          fill={color}
          opacity="0.3"
          stroke={strokeColor}
          strokeWidth="1.5"
        />
        
        {/* Ok işareti - dengesizlik yönü */}
        <Path
          d="M55 50 L60 50 M58 48 L60 50 L58 52"
          stroke={BramanColors.warm}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
    </Svg>
  );
};

// Mental (Zihinsel) - Takıntılı düşünceler
export const MentalIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color = BramanColors.yellow,
  selected = false 
}) => {
  const strokeColor = selected ? BramanColors.dark : BramanColors.medium;
  const fillOpacity = selected ? 1 : 0.8;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G opacity={fillOpacity}>
        {/* Kafa silüeti - organik çizim */}
        <Path
          d="M35 50 Q35 30 50 28 Q65 30 65 50 Q65 65 60 70 Q55 72 50 72 Q45 72 40 70 Q35 65 35 50"
          fill={color}
          opacity="0.2"
          stroke={strokeColor}
          strokeWidth="2"
        />
        
        {/* Dönen düşünceler - spiral */}
        <Path
          d="M50 40 Q55 42 55 47 Q55 52 50 52 Q45 52 45 47 Q45 42 50 40 Q58 38 60 45 Q60 55 50 57 Q40 55 38 45 Q40 35 50 33"
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          opacity="0.6"
        />
        
        {/* Düşünce bulutları */}
        <Circle cx="25" cy="25" r="8" fill={BramanColors.light} opacity="0.4" />
        <Circle cx="75" cy="25" r="6" fill={BramanColors.light} opacity="0.3" />
        <Circle cx="70" cy="70" r="7" fill={BramanColors.light} opacity="0.35" />
        
        {/* Stres çizgileri */}
        <Line x1="30" y1="20" x2="28" y2="15" stroke={strokeColor} strokeWidth="1" opacity="0.5" />
        <Line x1="70" y1="20" x2="72" y2="15" stroke={strokeColor} strokeWidth="1" opacity="0.5" />
        <Line x1="25" y1="60" x2="20" y2="58" stroke={strokeColor} strokeWidth="1" opacity="0.5" />
        <Line x1="75" y1="60" x2="80" y2="58" stroke={strokeColor} strokeWidth="1" opacity="0.5" />
      </G>
    </Svg>
  );
};

// Hoarding (Biriktirme) - Atamama
export const HoardingIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color = BramanColors.warm,
  selected = false 
}) => {
  const strokeColor = selected ? BramanColors.dark : BramanColors.medium;
  const fillOpacity = selected ? 1 : 0.8;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G opacity={fillOpacity}>
        {/* Kutular - birikmiş eşyalar */}
        <Rect x="25" y="60" width="20" height="18" fill={color} opacity="0.6" stroke={strokeColor} strokeWidth="1.5" rx="2" />
        <Rect x="45" y="65" width="18" height="13" fill={color} opacity="0.5" stroke={strokeColor} strokeWidth="1.5" rx="2" />
        <Rect x="55" y="55" width="22" height="23" fill={color} opacity="0.7" stroke={strokeColor} strokeWidth="1.5" rx="2" />
        
        <Rect x="30" y="45" width="16" height="14" fill={color} opacity="0.4" stroke={strokeColor} strokeWidth="1.5" rx="2" />
        <Rect x="50" y="40" width="20" height="14" fill={color} opacity="0.5" stroke={strokeColor} strokeWidth="1.5" rx="2" />
        
        <Rect x="35" y="30" width="18" height="14" fill={color} opacity="0.3" stroke={strokeColor} strokeWidth="1.5" rx="2" />
        
        {/* Taşma çizgileri */}
        <Path
          d="M20 78 Q25 75 30 78 M70 78 Q75 75 80 78"
          fill="none"
          stroke={BramanColors.light}
          strokeWidth="1"
          strokeDasharray="2,2"
        />
        
        {/* Yıldızlar - değerli görülen şeyler */}
        <SvgText x="32" y="38" fontSize="10" fill={BramanColors.accent}>★</SvgText>
        <SvgText x="58" y="48" fontSize="8" fill={BramanColors.accent} opacity="0.7">★</SvgText>
        <SvgText x="68" y="63" fontSize="9" fill={BramanColors.accent} opacity="0.5">★</SvgText>
      </G>
    </Svg>
  );
};

// Other (Diğer) - Dini/ahlaki obsesyonlar
export const OtherIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color = BramanColors.secondary,
  selected = false 
}) => {
  const strokeColor = selected ? BramanColors.dark : BramanColors.medium;
  const fillOpacity = selected ? 1 : 0.8;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <G opacity={fillOpacity}>
        {/* Kalp - değerler/ahlak */}
        <Path
          d="M50 70 Q30 55 25 45 Q20 35 25 30 Q30 25 35 30 Q40 35 50 45 Q60 35 65 30 Q70 25 75 30 Q80 35 75 45 Q70 55 50 70"
          fill={color}
          opacity="0.3"
          stroke={strokeColor}
          strokeWidth="2"
        />
        
        {/* İç çatışma çizgileri */}
        <Line x1="45" y1="40" x2="55" y2="50" stroke={strokeColor} strokeWidth="1" opacity="0.5" />
        <Line x1="55" y1="40" x2="45" y2="50" stroke={strokeColor} strokeWidth="1" opacity="0.5" />
        
        {/* Yıldız ışınları - manevi/kutsal */}
        <G opacity="0.4">
          <Line x1="50" y1="20" x2="50" y2="25" stroke={BramanColors.accent} strokeWidth="1.5" strokeLinecap="round" />
          <Line x1="35" y1="25" x2="38" y2="28" stroke={BramanColors.accent} strokeWidth="1.5" strokeLinecap="round" />
          <Line x1="65" y1="25" x2="62" y2="28" stroke={BramanColors.accent} strokeWidth="1.5" strokeLinecap="round" />
          <Line x1="30" y1="35" x2="33" y2="37" stroke={BramanColors.accent} strokeWidth="1.5" strokeLinecap="round" />
          <Line x1="70" y1="35" x2="67" y2="37" stroke={BramanColors.accent} strokeWidth="1.5" strokeLinecap="round" />
        </G>
        
        {/* Noktalı daire - koruma/sınır */}
        <Circle 
          cx="50" cy="45" r="30" 
          fill="none" 
          stroke={BramanColors.light} 
          strokeWidth="1" 
          strokeDasharray="3,3" 
          opacity="0.5"
        />
      </G>
    </Svg>
  );
};

// Export all icons mapped to category IDs
export const ERPIllustrations: Record<string, React.FC<IllustrationProps>> = {
  'contamination': ContaminationIcon,
  'checking': CheckingIcon,
  'symmetry': SymmetryIcon,
  'mental': MentalIcon,
  'hoarding': HoardingIcon,
  'other': OtherIcon,
};

// Default icon for unknown categories
export const DefaultERPIcon: React.FC<IllustrationProps> = OtherIcon;
