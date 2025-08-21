/**
 * 🎨 CBT Bilişsel Çarpıtma İllüstrasyonları
 * Lindsay Braman tarzında el çizimi görsellerle CBT çarpıtmalarını açıklayan SVG componentleri
 */

import React from 'react';
import Svg, { Path, Circle, Line, G, Rect, Ellipse, Defs, Marker, Polygon, LinearGradient, Stop } from 'react-native-svg';

interface IllustrationProps {
  size?: number;
  color?: string;
  animated?: boolean;
}

// Lindsay Braman Renk Paleti
const BramanColors = {
  // Ana renkler - daha soft ve pastel
  primary: '#7C9885',      // Sage green
  secondary: '#E4B4B4',    // Dusty rose
  accent: '#94B49F',       // Mint green
  warm: '#F7C59F',         // Peach
  cool: '#B8C5D6',         // Soft blue
  purple: '#C8B6DB',       // Lavender
  
  // Nötr renkler
  dark: '#5A5A5A',         // Soft charcoal
  medium: '#8E8E8E',       // Medium gray
  light: '#D4D4D4',        // Light gray
  paper: '#FAF8F3',        // Warm paper
  
  // Vurgu renkleri
  coral: '#F4A09C',        // Soft coral
  teal: '#88B3B5',         // Muted teal
  yellow: '#F5D99C',       // Soft yellow
};

/**
 * 🌊 Aşırı Genelleme - Tek noktadan yayılan dalgalar
 * "Bir kere oldu, hep olur" düşüncesini temsil eder
 */
export const OvergeneralizationIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color 
}) => {
  const mainColor = color || BramanColors.teal;
  const accentColor = BramanColors.accent;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Arka plan soft daire */}
      <Circle cx="50" cy="50" r="48" fill={BramanColors.paper} opacity="0.3" />
      
      {/* Merkez nokta - tek olay */}
      <Circle cx="50" cy="50" r="5" fill={mainColor} />
      <Circle cx="50" cy="50" r="3" fill={BramanColors.dark} />
      
      {/* El çizimi tarzı dalgalar - organik */}
      <Path 
        d="M 50 35 Q 65 33, 68 48 T 50 65 T 32 48 Q 35 33, 50 35" 
        fill="none" 
        stroke={mainColor} 
        strokeWidth="2.5" 
        opacity="0.7"
        strokeLinecap="round"
      />
      
      <Path 
        d="M 50 25 Q 75 22, 78 50 T 50 75 T 22 50 Q 25 22, 50 25" 
        fill="none" 
        stroke={accentColor} 
        strokeWidth="2" 
        opacity="0.5"
        strokeLinecap="round"
        strokeDasharray="4,3"
      />
      
      <Path 
        d="M 50 15 Q 85 10, 88 50 T 50 85 T 12 50 Q 15 10, 50 15" 
        fill="none" 
        stroke={mainColor} 
        strokeWidth="1.5" 
        opacity="0.3"
        strokeLinecap="round"
        strokeDasharray="3,5"
      />
      
      {/* Küçük detaylar - noktalar */}
      <Circle cx="65" cy="40" r="1" fill={mainColor} opacity="0.6" />
      <Circle cx="35" cy="40" r="1" fill={mainColor} opacity="0.6" />
      <Circle cx="65" cy="60" r="1" fill={mainColor} opacity="0.6" />
      <Circle cx="35" cy="60" r="1" fill={mainColor} opacity="0.6" />
    </Svg>
  );
};

/**
 * 🔮 Zihin Okuma - Kristal küre ile düşünce baloncukları
 * Başkalarının ne düşündüğünü bildiğini sanma
 */
