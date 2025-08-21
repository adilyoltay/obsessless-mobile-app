/**
 * 🎨 Lindsay Braman Tarzı Emotion Wheel
 * Organik, el çizimi görünümlü duygu çemberi
 */

import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText, Ellipse, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

interface EmotionWheelProps {
  size?: number;
  selectedEmotion?: { primary: string; secondary?: string } | null;
  onEmotionSelect?: (primary: string, secondary?: string) => void;
  interactive?: boolean;
  style?: any;
}

// Lindsay Braman Soft Pastel Renk Paleti - Daha belirgin
const BramanColors = {
  mutlu: '#F2A774',      // Warm peach - daha belirgin
  üzgün: '#8FA9C7',      // Soft blue - daha belirgin
  kızgın: '#E8857C',     // Coral - daha belirgin
  korkmuş: '#B599CC',    // Lavender - daha belirgin
  şaşkın: '#E8C473',     // Yellow - daha belirgin
  güvenli: '#7DB88F',    // Sage green - daha belirgin
  
  // Çizgi ve detaylar için
  stroke: '#5A5A5A',
  strokeLight: '#A0A0A0',
  paper: '#FFFEF9',
  shadow: 'rgba(0,0,0,0.08)',
};

// Ana duygular
const PRIMARY_EMOTIONS = [
  { id: 'mutlu', label: 'Mutlu', color: BramanColors.mutlu },
  { id: 'üzgün', label: 'Üzgün', color: BramanColors.üzgün },
  { id: 'kızgın', label: 'Kızgın', color: BramanColors.kızgın },
  { id: 'korkmuş', label: 'Korkmuş', color: BramanColors.korkmuş },
  { id: 'şaşkın', label: 'Şaşkın', color: BramanColors.şaşkın },
  { id: 'güvenli', label: 'Güvenli', color: BramanColors.güvenli }
];

// İkincil duygular
const SECONDARY_EMOTIONS: Record<string, string[]> = {
  mutlu: ['Neşeli', 'Huzurlu', 'Minnettar', 'Umutlu', 'Gururlu', 'Sevecen'],
  üzgün: ['Kırgın', 'Yalnız', 'Nostaljik', 'Pişman', 'Kayıp', 'Boşluk'],
  kızgın: ['Sinirli', 'Öfkeli', 'Hayal kırıklığı', 'Sabırsız', 'Rahatsız', 'Kıskanç'],
  korkmuş: ['Endişeli', 'Kaygılı', 'Panik', 'Güvensiz', 'Tedirgin', 'Ürkek'],
  şaşkın: ['Meraklı', 'Şok', 'Kafası karışık', 'Hayret', 'İlginç', 'Beklenmedik'],
  güvenli: ['Rahat', 'Korunmuş', 'Desteklenmiş', 'Kabul edilmiş', 'Değerli', 'Bağlı']
};

