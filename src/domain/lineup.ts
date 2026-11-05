import type { Format, Player, PosGroup } from './types';
import { clamp, mean } from './util';
import { overall } from './ratings';

// ---------------------------------------------------------------- formations

export interface Slot {
  id: string;
  label: string;
  role: PosGroup;
  x: number; // 0..100 left→right
  y: number; // 0..100 top (attacking) → bottom (own goal)
}

export interface Formation {
  id: string;
  name: string;
  format: Format;
  rows: number[]; // outfield rows from defence to attack
}

const f = (format: Format, rows: number[]): Formation => ({
  id: `${format}:${rows.join('-')}`,
  name: rows.join('-'),
  format,
  rows,
});

export const FORMATIONS: Formation[] = [
  f(11, [4, 3, 3]),
  f(11, [4, 4, 2]),
  f(11, [3, 5, 2]),
  f(11, [4, 2, 3, 1]),
  f(11, [4, 1, 4, 1]),
  f(9, [3, 3, 2]),
  f(9, [3, 2, 3]),
  f(9, [2, 3, 3]),
  f(9, [3, 4, 1]),
  f(7, [2, 3, 1]),
  f(7, [3, 2, 1]),
  f(7, [2, 2, 2]),
  f(7, [3, 1, 2]),
];

export function formationsFor(format: Format): Formation[] {
  return FORMATIONS.filter((x) => x.format === format);
}

export function getFormation(id: string, format?: Format): Formation {
  return FORMATIONS.find((x) => x.id === id) ?? formationsFor(format ?? 11)[0];
}

const SIDES: Record<number, string[]> = {
  1: ['C'],
  2: ['L', 'R'],
  3: ['L', 'C', 'R'],
  4: ['L', 'LC', 'RC', 'R'],
  5: ['L', 'LC', 'C', 'RC', 'R'],
};

function labelFor(role: PosGroup, n: number, i: number): string {
  const side = (SIDES[n] ?? SIDES[5])[i] ?? 'C';
  if (role === 'DEF') {
    if (n === 2) return ['LCB', 'RCB'][i];
    if (n === 3) return ['LCB', 'CB', 'RCB'][i];
    return { L: 'LB', LC: 'LCB', C: 'CB', RC: 'RCB', R: 'RB' }[side] ?? 'CB';
  }
  if (role === 'MID') {
    if (n === 2) return ['LCM', 'RCM'][i];
    if (n === 3) return ['LCM', 'CM', 'RCM'][i];
    return { L: 'LM', LC: 'LCM', C: 'CM', RC: 'RCM', R: 'RM' }[side] ?? 'CM';
  }
  if (n === 1) return 'ST';
  if (n === 2) return ['LS', 'RS'][i];
  if (n === 3) return ['LW', 'ST', 'RW'][i];
  return { L: 'LW', LC: 'LS', C: 'ST', RC: 'RS', R: 'RW' }[side] ?? 'ST';
}

export function buildSlots(formation: Formation): Slot[] {
  const slots: Slot[] = [{ id: 'gk', label: 'GK', role: 'GK', x: 50, y: 90 }];
  const rows = formation.rows;
  rows.forEach((n, r) => {
    const role: PosGroup = r === 0 ? 'DEF' : r === rows.length - 1 ? 'FWD' : 'MID';
    const y = rows.length === 1 ? 45 : 74 - (r * 60) / (rows.length - 1);
    for (let i = 0; i < n; i++) {
      slots.push({
        id: `r${r}i${i}`,
        label: labelFor(role, n, i),
        role,
        x: ((i + 1) / (n + 1)) * 100,
        y,
      });
    }
  });
  return slots;
}

// ---------------------------------------------------------------- assignment

/** Hungarian algorithm (min cost). `a` is n×m with n <= m. Returns column index per row. */
export function hungarian(a: number[][]): number[] {
  const n = a.length;
  if (n === 0) return [];
  const m = a[0].length;
  if (n > m) throw new Error('hungarian: rows must be <= cols');
  const INF = 1e15;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(INF);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }
  const ans = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) ans[p[j] - 1] = j - 1;
  return ans;
}

/** How well a player suits a slot role, roughly -3..1. */
export function positionFit(p: Pick<Player, 'position' | 'altPosition'>, role: PosGroup): number {
  if (role === 'GK') return p.position === 'GK' ? 1 : p.altPosition === 'GK' ? 0.6 : -3;
  if (p.position === 'GK') return -1.5;
  if (p.position === role) return 1;
  if (p.altPosition === role) return 0.65;
  const adj: Record<string, number> = { 'DEF-MID': 0.35, 'MID-DEF': 0.35, 'MID-FWD': 0.35, 'FWD-MID': 0.35, 'DEF-FWD': 0.1, 'FWD-DEF': 0.1 };
  return adj[`${p.position}-${role}`] ?? 0;
}