export const MindReadingIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color 
}) => {
  const mainColor = color || BramanColors.purple;
  const accentColor = BramanColors.cool;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Arka plan */}
      <Circle cx="50" cy="50" r="48" fill={BramanColors.paper} opacity="0.3" />
      
      {/* Kristal küre - el çizimi stili */}
      <Ellipse cx="50" cy="52" rx="28" ry="30" fill={accentColor} opacity="0.15" />
      <Path 
        d="M 22 52 Q 22 25, 50 22 T 78 52 Q 78 77, 50 78 T 22 52" 
        fill="none" 
        stroke={mainColor} 
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      
      {/* Küre içi parıltı - watercolor efekti */}
      <Path 
        d="M 30 38 Q 45 28, 60 35 Q 55 40, 45 38 Q 35 36, 30 38" 
        fill={BramanColors.light} 
        opacity="0.4"
      />
      
      {/* Gizemli beyinler/düşünceler */}
      <G opacity="0.7">
        {/* Sol beyin */}
        <Path 
          d="M 35 45 Q 33 42, 36 40 Q 38 39, 40 41 Q 41 43, 39 45 Q 37 46, 35 45" 
          fill={BramanColors.secondary}
          stroke={mainColor}
          strokeWidth="1"
        />
        
        {/* Sağ beyin */}
        <Path 
          d="M 60 45 Q 58 42, 61 40 Q 63 39, 65 41 Q 66 43, 64 45 Q 62 46, 60 45" 
          fill={BramanColors.secondary}
          stroke={mainColor}
          strokeWidth="1"
        />
        
        {/* Merkez beyin */}
        <Path 
          d="M 47 52 Q 45 49, 48 47 Q 50 46, 52 47 Q 55 49, 53 52 Q 51 54, 50 54 Q 48 54, 47 52" 
          fill={BramanColors.warm}
          stroke={mainColor}
          strokeWidth="1"
        />
      </G>
      
      {/* Soru işaretleri - el çizimi */}
      <G opacity="0.6">
        <Path 
          d="M 42 60 Q 42 63, 42 64 M 42 66 L 42 67" 
          fill="none" 
          stroke={BramanColors.dark} 
          strokeWidth="2" 
          strokeLinecap="round"
        />
        <Path 
          d="M 58 60 Q 58 63, 58 64 M 58 66 L 58 67" 
          fill="none" 
          stroke={BramanColors.dark} 
          strokeWidth="2" 
          strokeLinecap="round"
        />
      </G>
      
      {/* Dekoratif yıldızlar */}
      <Path d="M 25 30 L 26 32 L 28 31 L 26 33 L 27 35 L 25 33 L 23 35 L 24 33 L 22 31 L 24 32 Z" 
            fill={BramanColors.yellow} opacity="0.5" />
      <Path d="M 72 28 L 73 30 L 75 29 L 73 31 L 74 33 L 72 31 L 70 33 L 71 31 L 69 29 L 71 30 Z" 
            fill={BramanColors.yellow} opacity="0.5" />
    </Svg>
  );
};

/**
 * 🎯 Felaketleştirme - Düşen domino taşları
 * En kötü senaryoyu bekleme, küçük olayları felaket gibi görme
 */
export const CatastrophizingIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color 
}) => {
  const mainColor = color || BramanColors.coral;
  const accentColor = BramanColors.warm;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Arka plan */}
      <Circle cx="50" cy="50" r="48" fill={BramanColors.paper} opacity="0.3" />
      
      {/* Zemin çizgisi - el çizimi */}
      <Path 
        d="M 10 70 Q 30 68, 50 70 T 90 70" 
        stroke={BramanColors.medium} 
        strokeWidth="1.5" 
        opacity="0.5"
        strokeLinecap="round"
      />
      
      {/* Düşmüş domino taşları - organik formlar */}
      <G opacity="0.6">
        <Path 
          d="M 18 65 L 15 58 L 22 55 L 25 62 Z" 
          fill={accentColor}
          stroke={mainColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path 
          d="M 28 63 L 26 56 L 33 54 L 35 61 Z" 
          fill={accentColor}
          stroke={mainColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </G>
      
      {/* Düşmekte olan domino - vurgulu */}
      <Path 
        d="M 42 52 L 41 40 L 48 39 L 49 51 Z" 
        fill={mainColor}
        stroke={BramanColors.dark}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="rotate(-20 45 45)"
      />
      
      {/* Ayakta duran dominolar - el çizimi stili */}
      <G>
        <Path 
          d="M 56 38 Q 56 35, 57 35 L 62 35 Q 63 35, 63 38 L 63 68 Q 63 70, 62 70 L 57 70 Q 56 70, 56 68 Z" 
          fill={BramanColors.cool}
          stroke={mainColor}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <Path 
          d="M 68 36 Q 68 34, 69 34 L 73 34 Q 74 34, 74 36 L 74 68 Q 74 70, 73 70 L 69 70 Q 68 70, 68 68 Z" 
          fill={BramanColors.accent}
          stroke={mainColor}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <Path 
          d="M 79 35 Q 79 33, 80 33 L 84 33 Q 85 33, 85 35 L 85 68 Q 85 70, 84 70 L 80 70 Q 79 70, 79 68 Z" 
          fill={BramanColors.primary}
          stroke={mainColor}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </G>
      
      {/* Hareket çizgileri - dinamik efekt */}
      <G opacity="0.5">
        <Path d="M 38 42 L 35 40" stroke={mainColor} strokeWidth="2" strokeLinecap="round" />
        <Path d="M 38 47 L 35 45" stroke={mainColor} strokeWidth="2" strokeLinecap="round" />
        <Path d="M 38 52 L 35 50" stroke={mainColor} strokeWidth="2" strokeLinecap="round" />
      </G>
      
      {/* Dekoratif elementler */}
      <Circle cx="45" cy="25" r="1.5" fill={BramanColors.yellow} opacity="0.6" />
      <Circle cx="50" cy="22" r="1" fill={BramanColors.yellow} opacity="0.5" />
    </Svg>
  );
};

