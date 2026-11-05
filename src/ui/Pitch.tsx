import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import type { Player } from '@/domain/types';
import type { Slot } from '@/domain/lineup';
import { useTheme } from './theme';

export function surname(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

export function Pitch({
  slots,
  lineup,
  players,
  onSlotPress,
  highlight,
  selected,
  badge,
  width = 340,
}: {
  slots: Slot[];
  lineup: (string | null)[];
  players: Record<string, Player>;
  onSlotPress?: (index: number) => void;
  highlight?: Set<number>; // slots changing in the next window
  selected?: number | null;
  badge?: (playerId: string) => string | undefined;
  width?: number;
}) {
  const t = useTheme();
  const height = width * 1.2;
  const node = Math.max(34, Math.min(44, width / 8.5));
  const line = t.pitchLine;
  return (
    <View style={{ width, height, borderRadius: 14, overflow: 'hidden', backgroundColor: t.pitch, alignSelf: 'center' }}>
      <Svg width={width} height={height} style={{ position: 'absolute' }} viewBox="0 0 100 120" preserveAspectRatio="none">
        <Rect x={3} y={3} width={94} height={114} fill="none" stroke={line} strokeWidth={0.5} />
        <Line x1={3} x2={97} y1={60} y2={60} stroke={line} strokeWidth={0.5} />
        <Circle cx={50} cy={60} r={10} fill="none" stroke={line} strokeWidth={0.5} />
        <Rect x={22} y={3} width={56} height={18} fill="none" stroke={line} strokeWidth={0.5} />
        <Rect x={36} y={3} width={28} height={7} fill="none" stroke={line} strokeWidth={0.5} />
        <Rect x={22} y={99} width={56} height={18} fill="none" stroke={line} strokeWidth={0.5} />
        <Rect x={36} y={110} width={28} height={7} fill="none" stroke={line} strokeWidth={0.5} />
      </Svg>
      {slots.map((slot, i) => {
        const id = lineup[i];
        const p = id ? players[id] : undefined;
        const c = p ? t.pos[p.position] : t.textDim;
        const isHi = highlight?.has(i);
        const isSel = selected === i;
        return (
          <Pressable
            key={slot.id}
            accessibilityRole="button"
            accessibilityLabel={`${slot.label}: ${p ? p.name : 'empty'}`}
            onPress={() => onSlotPress?.(i)}
            style={{
              position: 'absolute',
              left: (slot.x / 100) * width - 34,
              top: (slot.y / 100) * height - node / 2 - 4,
              width: 68,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: node,
                height: node,
                borderRadius: node / 2,
                backgroundColor: p ? '#fff' : 'rgba(255,255,255,0.18)',
                borderWidth: isSel ? 3 : isHi ? 2.5 : 2,
                borderColor: isSel ? '#FFE066' : isHi ? t.accent : p ? c : 'rgba(255,255,255,0.5)',
                borderStyle: p ? 'solid' : 'dashed',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: p ? '#101914' : '#fff', fontWeight: '800', fontSize: node * 0.38 }}>
                {p ? (p.shirt ?? slot.label) : slot.label}
              </Text>
              {p && badge?.(p.id) ? (
                <View style={{ position: 'absolute', top: -6, right: -10, backgroundColor: '#101914', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{badge(p.id)}</Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              style={{ color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 }}
            >
              {p ? surname(p.name) : slot.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
