/**
 * 🎨 Onboarding Lindsay Braman Style Illustrations
 * 
 * Anayasa v2.0 ilkelerine uygun, samimi ve empatik onboarding görselleri.
 * Yumuşak pastel renkler, el çizimi hissi veren organik formlar.
 */

import React from 'react';
import Svg, { 
  Path, 
  Circle, 
  Rect, 
  Line, 
  G, 
  Ellipse, 
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop
} from 'react-native-svg';
import { View } from 'react-native';

// Lindsay Braman Renk Paleti
export const BramanColors = {
  // Pastel tonlar
  softPink: '#FFE5EC',
  peach: '#FFD4C2',
  lavender: '#E6E6FA',
  mint: '#D5F4E6',
  skyBlue: '#D2E8F5',
  warmYellow: '#FFF3C4',
  
  // Accent renkler
  coral: '#FF8A95',
  sage: '#8FBC8F',
  dustyPurple: '#9B8AA8',
  terracotta: '#D68A59',
  teal: '#6BB6B8',
  
  // Nötr tonlar
  charcoal: '#4A4A4A',
  warmGray: '#8B8680',
  cream: '#FFF8F3',
  
  // Primary (OKB farkındalık renkleri)
  primaryGreen: '#10B981',
  primaryTeal: '#14B8A6',
};

interface IllustrationProps {
  width?: number;
  height?: number;
  color?: string;
  selected?: boolean;
}

/**
 * 🌸 Hoşgeldin Görseli - Sıcak, samimi karşılama
 */
export const WelcomeIllustration: React.FC<IllustrationProps> = ({ 
  width = 200, 
  height = 200 
}) => (
  <Svg width={width} height={height} viewBox="0 0 200 200">
    {/* Gradient tanımları */}
    <Defs>
      <LinearGradient id="welcomeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={BramanColors.mint} stopOpacity="0.8" />
        <Stop offset="100%" stopColor={BramanColors.skyBlue} stopOpacity="0.6" />
      </LinearGradient>
    </Defs>
    
    {/* Arka plan daire */}
    <Circle 
      cx="100" 
      cy="100" 
      r="90" 
      fill="url(#welcomeGrad)"
      opacity="0.4"
    />
    
    {/* İnsan figürü - basit, samimi */}
    <G transform="translate(100, 100)">
      {/* Baş */}
      <Circle cx="0" cy="-20" r="25" fill={BramanColors.peach} />
      
      {/* Yüz detayları */}
      <Circle cx="-8" cy="-25" r="3" fill={BramanColors.charcoal} />
      <Circle cx="8" cy="-25" r="3" fill={BramanColors.charcoal} />
      
      {/* Gülümseme */}
      <Path
        d="M -10,-15 Q 0,-10 10,-15"
        stroke={BramanColors.charcoal}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Vücut - organik form */}
      <Path
        d="M -20,5 Q -15,0 0,0 Q 15,0 20,5 L 15,40 Q 10,45 0,45 Q -10,45 -15,40 Z"
        fill={BramanColors.lavender}
        strokeWidth="2"
        stroke={BramanColors.dustyPurple}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Kollar - açık, karşılayıcı */}
      <Path
        d="M -20,10 Q -40,15 -45,25"
        stroke={BramanColors.peach}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <Path
        d="M 20,10 Q 40,15 45,25"
        stroke={BramanColors.peach}
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Kalp sembolü */}
      <Path
        d="M 0,15 C -5,10 -15,10 -15,20 C -15,30 0,35 0,35 C 0,35 15,30 15,20 C 15,10 5,10 0,15 Z"
        fill={BramanColors.coral}
        opacity="0.8"
      />
    </G>
    
    {/* Dekoratif elementler */}
    <Circle cx="30" cy="30" r="5" fill={BramanColors.warmYellow} opacity="0.6" />
    <Circle cx="170" cy="40" r="4" fill={BramanColors.mint} opacity="0.7" />
    <Circle cx="160" cy="160" r="6" fill={BramanColors.coral} opacity="0.5" />
    <Circle cx="40" cy="170" r="3" fill={BramanColors.teal} opacity="0.6" />
  </Svg>
);

/**
 * 🤝 Onay/Gizlilik Görseli - Güven ve şeffaflık
 */