/**
 * ⚖️ Siyah-Beyaz Düşünce - İki kutuplu terazi
 * Ya hep ya hiç, ortası yok düşüncesi
 */
export const BlackWhiteIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color 
}) => {
  const mainColor = color || BramanColors.dark;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Arka plan */}
      <Circle cx="50" cy="50" r="48" fill={BramanColors.paper} opacity="0.3" />
      
      {/* Terazi direği - el çizimi */}
      <Path 
        d="M 50 70 Q 49 50, 50 30" 
        stroke={BramanColors.medium} 
        strokeWidth="2.5" 
        strokeLinecap="round"
      />
      
      {/* Terazi kolu - eğik ve organik */}
      <Path 
        d="M 22 38 Q 50 32, 78 38" 
        stroke={BramanColors.medium} 
        strokeWidth="2.5" 
        strokeLinecap="round"
      />
      
      {/* Sol kefe - siyah/ağır */}
      <G>
        <Path 
          d="M 18 38 Q 18 36, 19 36 L 31 36 Q 32 36, 32 38 L 30 48 Q 29 50, 27 50 L 23 50 Q 21 50, 20 48 Z" 
          fill={BramanColors.dark}
          stroke={mainColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Ağırlık */}
        <Circle cx="25" cy="43" r="3" fill="white" opacity="0.3" />
      </G>
      
      {/* Sağ kefe - beyaz/hafif (yukarıda) */}
      <G transform="translate(0,-5)">
        <Path 
          d="M 68 36 Q 68 34, 69 34 L 81 34 Q 82 34, 82 36 L 80 44 Q 79 46, 77 46 L 73 46 Q 71 46, 70 44 Z" 
          fill="white"
          stroke={mainColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Boşluk */}
        <Circle cx="75" cy="40" r="3" fill={BramanColors.light} opacity="0.5" />
      </G>
      
      {/* Ortada yok - gri alan */}
      <G opacity="0.6">
        <Ellipse cx="50" cy="55" rx="12" ry="10" 
                 fill="none" 
                 stroke={BramanColors.medium} 
                 strokeWidth="1.5" 
                 strokeDasharray="3,3" />
        <Path d="M 44 50 L 56 60" stroke={BramanColors.coral} strokeWidth="2" strokeLinecap="round" />
        <Path d="M 56 50 L 44 60" stroke={BramanColors.coral} strokeWidth="2" strokeLinecap="round" />
      </G>
      
      {/* Etiketler */}
      <G opacity="0.7">
        <Path 
          d="M 25 58 L 25 62 M 23 60 L 27 60" 
          stroke={BramanColors.dark} 
          strokeWidth="1.5" 
          strokeLinecap="round"
        />
        <Path 
          d="M 75 58 L 75 62 M 73 60 L 77 60" 
          stroke={BramanColors.dark} 
          strokeWidth="1.5" 
          strokeLinecap="round"
        />
      </G>
      
      {/* Dekoratif noktalar */}
      <Circle cx="15" cy="25" r="1" fill={BramanColors.accent} opacity="0.4" />
      <Circle cx="85" cy="25" r="1" fill={BramanColors.accent} opacity="0.4" />
    </Svg>
  );
};

