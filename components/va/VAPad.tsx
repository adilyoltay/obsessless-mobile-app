import React from 'react';
import { View, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import Svg, { Rect, Defs, LinearGradient as SvgLinearGradient, Stop, Line, Circle } from 'react-native-svg';
import { useAccentColor } from '@/contexts/AccentColorContext';
import { getPaletteVAColor, lighten, darken, mixHex } from '@/utils/colorUtils';
import { BramanColors } from '@/constants/Colors';

type Props = {
  width?: number;
  height?: number;
  grid?: { cols?: number; rows?: number };
  value?: { x: number; y: number } | null; // -1..1 for both axes
  onChange?: (v: { x: number; y: number; color: string }) => void;
  liveSyncAccent?: boolean; // update global accent VA
};

/**
 * Interactive VA Pad with palette-aware heatmap and reticle
 * - x: valence (-1..1)
 * - y: energy/arousal (-1..1)
 */
export default function VAPad({ width = 260, height = 180, grid, value, onChange, liveSyncAccent = true }: Props) {
  const { palette, setVA, va } = useAccentColor();
  const cols = Math.max(6, Math.min(32, grid?.cols ?? 14));
  const rows = Math.max(4, Math.min(24, grid?.rows ?? 10));
  const pad = 8; // inner padding for reticle drawing safety
  const [pos, setPos] = React.useState<{ x: number; y: number }>(() => value ?? va ?? { x: 0, y: 0 });

  React.useEffect(() => {
    if (value && (value.x !== pos.x || value.y !== pos.y)) setPos(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.x, value?.y]);

  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const toCoord = (px: number, py: number) => {
    const x = clamp(((px - pad) / (width - 2 * pad)) * 2 - 1, -1, 1);
    const y = clamp(((height - pad - py) / (height - 2 * pad)) * 2 - 1, -1, 1);
    return { x, y };
  };
  const toPixel = (x: number, y: number) => {
    const px = pad + ((x + 1) / 2) * (width - 2 * pad);
    const py = height - pad - ((y + 1) / 2) * (height - 2 * pad);
    return { px, py };
  };

  const handleMove = (evt: GestureResponderEvent, g: PanResponderGestureState) => {
    const { locationX, locationY } = evt.nativeEvent;
    const { x, y } = toCoord(locationX, locationY);
    setPos({ x, y });
    const color = getPaletteVAColor(palette, x, y);
    onChange?.({ x, y, color });
    if (liveSyncAccent) setVA({ x, y });
  };

  const pan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: handleMove,
      onPanResponderMove: handleMove,
    })
  ).current;

  // Heatmap cells
  const cells = React.useMemo(() => {
    const list: Array<{ x: number; y: number; color: string; a: number }> = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c / (cols - 1)) * 2 - 1;
        const y = (r / (rows - 1)) * 2 - 1;
        const color = getPaletteVAColor(palette, x, y);
        // Opacity: Braman'da sabit pastel, Apple/VA'da enerjiye bağlı daha belirgin
        const y01 = (y + 1) / 2; // 0..1
        let a = 0.2;
        if (palette === 'apple' || palette === 'va') {
          const baseA = palette === 'va' ? 0.16 : 0.12;
          const boost = palette === 'va' ? 0.10 : 0.18;
          a = baseA + boost * y01;
        }
        list.push({ x, y, color, a });
      }
    }
    return list;
  }, [cols, rows, palette]);

  const { px, py } = toPixel(pos.x, pos.y);
  const reticleColor = getPaletteVAColor(palette, pos.x, pos.y);
  const reticleStroke = palette === 'braman' ? BramanColors.dark : mixHex(reticleColor, '#000000', 0.25);

  const cellW = (width - 2 * pad) / cols;
  const cellH = (height - 2 * pad) / rows;

  return (
    <View {...pan.panHandlers}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id="vapad_bg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={palette === 'braman' ? BramanColors.paper : lighten(reticleColor, 0.52)} stopOpacity={palette === 'braman' ? 1 : 0.42} />
            <Stop offset="100%" stopColor={palette === 'braman' ? BramanColors.paper : darken(reticleColor, 0.2)} stopOpacity={palette === 'braman' ? 1 : 0.18} />
          </SvgLinearGradient>
        </Defs>
        {/* Base background tint (Braman: sabit kağıt tonu) */}
        <Rect x={0} y={0} width={width} height={height} rx={12} ry={12} fill={palette === 'braman' ? BramanColors.paper : 'url(#vapad_bg)'} />
        {/* Heatmap grid */}
        {cells.map((cell, i) => {
          const p = toPixel(cell.x, cell.y);
          return (
            <Rect
              key={`cell-${i}`}
              x={p.px - cellW / 2}
              y={p.py - cellH / 2}
              width={cellW + 0.5}
              height={cellH + 0.5}
              fill={cell.color}
              opacity={cell.a}
            />
          );
        })}
        {/* Crosshair */}
        <Line x1={pad} y1={py} x2={width - pad} y2={py} stroke={reticleStroke} strokeWidth={1} strokeDasharray="4 3" />
        <Line x1={px} y1={pad} x2={px} y2={height - pad} stroke={reticleStroke} strokeWidth={1} strokeDasharray="4 3" />
        {/* Reticle */}
        <Circle cx={px} cy={py} r={8} fill={reticleColor} opacity={0.9} stroke="#FFFFFF" strokeWidth={1.5} />
        <Circle cx={px} cy={py} r={12} fill="none" stroke={reticleStroke} strokeWidth={1} opacity={0.8} />
      </Svg>
    </View>
  );
}
