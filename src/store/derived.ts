import { useMemo } from 'react';
import { useClub } from './useClub';
import { DEFAULT_CLUB } from '@/domain/types';
import type { Player } from '@/domain/types';
import { fairnessFlags, fairnessIndex, seasonMinutesMap, seasonStats } from '@/domain/fairness';

/** Single place for common derived data so screens stay thin. */
export function useDerived() {
  const club = useClub((s) => s.club) ?? DEFAULT_CLUB;
  const players = useClub((s) => s.players);
  const observations = useClub((s) => s.observations);
  const fixtures = useClub((s) => s.fixtures);
  const trainings = useClub((s) => s.trainings);

  return useMemo(() => {
    const byId: Record<string, Player> = {};
    players.forEach((p) => (byId[p.id] = p));
    const stats = seasonStats(players, fixtures, trainings);
    const statById = Object.fromEntries(stats.map((s) => [s.player.id, s]));
    const seasonMinutes = seasonMinutesMap(fixtures);
    const flags = fairnessFlags(stats, club);
    const index = fairnessIndex(stats);
    const upcoming = fixtures.filter((f) => f.status !== 'played').sort((a, b) => a.date.localeCompare(b.date));
    const played = fixtures.filter((f) => f.status === 'played').sort((a, b) => b.date.localeCompare(a.date));
    return { club, players, byId, observations, fixtures, trainings, stats, statById, seasonMinutes, flags, index, upcoming, played };
  }, [club, players, observations, fixtures, trainings]);
}
