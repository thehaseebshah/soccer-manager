import { useColorScheme } from 'react-native';
import type { PosGroup } from '@/domain/types';

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textDim: string;
  primary: string; // pitch green
  primaryText: string;
  accent: string; // amber
  good: string;
  warn: string;
  bad: string;
  pitch: string;
  pitchLine: string;
  pos: Record<PosGroup, string>;
}

export const light: Theme = {
  dark: false,
  bg: '#F3F5F2',
  card: '#FFFFFF',
  cardAlt: '#EEF2EC',
  border: '#DDE3DA',
  text: '#101914',
  textDim: '#5E6B62',
  primary: '#0F7A4D',
  primaryText: '#FFFFFF',
  accent: '#E8A317',
  good: '#1B9A5B',
  warn: '#D98A00',
  bad: '#C93C3C',
  pitch: '#2E8B57',
  pitchLine: 'rgba(255,255,255,0.55)',
  pos: { GK: '#D98A00', DEF: '#2F6FDE', MID: '#1B9A5B', FWD: '#C93C3C' },
};

export const dark: Theme = {
  dark: true,
  bg: '#0A110D',
  card: '#131D17',
  cardAlt: '#1A2620',
  border: '#24342B',
  text: '#EAF2EC',
  textDim: '#93A39A',
  primary: '#2BC27C',
  primaryText: '#04160D',
  accent: '#F2B63D',
  good: '#35C887',
  warn: '#F2B63D',
  bad: '#F06A6A',
  pitch: '#1F6B43',
  pitchLine: 'rgba(255,255,255,0.4)',
  pos: { GK: '#F2B63D', DEF: '#5B94F5', MID: '#35C887', FWD: '#F06A6A' },
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
export const MAX_W = 960;
