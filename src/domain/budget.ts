import type { Club, Format, Player, PosGroup } from './types';
import { addMonths, ageOn, daysBetween, parseDate, toISODate } from './util';
import { overall, projectOverall } from './ratings';

export function annualWageAt(p: Player, on: Date): number {
  const c = p.contract;
  if (!c) return 0;
  const t = toISODate(on);
  return t >= c.start && t <= c.end ? c.annualWage : 0;
}

export interface BudgetMonth {
  month: string; // YYYY-MM
  date: Date;
  committed: number; // monthly wage bill
  budget: number; // monthly budget
  headroom: number;
}

/** Month-by-month wage bill vs budget; contracts roll off as they expire. */
export function monthlyProjection(players: Player[], club: Club, from: Date, months = 24): BudgetMonth[] {
  const out: BudgetMonth[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = 0; i < months; i++) {
    const d = addMonths(start, i);
    // evaluate mid-month so contracts ending/starting inside the month count fairly
    const mid = new Date(d.getFullYear(), d.getMonth(), 15);
    const committed = players.reduce((s, p) => s + annualWageAt(p, mid), 0) / 12;
    const budget = club.annualWageBudget / 12;
    out.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      date: d,
      committed,
      budget,
      headroom: budget - committed,
    });
  }
  return out;
}

export interface BudgetSummary {
  annualCommitted: number;
  annualBudget: number;
  headroom: number;
  utilisation: number; // 0..>1
  playersOnContract: number;
  avgWage: number;
}

export function budgetSummary(players: Player[], club: Club, on: Date): BudgetSummary {
  const wages = players.map((p) => annualWageAt(p, on));
  const annualCommitted = wages.reduce((a, b) => a + b, 0);
  const contracted = wages.filter((w) => w > 0).length;
  return {
    annualCommitted,
    annualBudget: club.annualWageBudget,
    headroom: club.annualWageBudget - annualCommitted,
    utilisation: club.annualWageBudget > 0 ? annualCommitted / club.annualWageBudget : 0,
    playersOnContract: contracted,
    avgWage: contracted ? annualCommitted / contracted : 0,
  };
}

export type ContractFlag = 'expired' | 'critical' | 'soon' | 'ok' | 'none';

export function contractFlag(p: Player, on: Date): { flag: ContractFlag; daysLeft: number | null } {
  if (!p.contract) return { flag: 'none', daysLeft: null };
  const daysLeft = daysBetween(on, parseDate(p.contract.end));
  if (daysLeft < 0) return { flag: 'expired', daysLeft };
  if (daysLeft <= 90) return { flag: 'critical', daysLeft };
  if (daysLeft <= 180) return { flag: 'soon', daysLeft };
  return { flag: 'ok', daysLeft };
}

export interface RetentionRisk {
  player: Player;
  daysLeft: number;
  ovr: number;
  score: number; // higher = more urgent
}

/** Good players with short contracts — the ones you can't afford to lose by accident. */
export function retentionRisks(players: Player[], on: Date): RetentionRisk[] {
  const ovrs = players.map(overall);
  const avg = ovrs.reduce((a, b) => a + b, 0) / Math.max(ovrs.length, 1);
  return players
    .map((p) => {
      const { daysLeft } = contractFlag(p, on);
      return { player: p, daysLeft, ovr: overall(p) };
    })
    .filter((r): r is { player: Player; daysLeft: number; ovr: number } => r.daysLeft !== null && r.daysLeft <= 270)
    .map((r) => ({
      ...r,
      score: Math.max(0, r.ovr - avg + 10) * (1 - Math.max(0, r.daysLeft) / 300),
    }))
    .sort((a, b) => b.score - a.score);
}

/** Ideal squad shape per match format. */
export const SQUAD_NEEDS: Record<Format, Record<PosGroup, number>> = {
  11: { GK: 2, DEF: 6, MID: 6, FWD: 4 },
  9: { GK: 2, DEF: 4, MID: 5, FWD: 3 },
  7: { GK: 2, DEF: 3, MID: 4, FWD: 2 },
};

export function depthChart(players: Player[], format: Format) {
  const needs = SQUAD_NEEDS[format];
  return (Object.keys(needs) as PosGroup[]).map((pos) => {
    const have = players.filter((p) => p.position === pos).length;
    return { pos, have, need: needs[pos], gap: have - needs[pos] };
  });
}

// ---------------------------------------------------------------- scenarios

export type ScenarioOp =
  | { type: 'release'; playerId: string; payoffPct: number }
  | { type: 'renew'; playerId: string; newAnnualWage: number; years: number }
  | {
      type: 'sign';
      name: string;
      position: PosGroup;
      age: number;
      rating: number; // 0..100 overall
      annualWage: number;
      years: number;
      fee: number;
    };