export const ConsentIllustration: React.FC<IllustrationProps> = ({ 
  width = 200, 
  height = 200 
}) => (
  <Svg width={width} height={height} viewBox="0 0 200 200">
    {/* El sıkışma */}
    <G transform="translate(100, 100)">
      {/* Sol el */}
      <Path
        d="M -40,0 Q -35,-5 -30,-5 L -10,-5 Q -5,-5 0,0 L 0,20 Q -5,25 -10,25 L -30,25 Q -35,25 -40,20 Z"
        fill={BramanColors.peach}
        stroke={BramanColors.terracotta}
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Sağ el */}
      <Path
        d="M 40,0 Q 35,-5 30,-5 L 10,-5 Q 5,-5 0,0 L 0,20 Q 5,25 10,25 L 30,25 Q 35,25 40,20 Z"
        fill={BramanColors.softPink}
        stroke={BramanColors.coral}
        strokeWidth="2"
        strokeLinecap="round"
      />
      
      {/* Kalkan sembolü - güvenlik */}
      <Path
        d="M 0,-50 L -20,-40 Q -20,-20 0,0 Q 20,-20 20,-40 Z"
        fill={BramanColors.mint}
        stroke={BramanColors.teal}
        strokeWidth="2"
        opacity="0.8"
      />
      
      {/* Onay işareti */}
      <Path
        d="M -8,-35 L -3,-30 L 8,-40"
        stroke={BramanColors.primaryGreen}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </G>
    
    {/* Etrafındaki güven halkaları */}
    <Circle cx="100" cy="100" r="70" stroke={BramanColors.skyBlue} strokeWidth="2" fill="none" opacity="0.4" strokeDasharray="5,5" />
    <Circle cx="100" cy="100" r="85" stroke={BramanColors.lavender} strokeWidth="1" fill="none" opacity="0.3" strokeDasharray="3,7" />
  </Svg>
);

/**
 * 📊 Y-BOCS Değerlendirme Görseli - Anlayış ve destek
 */
export const AssessmentIllustration: React.FC<IllustrationProps> = ({ 
  width = 200, 
  height = 200 
}) => (
  <Svg width={width} height={height} viewBox="0 0 200 200">
    {/* Clipboard arka plan */}
    <Rect x="50" y="30" width="100" height="140" rx="10" fill={BramanColors.cream} stroke={BramanColors.warmGray} strokeWidth="2" />
    
    {/* Clipboard klipsi */}
    <Rect x="85" y="25" width="30" height="15" rx="3" fill={BramanColors.warmGray} />
    
    {/* Sorular - çizgiler */}
    <G transform="translate(70, 60)">
      {/* Soru 1 - işaretli */}
      <Circle cx="0" cy="0" r="4" fill={BramanColors.primaryGreen} />
      <Line x1="10" y1="0" x2="50" y2="0" stroke={BramanColors.warmGray} strokeWidth="2" strokeLinecap="round" />
      
      {/* Soru 2 - işaretli */}
      <Circle cx="0" cy="20" r="4" fill={BramanColors.primaryGreen} />
      <Line x1="10" y1="20" x2="45" y2="20" stroke={BramanColors.warmGray} strokeWidth="2" strokeLinecap="round" />
      
      {/* Soru 3 - boş */}
      <Circle cx="0" cy="40" r="4" fill="none" stroke={BramanColors.warmGray} strokeWidth="2" />
      <Line x1="10" y1="40" x2="55" y2="40" stroke={BramanColors.warmGray} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      
      {/* Soru 4 - boş */}
      <Circle cx="0" cy="60" r="4" fill="none" stroke={BramanColors.warmGray} strokeWidth="2" />
      <Line x1="10" y1="60" x2="48" y2="60" stroke={BramanColors.warmGray} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </G>
    
    {/* Destek eli */}
    <Path
      d="M 140,120 Q 145,115 150,115 L 160,115 Q 165,115 165,120 L 165,135 Q 165,140 160,140 L 150,140 Q 145,140 140,135 Z"
      fill={BramanColors.peach}
      stroke={BramanColors.terracotta}
      strokeWidth="2"
      strokeLinecap="round"
      transform="rotate(-20 150 130)"
    />
    
    {/* Kalp - empati */}
    <Path
      d="M 35,140 C 30,135 20,135 20,145 C 20,155 35,165 35,165 C 35,165 50,155 50,145 C 50,135 40,135 35,140 Z"
      fill={BramanColors.coral}
      opacity="0.7"
    />
  </Svg>
);