// ---------------------------------------------------------------- rotation planner

export interface PlanInput {
  players: Player[]; // only players who are available
  slots: Slot[];
  periods: number;
  /** guaranteed share of match time (0..100) for every available player */
  minPct: number;
  /** minutes already played this season by each player (drives catch-up fairness) */
  seasonMinutes: Record<string, number>;
  /** 0 = pure development / fairness, 1 = pure competitive */
  balance: number;
}

export interface PlanOutput {
  periods: (string | null)[][]; // [period][slotIndex] = playerId
  quotas: Record<string, number>; // periods each player is scheduled for
  warnings: string[];
}

interface GroupInput {
  group: Player[];
  slotsPerPeriod: number;
  periods: number;
  minPct: number;
  seasonMinutes: Record<string, number>;
  balance: number;
  label: string;
}

/** Distribute `slotsPerPeriod * periods` playing windows among a group, honouring a guaranteed minimum. */
function groupQuotas(input: GroupInput): { quotas: Record<string, number>; minPeriods: number; warnings: string[] } {
  const { group, slotsPerPeriod, periods, minPct, seasonMinutes, balance, label } = input;
  const warnings: string[] = [];
  const m = group.length;
  const total = slotsPerPeriod * periods;
  const quotas: Record<string, number> = {};
  if (m === 0) return { quotas, minPeriods: 0, warnings };
  if (m <= slotsPerPeriod) {
    group.forEach((p) => (quotas[p.id] = periods));
    return { quotas, minPeriods: periods, warnings };
  }

  const wantedMin = Math.ceil((minPct / 100) * periods - 1e-9);
  const feasibleMin = Math.floor(total / m);
  const minPeriods = Math.min(wantedMin, feasibleMin);
  if (wantedMin > feasibleMin) {
    warnings.push(
      `With ${m} ${label} sharing ${slotsPerPeriod} spot${slotsPerPeriod === 1 ? '' : 's'} the best guaranteed minimum is ${Math.round((feasibleMin / periods) * 100)}% — lower than your ${minPct}% rule.`,
    );
  }

  const ovr = group.map((p) => overall(p));
  const mo = mean(ovr);
  const range = Math.max(Math.max(...ovr) - Math.min(...ovr), 1);
  const season = group.map((p) => seasonMinutes[p.id] ?? 0);
  const ms = Math.max(mean(season), 60);

  const base = total / m;
  const raw = group.map((_, i) => {
    const z = clamp((ovr[i] - mo) / (range / 2), -1, 1);
    const deficit = clamp((ms - season[i]) / ms, -1, 1);
    return base + periods * 0.3 * (balance * z + (1 - balance) * 0.7 * deficit);
  });

  const q = raw.map((r) => clamp(Math.round(r), minPeriods, periods));
  let sum = q.reduce((a, b) => a + b, 0);
  let guard = 0;
  while (sum !== total && guard++ < 1000) {
    let best = -1;
    if (sum < total) {
      let bestGap = -Infinity;
      q.forEach((v, i) => {
        if (v < periods && raw[i] - v > bestGap) {
          bestGap = raw[i] - v;
          best = i;
        }
      });
      if (best < 0) break;
      q[best]++;
      sum++;
    } else {
      let bestGap = Infinity;
      q.forEach((v, i) => {
        if (v > minPeriods && raw[i] - v < bestGap) {
          bestGap = raw[i] - v;
          best = i;
        }
      });
      if (best < 0) break;
      q[best]--;
      sum--;
    }
  }
  group.forEach((p, i) => (quotas[p.id] = q[i]));
  return { quotas, minPeriods, warnings };
}

/**
 * Keepers share the goalkeeper slot between themselves; outfield players share everything else.
 * If there are no keepers, everyone is pooled and the best fit goes in goal.
 */
