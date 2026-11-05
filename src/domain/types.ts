export type PosGroup = 'GK' | 'DEF' | 'MID' | 'FWD';
export const POS_GROUPS: PosGroup[] = ['GK', 'DEF', 'MID', 'FWD'];
export const POS_LABEL: Record<PosGroup, string> = {
  GK: 'Goalkeeper',
  DEF: 'Defender',
  MID: 'Midfielder',
  FWD: 'Forward',
};

export const SKILLS = [
  'pace',
  'stamina',
  'technique',
  'passing',
  'attacking',
  'defending',
  'mentality',
  'goalkeeping',
] as const;
export type Skill = (typeof SKILLS)[number];
export type Ratings = Record<Skill, number>; // each 1..10

export type Format = 7 | 9 | 11;

export interface Contract {
  annualWage: number;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export type PlayerStatus = 'fit' | 'injured' | 'unavailable';

export interface Player {
  id: string;
  name: string;
  dob: string; // YYYY-MM-DD
  position: PosGroup;
  altPosition?: PosGroup;
  shirt?: number;
  foot: 'L' | 'R' | 'B';
  status: PlayerStatus;
  statusNote?: string;
  contract?: Contract;
  ratings: Ratings;
  focus: Skill[]; // max 3 development focus skills
  focusTargets: Partial<Record<Skill, number>>;
  guardian?: string;
  notes?: string;
}

export interface Observation {
  id: string;
  playerId: string;
  date: string; // YYYY-MM-DD
  kind: 'baseline' | 'training' | 'match' | 'assessment';
  ratings: Ratings; // full snapshot after this observation
  note: string;
}

export type Availability = 'yes' | 'no' | 'maybe';

export interface MatchEvent {
  id: string;
  playerId: string;
  type: 'goal' | 'assist';
  minute: number;
}

export interface LiveState {
  status: 'idle' | 'running' | 'paused' | 'done';
  clockMs: number; // accumulated clock when not running
  resumedAt: number | null; // epoch ms when last resumed
  slots: (string | null)[]; // current player per formation slot
  enteredAt: Record<string, number>; // clock ms at which player entered pitch
  accruedMs: Record<string, number>; // total ms on pitch
  periodIndex: number; // plan period currently applied
  starters?: string[];
}

export interface Fixture {
  id: string;
  date: string; // ISO datetime (local, YYYY-MM-DDTHH:mm)
  opponent: string;
  home: boolean;
  venue?: string;
  format: Format;
  formationId: string;
  periods: number;
  matchMinutes: number;
  status: 'scheduled' | 'live' | 'played';
  availability: Record<string, Availability>;
  plan?: { periods: (string | null)[][]; balance: number; generatedAt: string };
  result?: { for: number; against: number };
  minutes?: Record<string, number>; // minutes actually played
  starters?: string[]; // players who started
  events: MatchEvent[];
  live?: LiveState;
}

export interface Training {
  id: string;
  date: string; // YYYY-MM-DD
  focus?: Skill;
  note?: string;
  attendance: Record<string, boolean>;
}

export interface Club {
  name: string;
  currency: string; // symbol, e.g. £, $, €
  annualWageBudget: number;
  defaultFormat: Format;
  matchMinutes: number;
  periods: number; // rotation windows per match
  minMinutesPct: number; // 0..100 guaranteed share of match minutes for available players
  balance: number; // 0 = pure development, 1 = pure competitive
  level: 'youth' | 'amateur' | 'semi-pro';
}

export interface AppData {
  club?: Club;
  players: Player[];
  observations: Observation[];
  fixtures: Fixture[];
  trainings: Training[];
}

export const DEFAULT_CLUB: Club = {
  name: 'My FC',
  currency: '£',
  annualWageBudget: 250000,
  defaultFormat: 11,
  matchMinutes: 90,
  periods: 6,
  minMinutesPct: 30,
  balance: 0.5,
  level: 'amateur',
};