/**
 * 👤 Profil Oluşturma Görseli - Kişiselleştirme
 */
export const ProfileIllustration: React.FC<IllustrationProps> = ({ 
  width = 200, 
  height = 200 
}) => (
  <Svg width={width} height={height} viewBox="0 0 200 200">
    {/* Profil çerçevesi */}
    <Rect x="60" y="40" width="80" height="90" rx="40" fill={BramanColors.lavender} opacity="0.3" />
    
    {/* Profil silüeti */}
    <G transform="translate(100, 85)">
      {/* Baş */}
      <Circle cx="0" cy="0" r="22" fill={BramanColors.peach} />
      
      {/* Yüz detayları - minimalist */}
      <Circle cx="-7" cy="-3" r="2" fill={BramanColors.charcoal} />
      <Circle cx="7" cy="-3" r="2" fill={BramanColors.charcoal} />
      <Path
        d="M -7,5 Q 0,8 7,5"
        stroke={BramanColors.charcoal}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Omuzlar */}
      <Path
        d="M -25,25 Q -20,20 0,20 Q 20,20 25,25 L 25,40 L -25,40 Z"
        fill={BramanColors.mint}
        stroke={BramanColors.sage}
        strokeWidth="2"
      />
    </G>
    
    {/* Özellikler - yıldızlar */}
    <G>
      {/* Sol üst */}
      <Path
        d="M 40,60 L 42,55 L 47,55 L 43,52 L 45,47 L 40,50 L 35,47 L 37,52 L 33,55 L 38,55 Z"
        fill={BramanColors.warmYellow}
        opacity="0.8"
      />
      
      {/* Sağ üst */}
      <Path
        d="M 160,60 L 162,55 L 167,55 L 163,52 L 165,47 L 160,50 L 155,47 L 157,52 L 153,55 L 158,55 Z"
        fill={BramanColors.coral}
        opacity="0.8"
      />
      
      {/* Alt */}
      <Path
        d="M 100,150 L 102,145 L 107,145 L 103,142 L 105,137 L 100,140 L 95,137 L 97,142 L 93,145 L 98,145 Z"
        fill={BramanColors.teal}
        opacity="0.8"
      />
    </G>
  </Svg>
);

/**
 * 🎯 Hedefler Görseli - Umut ve motivasyon
 */
export const GoalsIllustration: React.FC<IllustrationProps> = ({ 
  width = 200, 
  height = 200 
}) => (
  <Svg width={width} height={height} viewBox="0 0 200 200">
    {/* Hedef tahtası */}
    <Circle cx="100" cy="100" r="70" fill={BramanColors.warmYellow} opacity="0.2" />
    <Circle cx="100" cy="100" r="50" fill={BramanColors.peach} opacity="0.3" />
    <Circle cx="100" cy="100" r="30" fill={BramanColors.coral} opacity="0.4" />
    <Circle cx="100" cy="100" r="10" fill={BramanColors.primaryGreen} />
    
    {/* Ok */}
    <G transform="rotate(-30 100 100)">
      <Line x1="40" y1="100" x2="90" y2="100" stroke={BramanColors.charcoal} strokeWidth="3" strokeLinecap="round" />
      {/* Ok başı */}
      <Path
        d="M 85,100 L 78,95 M 85,100 L 78,105"
        stroke={BramanColors.charcoal}
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />
      {/* Ok tüyü */}
      <Path
        d="M 40,100 L 35,95 M 40,100 L 35,105"
        stroke={BramanColors.coral}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </G>
    
    {/* Başarı yıldızları */}
    <Circle cx="150" cy="50" r="3" fill={BramanColors.warmYellow} />
    <Circle cx="160" cy="150" r="4" fill={BramanColors.mint} />
    <Circle cx="50" cy="160" r="3" fill={BramanColors.teal} />
    <Circle cx="40" cy="60" r="2" fill={BramanColors.lavender} />
  </Svg>
);

/**
 * 📋 Tedavi Planı Görseli - Yapılandırılmış destek
 */
