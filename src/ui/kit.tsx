import React from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_W, radius, space, useTheme } from './theme';
import { initials } from '@/domain/util';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ------------------------------------------------------------------ layout

export function Screen({
  children,
  scroll = true,
  style,
  pad = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  pad?: boolean;
}) {
  const t = useTheme();
  const inner = [{ width: '100%' as const, maxWidth: MAX_W, alignSelf: 'center' as const }, pad && { padding: space.lg, gap: space.md }, style];
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: t.bg }, inner]}>{children}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={inner}>{children}</View>
    </ScrollView>
  );
}

export function Row({
  children,
  style,
  gap = space.sm,
  align = 'center',
  wrap,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  align?: 'center' | 'flex-start' | 'flex-end' | 'stretch';
  wrap?: boolean;
}) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Card({ children, style, onPress, tone }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'warn' | 'bad' | 'good' }) {
  const t = useTheme();
  const border = tone ? t[tone] : t.border;
  const base: ViewStyle = {
    backgroundColor: t.card,
    borderRadius: radius.lg,
    borderWidth: tone ? 1.5 : StyleSheet.hairlineWidth * 2,
    borderColor: border,
    padding: space.lg,
    gap: space.sm,
  };
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.8 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

// ------------------------------------------------------------------ text

type Variant = 'title' | 'h2' | 'h3' | 'body' | 'small' | 'label' | 'num';
const sizes: Record<Variant, TextStyle> = {
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400' },
  small: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  num: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
};

export function Txt({
  children,
  v = 'body',
  dim,
  color,
  style,
  numberOfLines,
  center,
  onPress,
}: {
  children: React.ReactNode;
  v?: Variant;
  dim?: boolean;
  color?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  center?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      onPress={onPress}
      accessibilityRole={onPress ? 'link' : undefined}
      style={[sizes[v], { color: color ?? (dim || v === 'label' ? t.textDim : t.text) }, center && { textAlign: 'center' }, style]}
    >
      {children}
    </Text>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: space.sm }}>
      <Txt v="label">{children}</Txt>
      {action}
    </Row>
  );
}

// ------------------------------------------------------------------ controls

export function Btn({
  label,
  onPress,
  icon,
  kind = 'primary',
  small,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: IconName;
  kind?: 'primary' | 'secondary' | 'danger' | 'ghost';
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.primary : kind === 'danger' ? t.bad : kind === 'secondary' ? t.cardAlt : 'transparent';
  const fg = kind === 'primary' ? t.primaryText : kind === 'danger' ? '#fff' : t.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingVertical: small ? 8 : 13,
          paddingHorizontal: small ? 12 : 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          borderWidth: kind === 'ghost' ? 1 : 0,
          borderColor: t.border,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: '700', fontSize: small ? 13 : 15 }}>{label}</Text>
    </Pressable>
  );
}

export function IconBtn({ icon, onPress, label, color }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}>
      <Ionicons name={icon} size={22} color={color ?? t.text} />
    </Pressable>
  );
}

export function Pill({ label, color, solid, icon }: { label: string; color?: string; solid?: boolean; icon?: IconName }) {
  const t = useTheme();
  const c = color ?? t.textDim;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: solid ? c : c + '22',
        alignSelf: 'flex-start',
      }}
    >
      {icon ? <Ionicons name={icon} size={11} color={solid ? '#fff' : c} /> : null}
      <Text style={{ color: solid ? '#fff' : c, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress?: () => void; color?: string }) {
  const t = useTheme();
  const c = color ?? t.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: radius.pill,
        backgroundColor: selected ? c : t.cardAlt,
        borderWidth: 1,
        borderColor: selected ? c : t.border,
      }}
    >
      <Text style={{ color: selected ? t.primaryText : t.text, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.cardAlt, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const sel = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: radius.sm + 1, alignItems: 'center', backgroundColor: sel ? t.card : 'transparent' }}
          >
            <Text style={{ color: sel ? t.text : t.textDim, fontWeight: sel ? '700' : '500', fontSize: 13 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  hint,
  error,
  ...rest
}: { label: string; value: string; onChangeText: (s: string) => void; hint?: string; error?: string } & Omit<TextInputProps, 'value' | 'onChangeText'>) {
  const t = useTheme();
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Txt v="label">{label}</Txt>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={t.textDim}
        accessibilityLabel={label}
        style={[
          {
            backgroundColor: t.card,
            borderColor: error ? t.bad : t.border,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            paddingVertical: Platform.OS === 'web' ? 10 : 11,
            color: t.text,
            fontSize: 15,
          },
          rest.multiline && { minHeight: 80, textAlignVertical: 'top' },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as object),
        ]}
        {...rest}
      />
      {error ? <Txt v="small" color={t.bad}>{error}</Txt> : hint ? <Txt v="small" dim>{hint}</Txt> : null}
    </View>
  );
}

/** Numeric stepper, e.g. for a 1..10 rating. */
export function Stepper({
  label,
  value,
  onChange,
  min = 1,
  max = 10,
  step = 0.5,
  format,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (n: number) => string;
}) {
  const t = useTheme();
  const btn = (sign: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sign > 0 ? 'Increase' : 'Decrease'} ${label}`}
      onPress={() => onChange(Math.round(Math.min(max, Math.max(min, value + sign * step)) * 100) / 100)}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: t.cardAlt,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={sign > 0 ? 'add' : 'remove'} size={18} color={t.text} />
    </Pressable>
  );
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Txt v="body" style={{ flex: 1 }}>{label}</Txt>
      {btn(-1)}
      <Txt v="h3" style={{ width: 46, textAlign: 'center' }}>{format ? format(value) : value.toFixed(1)}</Txt>
      {btn(1)}
    </Row>
  );
}

export function Avatar({ name, size = 40, color }: { name: string; size?: number; color?: string }) {
  const t = useTheme();
  const c = color ?? t.primary;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c + '26', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c, fontWeight: '800', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

export function Empty({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: space.xl, gap: space.sm }}>
      <Ionicons name={icon} size={40} color={t.textDim} />
      <Txt v="h3" center>{title}</Txt>
      {body ? <Txt v="small" dim center>{body}</Txt> : null}
      {action}
    </View>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 130, gap: 2 }}>
      <Txt v="label">{label}</Txt>
      <Txt v="num" color={color}>{value}</Txt>
      {sub ? <Txt v="small" dim>{sub}</Txt> : null}
    </View>
  );
}

export function Bar({ value, color, height = 8, marker }: { value: number; color?: string; height?: number; marker?: number }) {
  const t = useTheme();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: t.cardAlt, overflow: 'visible', justifyContent: 'center' }}>
      <View style={{ width: `${v * 100}%`, height, borderRadius: height / 2, backgroundColor: color ?? t.primary }} />
      {marker !== undefined ? (
        <View style={{ position: 'absolute', left: `${Math.max(0, Math.min(1, marker)) * 100}%`, top: -3, bottom: -3, width: 2, backgroundColor: t.text, opacity: 0.6 }} />
      ) : null}
    </View>
  );
}

export function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth * 2, backgroundColor: t.border }} />;
}

export function confirmAction(title: string, message: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Confirm', style: 'destructive', onPress: onConfirm },
  ]);
}

export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