/**
 * 🎯 Kişiselleştirme - Hedef tahtası ortasında insan
 * Her şeyi kendine yorma, suçu üstlenme
 */
export const PersonalizationIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color 
}) => {
  const mainColor = color || BramanColors.secondary;
  const accentColor = BramanColors.warm;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Arka plan */}
      <Circle cx="50" cy="50" r="48" fill={BramanColors.paper} opacity="0.3" />
      
      {/* Hedef halkaları - el çizimi stili */}
      <Path 
        d="M 50 10 Q 85 10, 90 50 T 50 90 Q 15 90, 10 50 T 50 10" 
        fill="none" 
        stroke={BramanColors.light} 
        strokeWidth="2" 
        opacity="0.3"
        strokeLinecap="round"
      />
      <Path 
        d="M 50 20 Q 75 20, 80 50 T 50 80 Q 25 80, 20 50 T 50 20" 
        fill="none" 
        stroke={accentColor} 
        strokeWidth="2" 
        opacity="0.4"
        strokeLinecap="round"
      />
      <Path 
        d="M 50 30 Q 65 30, 70 50 T 50 70 Q 35 70, 30 50 T 50 30" 
        fill="none" 
        stroke={mainColor} 
        strokeWidth="2" 
        opacity="0.5"
        strokeLinecap="round"
      />
      
      {/* Merkezdeki insan figürü - daha organik */}
      <G>
        {/* Kafa */}
        <Circle cx="50" cy="38" r="5" fill={mainColor} />
        <Circle cx="48" cy="37" r="0.8" fill={BramanColors.dark} />
        <Circle cx="52" cy="37" r="0.8" fill={BramanColors.dark} />
        <Path d="M 48 40 Q 50 41, 52 40" stroke={BramanColors.dark} strokeWidth="1" fill="none" strokeLinecap="round" />
        
        {/* Gövde */}
        <Path 
          d="M 50 43 Q 49 48, 50 54" 
          stroke={mainColor} 
          strokeWidth="3" 
          strokeLinecap="round"
        />
        
        {/* Kollar */}
        <Path 
          d="M 50 46 Q 45 48, 43 52" 
          stroke={mainColor} 
          strokeWidth="2.5" 
          strokeLinecap="round"
        />
        <Path 
          d="M 50 46 Q 55 48, 57 52" 
          stroke={mainColor} 
          strokeWidth="2.5" 
          strokeLinecap="round"
        />
        
        {/* Bacaklar */}
        <Path 
          d="M 50 54 Q 47 58, 45 62" 
          stroke={mainColor} 
          strokeWidth="2.5" 
          strokeLinecap="round"
        />
        <Path 
          d="M 50 54 Q 53 58, 55 62" 
          stroke={mainColor} 
          strokeWidth="2.5" 
          strokeLinecap="round"
        />
      </G>
      
      {/* Oklar merkeze doğru - organik */}
      <G opacity="0.6">
        <Path 
          d="M 20 25 Q 30 30, 38 38 L 35 36 M 38 38 L 35 40" 
          stroke={BramanColors.coral} 
          strokeWidth="2" 
          fill="none"
          strokeLinecap="round"
        />
        <Path 
          d="M 80 25 Q 70 30, 62 38 L 65 36 M 62 38 L 65 40" 
          stroke={BramanColors.coral} 
          strokeWidth="2" 
          fill="none"
          strokeLinecap="round"
        />
        <Path 
          d="M 20 75 Q 30 70, 38 62 L 35 64 M 38 62 L 35 60" 
          stroke={BramanColors.coral} 
          strokeWidth="2" 
          fill="none"
          strokeLinecap="round"
        />
        <Path 
          d="M 80 75 Q 70 70, 62 62 L 65 64 M 62 62 L 65 60" 
          stroke={BramanColors.coral} 
          strokeWidth="2" 
          fill="none"
          strokeLinecap="round"
        />
      </G>
      
      {/* Dekoratif elementler */}
      <Circle cx="25" cy="50" r="1.5" fill={BramanColors.yellow} opacity="0.5" />
      <Circle cx="75" cy="50" r="1.5" fill={BramanColors.yellow} opacity="0.5" />
    </Svg>
  );
};

/**
 * 🏷️ Etiketleme - İsim etiketi
 * İnsanları veya durumları tek bir etiketle tanımlama
 */