export interface ScenarioResult {
  before: ReturnType<typeof budgetSummary>;
  after: ReturnType<typeof budgetSummary>;
  oneOffCost: number;
  firstYearImpact: number; // after.annualCommitted - before.annualCommitted
  warnings: string[];
  depthAfter: ReturnType<typeof depthChart>;
  squadAfter: Player[];
  projectionAfter: BudgetMonth[];
  avgOverallBefore: number;
  avgOverallAfter: number;
}

export function runScenario(players: Player[], club: Club, ops: ScenarioOp[], on: Date): ScenarioResult {
  let squad = players.map((p) => ({ ...p }));
  let oneOff = 0;
  const warnings: string[] = [];

  for (const op of ops) {
    if (op.type === 'release') {
      const p = squad.find((x) => x.id === op.playerId);
      if (!p) continue;
      if (p.contract) {
        const remaining = Math.max(0, daysBetween(on, parseDate(p.contract.end))) / 365;
        oneOff += p.contract.annualWage * remaining * (op.payoffPct / 100);
      }
      squad = squad.filter((x) => x.id !== op.playerId);
    } else if (op.type === 'renew') {
      squad = squad.map((p) =>
        p.id === op.playerId
          ? {
              ...p,
              contract: {
                annualWage: op.newAnnualWage,
                start: toISODate(on),
                end: toISODate(addMonths(on, Math.round(op.years * 12))),
              },
            }
          : p,
      );
    } else {
      oneOff += op.fee;
      const dob = new Date(on.getFullYear() - op.age, on.getMonth(), on.getDate());
      const r = Math.max(1, Math.min(10, op.rating / 10));
      squad.push({
        id: `scn-${squad.length}-${op.name}`,
        name: op.name || 'New signing',
        dob: toISODate(dob),
        position: op.position,
        foot: 'R',
        status: 'fit',
        contract: {
          annualWage: op.annualWage,
          start: toISODate(on),
          end: toISODate(addMonths(on, Math.round(op.years * 12))),
        },
        ratings: {
          pace: r,
          stamina: r,
          technique: r,
          passing: r,
          attacking: r,
          defending: r,
          mentality: r,
          goalkeeping: r,
        },
        focus: [],
        focusTargets: {},
      });
    }
  }

  const before = budgetSummary(players, club, on);
  const after = budgetSummary(squad, club, on);
  const depthAfter = depthChart(squad, club.defaultFormat);
  for (const d of depthAfter) {
    if (d.pos === 'GK' && d.have < 2) warnings.push(`Only ${d.have} goalkeeper${d.have === 1 ? '' : 's'} left — you need at least 2.`);
    else if (d.gap < -1) warnings.push(`${d.pos} depth is ${-d.gap} short of the ideal squad shape.`);
  }
  if (after.utilisation > 1) warnings.push(`Wage bill exceeds budget by ${Math.round((after.utilisation - 1) * 100)}%.`);
  else if (after.utilisation > 0.95) warnings.push('Less than 5% wage headroom left.');
  if (squad.length < club.defaultFormat + 3) warnings.push('Squad is too small to rotate fairly.');

  const projectionAfter = monthlyProjection(squad, club, on, 24);
  const firstOverBudget = projectionAfter.find((m) => m.headroom < -1);
  if (firstOverBudget && after.utilisation <= 1) warnings.push(`Projected to go over budget in ${firstOverBudget.month}.`);

  const avg = (xs: Player[]) => (xs.length ? Math.round(xs.reduce((s, p) => s + overall(p), 0) / xs.length) : 0);
  return {
    before,
    after,
    oneOffCost: oneOff,
    firstYearImpact: after.annualCommitted - before.annualCommitted,
    warnings,
    depthAfter,
    squadAfter: squad,
    projectionAfter,
    avgOverallBefore: avg(players),
    avgOverallAfter: avg(squad),
  };
}

export function squadAgeProfile(players: Player[], on: Date) {
  const buckets = { 'U19': 0, '19–23': 0, '24–29': 0, '30+': 0 };
  for (const p of players) {
    const a = ageOn(p.dob, on);
    if (a < 19) buckets['U19']++;
    else if (a <= 23) buckets['19–23']++;
    else if (a <= 29) buckets['24–29']++;
    else buckets['30+']++;
  }
  return buckets;
}

/** Squad strength today vs in two years given aging heuristics. */
export function strengthOutlook(players: Player[], on: Date) {
  const now = players.length ? players.reduce((s, p) => s + overall(p), 0) / players.length : 0;
  const in2 = players.length ? players.reduce((s, p) => s + projectOverall(p, 2, on), 0) / players.length : 0;
  return { now: Math.round(now), in2: Math.round(in2) };
}
