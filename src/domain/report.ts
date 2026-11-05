import type { Club, Observation, Player, Skill } from './types';
import { SKILLS } from './types';
import type { SeasonStat } from './fairness';
import { SKILL_LABEL, focusProgress, observationsFor, overall, overallOfRatings } from './ratings';
import { ageOn, formatDate } from './util';

/** A shareable, plain-text progress report for a player / parent. */
export function playerReport(opts: { player: Player; club: Club; stat?: SeasonStat; observations: Observation[]; on: Date; rank?: number; squadSize?: number }): string {
  const { player, club, stat, observations, on, rank, squadSize } = opts;
  const first = player.name.split(' ')[0];
  const hist = observationsFor(observations, player.id);
  const lines: string[] = [];
  lines.push(`${player.name} — progress report`);
  lines.push(`${club.name} · ${formatDate(on.toISOString().slice(0, 10))}`);
  lines.push('');
  lines.push(`Position: ${player.position}${player.altPosition ? ` / ${player.altPosition}` : ''} · Age ${ageOn(player.dob, on)} · Overall ${overall(player)}`);

  if (hist.length >= 2) {
    const start = overallOfRatings(hist[0].ratings, player.position);
    const delta = overall(player) - start;
    lines.push(`Since ${formatDate(hist[0].date)}: ${delta >= 0 ? '+' : ''}${delta} overall.`);
  }

  if (stat) {
    lines.push('');
    lines.push('Playing time');
    lines.push(`• ${stat.apps} appearances, ${Math.round(stat.minutes)} minutes${stat.starts ? `, ${stat.starts} starts` : ''}`);
    if (stat.share !== null) {
      lines.push(`• ${Math.round(stat.share * 100)}% of available match time (club rule: at least ${club.minMinutesPct}%)`);
    }
    if (rank && squadSize) lines.push(`• ${rank} of ${squadSize} in the squad for minutes`);
    if (stat.goals || stat.assists) lines.push(`• ${stat.goals} goals, ${stat.assists} assists`);
    if (stat.attendance !== null) lines.push(`• Training attendance: ${Math.round(stat.attendance * 100)}%`);
  }

  const ranked = (SKILLS as readonly Skill[])
    .filter((s) => s !== 'goalkeeping' || player.position === 'GK')
    .map((s) => ({ s, v: player.ratings[s] }))
    .sort((a, b) => b.v - a.v);
  lines.push('');
  lines.push('Strengths');
  ranked.slice(0, 2).forEach((x) => lines.push(`• ${SKILL_LABEL[x.s]} (${x.v}/10)`));
  lines.push('Areas to grow');
  ranked.slice(-2).reverse().forEach((x) => lines.push(`• ${SKILL_LABEL[x.s]} (${x.v}/10)`));

  if (player.focus.length) {
    lines.push('');
    lines.push('Current focus');
    for (const s of player.focus) {
      const pr = focusProgress(player, observations, s);
      const target = player.focusTargets[s];
      lines.push(`• ${SKILL_LABEL[s]}: ${player.ratings[s]}/10${target ? ` → target ${target}` : ''}${pr !== null ? ` (${Math.round(pr * 100)}% there)` : ''}`);
    }
  }

  const last = hist[hist.length - 1];
  if (last?.note) {
    lines.push('');
    lines.push(`Coach’s note (${formatDate(last.date)})`);
    lines.push(last.note);
  }
  lines.push('');
  lines.push(`— Keep it up, ${first}!`);
  return lines.join('\n');
}