export const LabelingIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color 
}) => {
  const mainColor = color || BramanColors.primary;
  const accentColor = BramanColors.yellow;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Arka plan */}
      <Circle cx="50" cy="50" r="48" fill={BramanColors.paper} opacity="0.3" />
      
      {/* Ana etiket - el çizimi */}
      <Path 
        d="M 22 42 Q 22 38, 26 38 L 62 38 Q 66 38, 68 40 L 76 48 Q 78 50, 76 52 L 68 60 Q 66 62, 62 62 L 26 62 Q 22 62, 22 58 Z" 
        fill={accentColor}
        opacity="0.3"
        stroke={mainColor} 
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Etiket deliği - organik */}
      <Ellipse cx="32" cy="50" rx="4" ry="3.5" 
               fill="white" 
               stroke={mainColor} 
               strokeWidth="2" />
      
      {/* Etiket metni çizgileri - el yazısı hissi */}
      <Path 
        d="M 42 45 Q 52 44, 62 45" 
        stroke={BramanColors.dark} 
        strokeWidth="2" 
        opacity="0.7"
        strokeLinecap="round"
      />
      <Path 
        d="M 42 50 Q 48 49, 54 50" 
        stroke={BramanColors.medium} 
        strokeWidth="1.5" 
        opacity="0.5"
        strokeLinecap="round"
      />
      <Path 
        d="M 42 55 Q 50 54, 58 55" 
        stroke={BramanColors.medium} 
        strokeWidth="1.5" 
        opacity="0.5"
        strokeLinecap="round"
      />
      
      {/* Ek etiketler - çoklu etiketleme */}
      <G opacity="0.5">
        <Path 
          d="M 30 25 L 50 25 L 55 30 L 50 35 L 30 35 Z" 
          fill={BramanColors.cool}
          opacity="0.3"
          stroke={BramanColors.medium} 
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <Circle cx="35" cy="30" r="2" fill="white" stroke={BramanColors.medium} strokeWidth="1" />
      </G>
      
      <G opacity="0.4">
        <Path 
          d="M 35 70 L 55 70 L 60 75 L 55 80 L 35 80 Z" 
          fill={BramanColors.secondary}
          opacity="0.3"
          stroke={BramanColors.medium} 
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <Circle cx="40" cy="75" r="2" fill="white" stroke={BramanColors.medium} strokeWidth="1" />
      </G>
      
      {/* Dekoratif ip */}
      <Path 
        d="M 32 50 Q 20 45, 15 40" 
        stroke={BramanColors.medium} 
        strokeWidth="1.5" 
        opacity="0.4"
        strokeLinecap="round"
        strokeDasharray="2,3"
      />
    </Svg>
  );
};

/**
 * 🔍 Zihinsel Filtre - Sadece olumsuzları gören filtre
 * Olumluları görmezden gelip olumsuzlara odaklanma
 */