export const TreatmentPlanIllustration: React.FC<IllustrationProps> = ({ 
  width = 200, 
  height = 200 
}) => (
  <Svg width={width} height={height} viewBox="0 0 200 200">
    {/* Yol haritası */}
    <Path
      d="M 40,160 Q 60,140 80,120 T 120,100 T 160,60"
      stroke={BramanColors.primaryGreen}
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      strokeDasharray="5,3"
    />
    
    {/* Duraklar */}
    <G>
      {/* Başlangıç */}
      <Circle cx="40" cy="160" r="8" fill={BramanColors.mint} stroke={BramanColors.teal} strokeWidth="2" />
      
      {/* Ara durak 1 */}
      <Circle cx="80" cy="120" r="6" fill={BramanColors.lavender} stroke={BramanColors.dustyPurple} strokeWidth="2" />
      
      {/* Ara durak 2 */}
      <Circle cx="120" cy="100" r="6" fill={BramanColors.peach} stroke={BramanColors.terracotta} strokeWidth="2" />
      
      {/* Hedef */}
      <G transform="translate(160, 60)">
        <Path
          d="M 0,-10 L 3,-3 L 10,-2 L 5,3 L 3,10 L 0,4 L -3,10 L -5,3 L -10,-2 L -3,-3 Z"
          fill={BramanColors.warmYellow}
          stroke={BramanColors.coral}
          strokeWidth="2"
        />
      </G>
    </G>
    
    {/* Destek simgeleri */}
    <G transform="translate(60, 80)">
      {/* Kalp - duygusal destek */}
      <Path
        d="M 0,5 C -3,2 -8,2 -8,7 C -8,12 0,17 0,17 C 0,17 8,12 8,7 C 8,2 3,2 0,5 Z"
        fill={BramanColors.coral}
        opacity="0.6"
      />
    </G>
    
    <G transform="translate(140, 120)">
      {/* Yaprak - büyüme */}
      <Path
        d="M 0,0 Q -5,5 -5,10 Q -5,15 0,15 Q 5,15 5,10 Q 5,5 0,0"
        fill={BramanColors.sage}
        opacity="0.7"
      />
    </G>
  </Svg>
);

/**
 * ✅ Tamamlama Görseli - Başarı ve kutlama
 */
export const CompletionIllustration: React.FC<IllustrationProps> = ({ 
  width = 200, 
  height = 200 
}) => (
  <Svg width={width} height={height} viewBox="0 0 200 200">
    {/* Konfeti/kutlama elementleri */}
    <G>
      <Rect x="40" y="50" width="15" height="8" rx="2" fill={BramanColors.warmYellow} transform="rotate(20 47 54)" opacity="0.8" />
      <Rect x="150" y="60" width="12" height="6" rx="2" fill={BramanColors.coral} transform="rotate(-30 156 63)" opacity="0.8" />
      <Rect x="45" y="140" width="10" height="5" rx="2" fill={BramanColors.mint} transform="rotate(45 50 142)" opacity="0.8" />
      <Rect x="145" y="130" width="14" height="7" rx="2" fill={BramanColors.lavender} transform="rotate(-20 152 133)" opacity="0.8" />
    </G>
    
    {/* Ana onay işareti */}
    <Circle cx="100" cy="100" r="50" fill={BramanColors.primaryGreen} opacity="0.2" />
    <Circle cx="100" cy="100" r="40" fill={BramanColors.primaryGreen} opacity="0.3" />
    
    <Path
      d="M 75,100 L 90,115 L 125,80"
      stroke={BramanColors.primaryGreen}
      strokeWidth="6"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    
    {/* Yıldızlar */}
    <G>
      <Circle cx="60" cy="60" r="3" fill={BramanColors.warmYellow} />
      <Circle cx="140" cy="65" r="4" fill={BramanColors.coral} />
      <Circle cx="130" cy="140" r="3" fill={BramanColors.teal} />
      <Circle cx="70" cy="135" r="2" fill={BramanColors.lavender} />
    </G>
  </Svg>
);

// İllüstrasyon koleksiyonu export
export const OnboardingIllustrations = {
  welcome: WelcomeIllustration,
  consent: ConsentIllustration,
  assessment: AssessmentIllustration,
  profile: ProfileIllustration,
  goals: GoalsIllustration,
  treatment: TreatmentPlanIllustration,
  completion: CompletionIllustration,
};
