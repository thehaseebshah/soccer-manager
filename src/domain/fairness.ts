import type { Club, Fixture, Player, Training } from './types';
import { mean } from './util';

export interface SeasonStat {
  player: Player;
  minutes: number;
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  /** minutes played / minutes of matches where the player was available (0..1) */
  share: number | null;
  availableMatches: number;
  attendance: number | null; // training attendance 0..1
}

export function playedFixtures(fixtures: Fixture[]): Fixture[] {
  return fixtures.filter((f) => f.status === 'played').sort((a, b) => a.date.localeCompare(b.date));
}

export function seasonMinutesMap(fixtures: Fixture[]): Record<string, number> {
  const res: Record<string, number> = {};
  for (const f of playedFixtures(fixtures)) {
    for (const [id, m] of Object.entries(f.minutes ?? {})) res[id] = (res[id] ?? 0) + m;
  }
  return res;
}

export function seasonStats(players: Player[], fixtures: Fixture[], trainings: Training[]): SeasonStat[] {
  const played = playedFixtures(fixtures);
  return players.map((player) => {
    let minutes = 0;
    let apps = 0;
    let starts = 0;
    let goals = 0;
    let assists = 0;
    let avail = 0;
    let availMinutes = 0;
    for (const f of played) {
      const m = f.minutes?.[player.id] ?? 0;
      const a = f.availability[player.id];
      if (m > 0) {
        apps++;
        minutes += m;
        if (f.starters?.includes(player.id)) starts++;
      }
      if (a === 'yes' || m > 0) {
        avail++;
        availMinutes += f.matchMinutes;
      }
      for (const e of f.events) {
        if (e.playerId !== player.id) continue;
        if (e.type === 'goal') goals++;
        else assists++;
      }
    }
    const sessions = trainings.filter((t) => player.id in t.attendance);
    const attended = sessions.filter((t) => t.attendance[player.id]).length;
    return {
      player,
      minutes,
      apps,
      starts,
      goals,
      assists,
      share: availMinutes > 0 ? minutes / availMinutes : null,
      availableMatches: avail,
      attendance: sessions.length ? attended / sessions.length : null,
    };
  });
}

export interface FairnessFlag {
  player: Player;
  share: number;
  minutes: number;
  target: number;
  missedMinutes: number;
}

/** Players who've been available but have played less than the club's minimum share. */
export function fairnessFlags(stats: SeasonStat[], club: Club): FairnessFlag[] {
  const target = club.minMinutesPct / 100;
  return stats
    .filter((s) => s.share !== null && s.availableMatches >= 2 && s.share < target && s.player.status === 'fit')
    .map((s) => ({
      player: s.player,
      share: s.share as number,
      minutes: s.minutes,
      target,
      missedMinutes: Math.max(0, Math.round(((target - (s.share as number)) * s.minutes) / Math.max(s.share as number, 0.01))),
    }))
    .sort((a, b) => a.share - b.share);
}

/** 0..100 — how evenly minutes are distributed among regular squad members (100 = perfectly even). */
export function fairnessIndex(stats: SeasonStat[]): number | null {
  const xs = stats.filter((s) => s.share !== null && s.availableMatches >= 2).map((s) => s.share as number);
  if (xs.length < 3) return null;
  const m = mean(xs);
  if (m === 0) return null;
  const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  return Math.round(Math.max(0, Math.min(1, 1 - sd / m)) * 100);
}

/** Plain-language explanation a coach can send to a parent or player. */
export function parentExplainer(opts: {
  player: Player;
  fixture: Fixture;
  stat: SeasonStat;
  club: Club;
  squadRank: number;
  squadSize: number;
}): string {
  const { player, fixture, stat, club, squadRank, squadSize } = opts;
  const first = player.name.split(' ')[0];
  const mins = Math.round(fixture.minutes?.[player.id] ?? 0);
  const pct = Math.round((mins / fixture.matchMinutes) * 100);
  const lines: string[] = [];
  lines.push(`${first} played ${mins} of ${fixture.matchMinutes} minutes (${pct}%) against ${fixture.opponent}.`);
  if (stat.share !== null) {
    lines.push(
      `Across the season ${first} has played ${Math.round(stat.minutes)} minutes — ${Math.round(stat.share * 100)}% of the time they've been available, ` +
        `ranking ${squadRank} of ${squadSize} in the squad.`,
    );
  }
  lines.push(`Our club rule is that every available player gets at least ${club.minMinutesPct}% of match time, and we rotate to protect that.`);
  if (stat.share !== null && stat.share < club.minMinutesPct / 100) {
    lines.push(`${first} is currently under that mark, so they will be prioritised in upcoming matches.`);
  }
  if (player.focus.length) lines.push(`Current development focus: ${player.focus.join(', ')}.`);
  return lines.join('\n\n');
}

export function squadRank(stats: SeasonStat[], id: string): number {
  const sorted = [...stats].sort((a, b) => b.minutes - a.minutes);
  return sorted.findIndex((s) => s.player.id === id) + 1;
}
