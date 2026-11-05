import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData, Availability, Club, Fixture, LiveState, MatchEvent, Observation, Player, Ratings, Training } from '@/domain/types';
import { DEFAULT_CLUB } from '@/domain/types';
import { createDemoData } from '@/domain/seed';
import { toISODate, uid } from '@/domain/util';

interface Actions {
  createClub: (club: Club) => void;
  updateClub: (patch: Partial<Club>) => void;
  loadDemo: () => void;
  resetAll: () => void;
  importData: (json: string) => { ok: boolean; error?: string };
  exportData: () => string;

  savePlayer: (p: Omit<Player, 'id'> & { id?: string }, baseline?: boolean) => string;
  deletePlayer: (id: string) => void;
  addObservation: (o: { playerId: string; ratings: Ratings; note: string; kind: Observation['kind']; date?: string }) => void;

  saveFixture: (f: Partial<Fixture> & Pick<Fixture, 'opponent' | 'date'>) => string;
  deleteFixture: (id: string) => void;
  setAvailability: (fixtureId: string, playerId: string, a: Availability) => void;
  setPlan: (fixtureId: string, periods: (string | null)[][], balance: number) => void;
  setLive: (fixtureId: string, live: LiveState | undefined, status?: Fixture['status']) => void;
  addEvent: (fixtureId: string, e: Omit<MatchEvent, 'id'>) => void;
  removeEvent: (fixtureId: string, eventId: string) => void;
  completeFixture: (fixtureId: string, data: { minutes: Record<string, number>; result: { for: number; against: number }; starters: string[]; live?: LiveState }) => void;

  saveTraining: (t: Partial<Training> & Pick<Training, 'date'>) => string;
  setAttendance: (trainingId: string, playerId: string, present: boolean) => void;
  deleteTraining: (id: string) => void;
}

export type Store = AppData & Actions & { hydrated: boolean };

const empty: AppData = { club: undefined, players: [], observations: [], fixtures: [], trainings: [] };

export const useClub = create<Store>()(
  persist(
    (set, get) => ({
      ...empty,
      hydrated: false,

      createClub: (club) => set({ club }),
      updateClub: (patch) => set((s) => ({ club: { ...(s.club ?? DEFAULT_CLUB), ...patch } })),
      loadDemo: () => set({ ...createDemoData(new Date()) }),
      resetAll: () => set({ ...empty }),

      importData: (json) => {
        try {
          const d = JSON.parse(json) as Partial<AppData>;
          if (!d || typeof d !== 'object' || !Array.isArray(d.players) || !d.club) {
            return { ok: false, error: 'This does not look like a Gaffer backup.' };
          }
          set({
            club: d.club,
            players: d.players,
            observations: d.observations ?? [],
            fixtures: d.fixtures ?? [],
            trainings: d.trainings ?? [],
          });
          return { ok: true };
        } catch {
          return { ok: false, error: 'Could not read that text as JSON.' };
        }
      },
      exportData: () => {
        const { club, players, observations, fixtures, trainings } = get();
        return JSON.stringify({ app: 'gaffer', version: 1, club, players, observations, fixtures, trainings }, null, 2);
      },

      savePlayer: (p, baseline) => {
        const id = p.id ?? uid();
        set((s) => {
          const exists = s.players.some((x) => x.id === id);
          const player = { ...p, id } as Player;
          const players = exists ? s.players.map((x) => (x.id === id ? player : x)) : [...s.players, player];
          const observations =
            !exists || baseline
              ? [
                  ...s.observations,
                  { id: uid(), playerId: id, date: toISODate(new Date()), kind: 'baseline' as const, ratings: player.ratings, note: 'Baseline assessment.' },
                ]
              : s.observations;
          return { players, observations };
        });
        return id;
      },
      deletePlayer: (id) =>
        set((s) => ({
          players: s.players.filter((p) => p.id !== id),
          observations: s.observations.filter((o) => o.playerId !== id),
        })),

      addObservation: ({ playerId, ratings, note, kind, date }) =>
        set((s) => ({
          observations: [...s.observations, { id: uid(), playerId, date: date ?? toISODate(new Date()), kind, ratings, note }],
          players: s.players.map((p) => (p.id === playerId ? { ...p, ratings } : p)),
        })),

      saveFixture: (f) => {
        const id = f.id ?? uid();
        set((s) => {
          const club = s.club ?? DEFAULT_CLUB;
          const existing = s.fixtures.find((x) => x.id === id);
          const merged: Fixture = {
            home: true,
            format: club.defaultFormat,
            formationId: '',
            periods: club.periods,
            matchMinutes: club.matchMinutes,
            status: 'scheduled',
            availability: {},
            events: [],
            ...existing,
            ...f,
            id,
          } as Fixture;
          return { fixtures: existing ? s.fixtures.map((x) => (x.id === id ? merged : x)) : [...s.fixtures, merged] };
        });
        return id;
      },
      deleteFixture: (id) => set((s) => ({ fixtures: s.fixtures.filter((f) => f.id !== id) })),
      setAvailability: (fixtureId, playerId, a) =>
        set((s) => ({
          fixtures: s.fixtures.map((f) => (f.id === fixtureId ? { ...f, availability: { ...f.availability, [playerId]: a } } : f)),
        })),
      setPlan: (fixtureId, periods, balance) =>
        set((s) => ({
          fixtures: s.fixtures.map((f) =>
            f.id === fixtureId ? { ...f, plan: { periods, balance, generatedAt: new Date().toISOString() } } : f,
          ),
        })),
      setLive: (fixtureId, live, status) =>
        set((s) => ({
          fixtures: s.fixtures.map((f) => (f.id === fixtureId ? { ...f, live, status: status ?? f.status } : f)),
        })),
      addEvent: (fixtureId, e) =>
        set((s) => ({
          fixtures: s.fixtures.map((f) => (f.id === fixtureId ? { ...f, events: [...f.events, { ...e, id: uid() }] } : f)),
        })),
      removeEvent: (fixtureId, eventId) =>
        set((s) => ({
          fixtures: s.fixtures.map((f) => (f.id === fixtureId ? { ...f, events: f.events.filter((e) => e.id !== eventId) } : f)),
        })),
      completeFixture: (fixtureId, data) =>
        set((s) => ({
          fixtures: s.fixtures.map((f) =>
            f.id === fixtureId
              ? { ...f, status: 'played' as const, minutes: data.minutes, result: data.result, starters: data.starters, live: data.live }
              : f,
          ),
        })),

      saveTraining: (t) => {
        const id = t.id ?? uid();
        set((s) => {
          const existing = s.trainings.find((x) => x.id === id);
          const merged: Training = { attendance: {}, ...existing, ...t, id } as Training;
          return { trainings: existing ? s.trainings.map((x) => (x.id === id ? merged : x)) : [...s.trainings, merged] };
        });
        return id;
      },
      setAttendance: (trainingId, playerId, present) =>
        set((s) => ({
          trainings: s.trainings.map((t) => (t.id === trainingId ? { ...t, attendance: { ...t.attendance, [playerId]: present } } : t)),
        })),
      deleteTraining: (id) => set((s) => ({ trainings: s.trainings.filter((t) => t.id !== id) })),
    }),
    {
      name: 'gaffer-data-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (s) => ({
        club: s.club,
        players: s.players,
        observations: s.observations,
        fixtures: s.fixtures,
        trainings: s.trainings,
      }),
      onRehydrateStorage: () => () => {
        useClub.setState({ hydrated: true });
      },
    },
  ),
);