export default function EmotionWheel({ 
  size = 280, 
  selectedEmotion,
  onEmotionSelect,
  interactive = true,
  style 
}: EmotionWheelProps) {
  const [localSelectedEmotion, setLocalSelectedEmotion] = useState<{ primary: string; secondary?: string } | null>(selectedEmotion || null);
  
  const centerX = size / 2;
  const centerY = size / 2;
  const innerRadius = size * 0.15;
  const middleRadius = size * 0.32;
  const outerRadius = size * 0.45;

  // Polar koordinatları kartezyen koordinatlara çevir
  const polarToCartesian = (angle: number, radius: number) => {
    const angleInRadians = (angle - 90) * Math.PI / 180;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians)
    };
  };

  // Organik, el çizimi görünümlü path oluştur
  const createPieSlice = (startAngle: number, endAngle: number, innerR: number, outerR: number) => {
    const start1 = polarToCartesian(startAngle, innerR);
    const end1 = polarToCartesian(endAngle, innerR);
    const start2 = polarToCartesian(startAngle, outerR);
    const end2 = polarToCartesian(endAngle, outerR);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
      "M", start1.x, start1.y,
      "A", innerR, innerR, 0, largeArcFlag, 1, end1.x, end1.y,
      "L", end2.x, end2.y,
      "A", outerR, outerR, 0, largeArcFlag, 0, start2.x, start2.y,
      "Z"
    ].join(" ");
  };

  const handlePrimaryPress = (emotionId: string) => {
    if (!interactive) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const newSelection = localSelectedEmotion?.primary === emotionId 
      ? null 
      : { primary: emotionId };
    
    setLocalSelectedEmotion(newSelection);
    
    if (onEmotionSelect) {
      onEmotionSelect(emotionId);
    }
  };

  const handleSecondaryPress = (primary: string, secondary: string) => {
    if (!interactive) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    const newSelection = { primary, secondary };
    setLocalSelectedEmotion(newSelection);
    
    if (onEmotionSelect) {
      onEmotionSelect(primary, secondary);
    }
  };

  // Ana duygu butonları için pozisyon hesapla
  const getPrimaryButtonPosition = (index: number) => {
    const angle = index * 60 + 30;
    const pos = polarToCartesian(angle, (innerRadius + middleRadius) / 2);
    
    return {
      position: 'absolute' as const,
      left: pos.x - 30,
      top: pos.y - 15,
      width: 60,
      height: 30,
      zIndex: 10,
    };
  };

  // İkincil duygu butonları için pozisyon hesapla
  const getSecondaryButtonPosition = (primaryIndex: number, secondaryIndex: number) => {
    const primaryStartAngle = primaryIndex * 60;
    const segmentAngle = 60 / 6;
    const angle = primaryStartAngle + (secondaryIndex * segmentAngle) + (segmentAngle / 2);
    const pos = polarToCartesian(angle, (middleRadius + outerRadius) / 2);
    
    return {
      position: 'absolute' as const,
      left: pos.x - 35,
      top: pos.y - 12,
      width: 70,
      height: 24,
      zIndex: 20,
    };
  };

  const currentSelection = selectedEmotion || localSelectedEmotion;

  return (
    <View style={[styles.container, style]}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={styles.svgLayer}>
        <Defs>
          <RadialGradient id="paperGradient" cx="50%" cy="50%">
            <Stop offset="0%" stopColor={BramanColors.paper} stopOpacity="1" />
            <Stop offset="100%" stopColor="#F5F5F5" stopOpacity="0.9" />
          </RadialGradient>
        </Defs>

        {/* Arka plan - kağıt dokusu */}
        <Circle 
          cx={centerX} 
          cy={centerY} 
          r={outerRadius + 10} 
          fill="url(#paperGradient)"
        />

        {/* Ana duygular */}
        {PRIMARY_EMOTIONS.map((emotion, index) => {
          const startAngle = index * 60;
          const endAngle = (index + 1) * 60;
          const isSelected = currentSelection?.primary === emotion.id;
          const textAngle = startAngle + 30;
          const textPos = polarToCartesian(textAngle, (innerRadius + middleRadius) / 2);

          return (
            <G key={emotion.id}>
              {/* Ana duygu dilimi */}
              <Path
                d={createPieSlice(startAngle, endAngle, innerRadius, middleRadius)}
                fill={emotion.color}
                opacity={isSelected ? 1 : 0.85}
                stroke={isSelected ? BramanColors.stroke : BramanColors.strokeLight}
                strokeWidth={isSelected ? "2.5" : "1.5"}
              />
              
              {/* Ana duygu etiketi */}
              <SvgText
                x={textPos.x}
                y={textPos.y}
                fontSize="14"
                fontWeight={isSelected ? "700" : "500"}
                fill={isSelected ? BramanColors.stroke : "white"}
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {emotion.label}
              </SvgText>

              {/* Seçili göstergesi */}
              {isSelected && (
                <Circle 
                  cx={textPos.x} 
                  cy={textPos.y + 12} 
                  r="3" 
                  fill={BramanColors.stroke}
                />
              )}
            </G>
          );
        })}

        {/* İkincil duygular - seçili ana duygu varsa */}
        {currentSelection?.primary && SECONDARY_EMOTIONS[currentSelection.primary] && (
          <G>
            {SECONDARY_EMOTIONS[currentSelection.primary].map((secondaryEmotion, index) => {
              const primaryIndex = PRIMARY_EMOTIONS.findIndex(e => e.id === currentSelection.primary);
              const primaryStartAngle = primaryIndex * 60;
              const segmentAngle = 60 / 6;
              const startAngle = primaryStartAngle + (index * segmentAngle);
              const endAngle = primaryStartAngle + ((index + 1) * segmentAngle);
              
              const textAngle = startAngle + (segmentAngle / 2);
              const textPos = polarToCartesian(textAngle, (middleRadius + outerRadius) / 2);
              
              const primaryColor = PRIMARY_EMOTIONS[primaryIndex].color;
              const isSecondarySelected = currentSelection.secondary === secondaryEmotion;

              return (
                <G key={`${currentSelection.primary}-${index}`}>
                  {/* İkincil duygu dilimi */}
                  <Path
                    d={createPieSlice(startAngle, endAngle, middleRadius + 2, outerRadius)}
                    fill={primaryColor}
                    opacity={isSecondarySelected ? 0.7 : 0.4}
                    stroke={isSecondarySelected ? BramanColors.stroke : BramanColors.strokeLight}
                    strokeWidth={isSecondarySelected ? "2" : "1"}
                  />

                  {/* İkincil duygu etiketi */}
                  <SvgText
                    x={textPos.x}
                    y={textPos.y}
                    fontSize="10"
                    fontWeight={isSecondarySelected ? "600" : "400"}
                    fill={isSecondarySelected ? BramanColors.stroke : "white"}
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    transform={`rotate(${textAngle > 90 && textAngle < 270 ? textAngle + 180 : textAngle}, ${textPos.x}, ${textPos.y})`}
                  >
                    {secondaryEmotion}
                  </SvgText>
                </G>
              );
            })}
          </G>
        )}

        {/* Merkez daire */}
        <Circle 
          cx={centerX} 
          cy={centerY} 
          r={innerRadius - 2} 
          fill="white"
          stroke={BramanColors.strokeLight}
          strokeWidth="1.5"
        />

        {/* Merkez metin */}
        <SvgText
          x={centerX}
          y={centerY - 5}
          fontSize="11"
          fontWeight="600"
          fill={BramanColors.stroke}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          DUYGU
        </SvgText>
        <SvgText
          x={centerX}
          y={centerY + 8}
          fontSize="9"
          fill={BramanColors.strokeLight}
          textAnchor="middle"
          alignmentBaseline="middle"
        >
          SEÇİNİZ
        </SvgText>

        {/* Dış çember - el çizimi görünümlü */}
        <Circle
          cx={centerX}
          cy={centerY}
          r={outerRadius + 2}
          fill="none"
          stroke={BramanColors.strokeLight}
          strokeWidth="1"
          strokeDasharray="6,3"
          opacity="0.5"
        />
      </Svg>

      {/* Dokunulabilir katman - Ana duygular */}
      {PRIMARY_EMOTIONS.map((emotion, index) => (
        <TouchableOpacity
          key={`primary-touch-${emotion.id}`}
          style={getPrimaryButtonPosition(index)}
          onPress={() => handlePrimaryPress(emotion.id)}
          activeOpacity={0.7}
        />
      ))}

      {/* Dokunulabilir katman - İkincil duygular */}
      {currentSelection?.primary && SECONDARY_EMOTIONS[currentSelection.primary] && (
        <>
          {SECONDARY_EMOTIONS[currentSelection.primary].map((secondaryEmotion, secondaryIndex) => {
            const primaryIndex = PRIMARY_EMOTIONS.findIndex(e => e.id === currentSelection.primary);
            
            return (
              <TouchableOpacity
                key={`secondary-touch-${secondaryIndex}`}
                style={getSecondaryButtonPosition(primaryIndex, secondaryIndex)}
                onPress={() => handleSecondaryPress(currentSelection.primary, secondaryEmotion)}
                activeOpacity={0.7}
              />
            );
          })}
        </>
      )}

      {/* Seçim göstergesi */}
      {currentSelection && (
        <View style={styles.selectionIndicator}>
          <Text style={styles.selectionText}>
            {PRIMARY_EMOTIONS.find(e => e.id === currentSelection.primary)?.label}
            {currentSelection.secondary && ` - ${currentSelection.secondary}`}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svgLayer: {
    position: 'relative',
  },
  selectionIndicator: {
    position: 'absolute',
    bottom: -25,
    backgroundColor: 'white',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A5A5A',
  },
});