export const MentalFilterIcon: React.FC<IllustrationProps> = ({ 
  size = 80, 
  color 
}) => {
  const mainColor = color || BramanColors.teal;
  const positiveColor = BramanColors.accent;
  const negativeColor = BramanColors.coral;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Arka plan */}
      <Circle cx="50" cy="50" r="48" fill={BramanColors.paper} opacity="0.3" />
      
      {/* Filtre hunisi - el çizimi */}
      <Path 
        d="M 18 24 Q 18 22, 20 22 L 80 22 Q 82 22, 82 24 L 82 26 Q 82 28, 80 30 L 62 48 Q 60 50, 60 52 L 60 68 Q 60 70, 58 71 L 42 71 Q 40 70, 40 68 L 40 52 Q 40 50, 38 48 L 20 30 Q 18 28, 18 26 Z" 
        fill={BramanColors.light}
        opacity="0.2"
        stroke={mainColor} 
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Pozitif elementler (üst - filtrelenen) */}
      <G opacity="0.3">
        {/* Gülen yüz */}
        <Circle cx="28" cy="15" r="4" fill={positiveColor} stroke={positiveColor} strokeWidth="1" />
        <Circle cx="26" cy="14" r="0.5" fill={BramanColors.dark} />
        <Circle cx="30" cy="14" r="0.5" fill={BramanColors.dark} />
        <Path d="M 26 16 Q 28 17, 30 16" stroke={BramanColors.dark} strokeWidth="0.8" fill="none" />
        
        {/* Kalp */}
        <Path 
          d="M 48 12 Q 46 10, 44 11 T 42 14 Q 42 16, 44 18 L 48 22 L 52 18 Q 54 16, 54 14 T 52 11 Q 50 10, 48 12" 
          fill={positiveColor}
          stroke={positiveColor}
          strokeWidth="1"
        />
        
        {/* Yıldız */}
        <Path 
          d="M 70 15 L 72 19 L 76 17 L 72 21 L 74 25 L 70 21 L 66 25 L 68 21 L 64 17 L 68 19 Z" 
          fill={positiveColor}
          stroke={positiveColor}
          strokeWidth="1"
        />
      </G>
      
      {/* Filtre içi - geçiş */}
      <Path 
        d="M 35 35 Q 50 40, 65 35" 
        stroke={BramanColors.medium} 
        strokeWidth="1" 
        opacity="0.3"
        strokeDasharray="2,2"
      />
      
      {/* Negatif elementler (alt - geçen) */}
      <G opacity="0.9">
        {/* Üzgün yüz */}
        <Circle cx="50" cy="42" r="4" fill={negativeColor} />
        <Circle cx="48" cy="41" r="0.5" fill={BramanColors.dark} />
        <Circle cx="52" cy="41" r="0.5" fill={BramanColors.dark} />
        <Path d="M 48 44 Q 50 43, 52 44" stroke={BramanColors.dark} strokeWidth="0.8" fill="none" />
        
        {/* X işareti */}
        <G transform="translate(50, 56)">
          <Path d="M -3 -3 L 3 3" stroke={negativeColor} strokeWidth="2.5" strokeLinecap="round" />
          <Path d="M 3 -3 L -3 3" stroke={negativeColor} strokeWidth="2.5" strokeLinecap="round" />
        </G>
        
        {/* Ünlem */}
        <Path 
          d="M 50 72 L 50 78 M 50 81 L 50 82" 
          stroke={negativeColor} 
          strokeWidth="3" 
          strokeLinecap="round"
        />
      </G>
      
      {/* Dekoratif damlalar */}
      <Circle cx="45" cy="85" r="1.5" fill={negativeColor} opacity="0.6" />
      <Circle cx="50" cy="88" r="1" fill={negativeColor} opacity="0.5" />
      <Circle cx="55" cy="85" r="1.5" fill={negativeColor} opacity="0.6" />
    </Svg>
  );
};

// Tüm ikonları export eden helper
export const CBTIllustrations = {
  overgeneralization: OvergeneralizationIcon,
  mindReading: MindReadingIcon,
  catastrophizing: CatastrophizingIcon,
  blackWhite: BlackWhiteIcon,
  personalization: PersonalizationIcon,
  labeling: LabelingIcon,
  mentalFilter: MentalFilterIcon
};

// Çarpıtma bilgileri
export const distortionInfo = {
  overgeneralization: {
    title: 'Aşırı Genelleme',
    description: 'Bir olayı tüm hayatına yayma',
    example: 'Bir kere başarısız oldum, her zaman başarısız olurum'
  },
  mindReading: {
    title: 'Zihin Okuma',
    description: 'Başkalarının düşüncelerini bildiğini sanma',
    example: 'Herkes beni yetersiz buluyor'
  },
  catastrophizing: {
    title: 'Felaketleştirme',
    description: 'En kötü senaryoyu bekleme',
    example: 'Bu hata yüzünden hayatım mahvoldu'
  },
  blackWhite: {
    title: 'Siyah-Beyaz Düşünce',
    description: 'Her şeyi uç noktalarda görme',
    example: 'Ya mükemmelim ya da başarısızım'
  },
  personalization: {
    title: 'Kişiselleştirme',
    description: 'Her şeyi kendine yorma',
    example: 'Arkadaşım mutsuzsa, ben kötü bir dostum'
  },
  labeling: {
    title: 'Etiketleme',
    description: 'Kendini veya başkalarını tek kelimeyle tanımlama',
    example: 'Ben bir ezik/başarısızım'
  },
  mentalFilter: {
    title: 'Zihinsel Filtre',
    description: 'Sadece olumsuzlara odaklanma',
    example: 'Bir eleştiri aldım, gün mahvoldu'
  }
};