export function computeQuotas(input: PlanInput): { quotas: Record<string, number>; minPeriods: number; warnings: string[] } {
  const { players, slots, periods } = input;
  if (players.length === 0) return { quotas: {}, minPeriods: 0, warnings: ['No available players.'] };

  const gkSlots = slots.filter((x) => x.role === 'GK').length;
  const keepers = players.filter((p) => p.position === 'GK');
  const outfield = players.filter((p) => p.position !== 'GK');
  const common = { periods, minPct: input.minPct, seasonMinutes: input.seasonMinutes, balance: input.balance };

  if (gkSlots > 0 && keepers.length > 0) {
    const k = groupQuotas({ ...common, group: keepers, slotsPerPeriod: gkSlots, label: 'goalkeepers' });
    const o = groupQuotas({ ...common, group: outfield, slotsPerPeriod: slots.length - gkSlots, label: 'outfield players' });
    const warnings = [...k.warnings, ...o.warnings];
    if (outfield.length < slots.length - gkSlots) {
      warnings.push(`Only ${outfield.length} outfield players available for ${slots.length - gkSlots} outfield positions.`);
    }
    return { quotas: { ...k.quotas, ...o.quotas }, minPeriods: Math.min(k.minPeriods, o.minPeriods || k.minPeriods), warnings };
  }

  const r = groupQuotas({ ...common, group: players, slotsPerPeriod: slots.length, label: 'players' });
  const warnings = [...r.warnings];
  if (players.length < slots.length) warnings.push(`Only ${players.length} players available for ${slots.length} positions.`);
  if (gkSlots > 0 && keepers.length === 0) warnings.push('No goalkeeper available — an outfield player will go in goal.');
  return { ...r, warnings };
}

export function planRotation(input: PlanInput): PlanOutput {
  const { players, slots, periods, balance } = input;
  const { quotas, warnings } = computeQuotas(input);
  const n = slots.length;
  const out: (string | null)[][] = [];
  const played: Record<string, number> = {};
  players.forEach((p) => (played[p.id] = 0));
  const ovr: Record<string, number> = {};
  players.forEach((p) => (ovr[p.id] = overall(p)));
  const hasKeeper = players.some((p) => p.position === 'GK') && slots.some((x) => x.role === 'GK');

  if (players.length === 0) {
    return { periods: Array.from({ length: periods }, () => new Array(n).fill(null)), quotas, warnings };
  }

  let prev: (string | null)[] = new Array(n).fill(null);
  for (let k = 0; k < periods; k++) {
    const remaining = periods - k;
    const dummies = Math.max(0, n - players.length);
    const cols = players.length + dummies;
    const cost: number[][] = slots.map((slot, j) => {
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        if (c >= players.length) {
          row.push(1e6); // dummy = empty slot
          continue;
        }
        const p = players[c];
        const need = quotas[p.id] - played[p.id];
        const urgency = clamp(need / remaining, 0, 2);
        let score = 3 * positionFit(p, slot.role) + 4 * urgency + 3 * balance * (ovr[p.id] / 100);
        // keepers stay in goal and outfield players stay out of it, whenever a keeper exists
        if (hasKeeper) {
          if (p.position === 'GK' && slot.role !== 'GK' && p.altPosition !== slot.role) score -= 100;
          if (p.position !== 'GK' && slot.role === 'GK' && p.altPosition !== 'GK') score -= 100;
        }
        if (need >= remaining) score += 100;
        if (need <= 0) score -= 8;
        if (prev[j] === p.id) score += 0.5;
        else if (prev.includes(p.id)) score += 0.25;
        row.push(-score);
      }
      return row;
    });
    const assign = hungarian(cost);
    const period = assign.map((c) => (c >= 0 && c < players.length ? players[c].id : null));
    period.forEach((id) => {
      if (id) played[id]++;
    });
    out.push(period);
    prev = period;
  }

  const minWanted = Math.ceil((input.minPct / 100) * periods - 1e-9);
  const short = players.filter((p) => played[p.id] < Math.min(minWanted, Math.floor((n * periods) / players.length)));
  if (short.length) warnings.push(`${short.map((p) => p.name).join(', ')} below the minimum — review the plan.`);
  if (!out[0].some((id) => id !== null) && players.length) warnings.push('Could not fill the pitch.');
  return { periods: out, quotas, warnings };
}

export function minutesFromPlan(periodsPlan: (string | null)[][], matchMinutes: number): Record<string, number> {
  const per = matchMinutes / Math.max(periodsPlan.length, 1);
  const res: Record<string, number> = {};
  for (const period of periodsPlan) for (const id of period) if (id) res[id] = (res[id] ?? 0) + per;
  return res;
}

/** Diff between two lineups: which slots change and who comes on/off. */
export function diffLineups(from: (string | null)[], to: (string | null)[]) {
  const changes: { slot: number; out: string | null; in: string | null }[] = [];
  to.forEach((id, i) => {
    if ((from[i] ?? null) !== (id ?? null)) changes.push({ slot: i, out: from[i] ?? null, in: id ?? null });
  });
  return changes;
}
