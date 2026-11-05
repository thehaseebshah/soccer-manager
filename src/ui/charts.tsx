import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from './theme';
import type { BudgetMonth } from '@/domain/budget';
import { monthLabel } from '@/domain/util';

export function Sparkline({ values, width = 90, height = 28, color }: { values: number[]; width?: number; height?: number; color?: string }) {
  const t = useTheme();
  const c = color ?? t.primary;
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 6) + 3, height - 4 - ((v - min) / span) * (height - 8)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={c} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={last[0]} cy={last[1]} r={3} fill={c} />
    </Svg>
  );
}

/** Monthly wage bill vs budget line. */
export function BudgetChart({ months, width, height = 160, compareTo }: { months: BudgetMonth[]; width: number; height?: number; compareTo?: BudgetMonth[] }) {
  const t = useTheme();
  const padL = 4;
  const padB = 20;
  const max = Math.max(...months.map((m) => Math.max(m.committed, m.budget)), ...(compareTo ?? []).map((m) => m.committed), 1) * 1.1;
  const bw = (width - padL) / months.length;
  const h = height - padB;
  const y = (v: number) => h - (v / max) * h;
  const budgetY = y(months[0].budget);
  return (
    <Svg width={width} height={height}>
      {months.map((m, i) => {
        const over = m.committed > m.budget + 1;
        return (
          <Rect
            key={m.month}
            x={padL + i * bw + bw * 0.12}
            y={y(m.committed)}
            width={bw * 0.76}
            height={Math.max(h - y(m.committed), 1)}
            rx={2}
            fill={over ? t.bad : t.primary}
            opacity={0.9}
          />
        );
      })}
      {compareTo?.map((m, i) => (
        <Line
          key={`c${m.month}`}
          x1={padL + i * bw + bw * 0.05}
          x2={padL + i * bw + bw * 0.95}
          y1={y(m.committed)}
          y2={y(m.committed)}
          stroke={t.accent}
          strokeWidth={2}
        />
      ))}
      <Line x1={0} x2={width} y1={budgetY} y2={budgetY} stroke={t.text} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.6} />
      {months.map((m, i) =>
        i % 3 === 0 ? (
          <SvgText key={`l${m.month}`} x={padL + i * bw + bw / 2} y={height - 5} fontSize={10} fill={t.textDim} textAnchor="middle">
            {monthLabel(m.date)}
          </SvgText>
        ) : null,
      )}
    </Svg>
  );
}
