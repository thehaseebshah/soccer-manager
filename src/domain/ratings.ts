import { ageOn, clamp, mean } from './util';
import type { Observation, Player, PosGroup, Ratings, Skill } from './types';
import { SKILLS } from './types';

const W: Record<PosGroup, Record<Skill, number>> = {
  GK: { pace: 1, stamina: 2, technique: 1, passing: 2, attacking: 0, defending: 2, mentality: 3, goalkeeping: 9 },
  DEF: { pace: 3, stamina: 3, technique: 2, passing: 2, attacking: 1, defending: 6, mentality: 3, goalkeeping: 0 },
  MID: { pace: 2, stamina: 4, technique: 4, passing: 5, attacking: 3, defending: 3, mentality: 3, goalkeeping: 0 },
  FWD: { pace: 4, stamina: 2, technique: 4, passing: 2, attacking: 6, defending: 1, mentality: 3, goalkeeping: 0 },
};

export const SKILL_LABEL: Record<Skill, string> = {
  pace: 'Pace',
  stamina: 'Stamina',
  technique: 'Technique',
  passing: 'Passing',
  attacking: 'Attacking',
  defending: 'Defending',
  mentality: 'Mentality',
  goalkeeping: 'Goalkeeping',
};

export function blankRatings(v = 5): Ratings {
  return Object.fromEntries(SKILLS.map((s) => [s, v])) as Ratings;
}

/** Position-weighted overall on a 0..100 scale. */
export function overall(p: Pick<Player, 'ratings' | 'position'>): number {
  const w = W[p.position];
  let sum = 0;
  let tot = 0;
  for (const s of SKILLS) {
    sum += p.ratings[s] * w[s];
    tot += w[s];
  }
  return Math.round((sum / tot) * 10);
}

export function overallOfRatings(r: Ratings, position: PosGroup): number {
  return overall({ ratings: r, position });
}

/** Skills that matter for a position (weight >= 3), used to suggest focus areas. */
export function relevantSkills(position: PosGroup): Skill[] {
  return SKILLS.filter((s) => W[position][s] >= 3);
}

/** Expected yearly change (on the 1..10 skill scale) by age — a heuristic, not a prediction. */
export function expectedYearlyGrowth(age: number): number {
  if (age <= 12) return 0.9;
  if (age === 13) return 0.8;
  if (age === 14) return 0.7;
  if (age === 15) return 0.6;
  if (age === 16) return 0.5;
  if (age === 17) return 0.45;
  if (age === 18) return 0.4;
  if (age === 19) return 0.35;
  if (age <= 22) return 0.25;
  if (age <= 26) return 0.1;
  if (age <= 29) return 0;
  if (age <= 32) return -0.15;
  return -0.3;
}

/** Heuristic projection of overall (0..100) `years` ahead from `on`. */
export function projectOverall(p: Player, years: number, on: Date): number {
  let age = ageOn(p.dob, on);
  let r = overall(p);
  for (let i = 0; i < years; i++) {
    r += expectedYearlyGrowth(age) * 10 * 0.8;
    age++;
  }
  return Math.round(clamp(r, 0, 100));
}

export function observationsFor(obs: Observation[], playerId: string): Observation[] {
  return obs.filter((o) => o.playerId === playerId).sort((a, b) => a.date.localeCompare(b.date));
}

/** Overall history for a player: one point per observation. */
export function overallHistory(obs: Observation[], p: Player): { date: string; value: number }[] {
  return observationsFor(obs, p.id).map((o) => ({ date: o.date, value: overallOfRatings(o.ratings, p.position) }));
}

/** Change in overall between the first observation within the last `days` and now. */
export function recentDelta(obs: Observation[], p: Player, days: number, today: Date): number {
  const hist = observationsFor(obs, p.id);
  if (hist.length < 2) return 0;
  const cutoff = new Date(today.getTime() - days * 86400000).toISOString().slice(0, 10);
  const before = [...hist].reverse().find((o) => o.date <= cutoff) ?? hist[0];
  return overallOfRatings(hist[hist.length - 1].ratings, p.position) - overallOfRatings(before.ratings, p.position);
}

/** Squad-wide average per skill, only counting players whose position weights that skill. */
export function squadSkillAverages(players: Player[]): { skill: Skill; avg: number }[] {
  return SKILLS.filter((s) => s !== 'goalkeeping').map((skill) => ({
    skill,
    avg: mean(players.filter((p) => p.position !== 'GK').map((p) => p.ratings[skill])),
  }));
}

/** Progress toward a focus target, 0..1. */
export function focusProgress(p: Player, obs: Observation[], skill: Skill): number | null {
  const target = p.focusTargets[skill];
  if (!target) return null;
  const hist = observationsFor(obs, p.id);
  const start = hist.length ? hist[0].ratings[skill] : p.ratings[skill];
  if (target <= start) return p.ratings[skill] >= target ? 1 : 0;
  return clamp((p.ratings[skill] - start) / (target - start), 0, 1);
}
