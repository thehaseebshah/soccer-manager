import type { LiveState } from './types';

export function newLive(startingSlots: (string | null)[]): LiveState {
  return {
    status: 'idle',
    clockMs: 0,
    resumedAt: null,
    slots: [...startingSlots],
    enteredAt: {},
    accruedMs: {},
    periodIndex: 0,
  };
}

export function elapsedMs(live: LiveState, now: number): number {
  return live.clockMs + (live.status === 'running' && live.resumedAt != null ? now - live.resumedAt : 0);
}

function clone(l: LiveState): LiveState {
  return { ...l, slots: [...l.slots], enteredAt: { ...l.enteredAt }, accruedMs: { ...l.accruedMs }, starters: l.starters ? [...l.starters] : undefined };
}

export function start(live: LiveState, now: number): LiveState {
  const l = clone(live);
  if (l.status === 'running' || l.status === 'done') return l;
  if (!l.starters) l.starters = l.slots.filter((x): x is string => !!x);
  l.status = 'running';
  l.resumedAt = now;
  // everyone on the pitch enters at the current clock
  for (const id of l.slots) if (id && l.enteredAt[id] === undefined) l.enteredAt[id] = l.clockMs;
  return l;
}

export function pause(live: LiveState, now: number): LiveState {
  if (live.status !== 'running') return live;
  const l = clone(live);
  l.clockMs = elapsedMs(live, now);
  l.status = 'paused';
  l.resumedAt = null;
  return l;
}

function leave(l: LiveState, id: string, at: number) {
  const since = l.enteredAt[id];
  if (since !== undefined) {
    l.accruedMs[id] = (l.accruedMs[id] ?? 0) + Math.max(0, at - since);
    delete l.enteredAt[id];
  }
}

/** Replace the whole lineup (e.g. planned sub window). Players staying on keep their clock. */
export function applyLineup(live: LiveState, next: (string | null)[], now: number, periodIndex?: number): LiveState {
  const l = clone(live);
  const at = elapsedMs(live, now);
  const before = new Set(l.slots.filter(Boolean) as string[]);
  const after = new Set(next.filter(Boolean) as string[]);
  before.forEach((id) => {
    if (!after.has(id)) leave(l, id, at);
  });
  after.forEach((id) => {
    if (!before.has(id)) l.enteredAt[id] = at;
  });
  l.slots = [...next];
  if (periodIndex !== undefined) l.periodIndex = periodIndex;
  return l;
}

/** Single substitution into a slot. */
export function substitute(live: LiveState, slot: number, incoming: string, now: number): LiveState {
  const next = [...live.slots];
  const existing = next.indexOf(incoming);
  if (existing >= 0) {
    // swap positions of two on-pitch players
    next[existing] = next[slot];
    next[slot] = incoming;
    return applyLineup(live, next, now);
  }
  next[slot] = incoming;
  return applyLineup(live, next, now);
}

export function finish(live: LiveState, now: number): { live: LiveState; minutes: Record<string, number> } {
  const l = clone(live);
  const at = elapsedMs(live, now);
  for (const id of Object.keys(l.enteredAt)) leave(l, id, at);
  l.clockMs = at;
  l.status = 'done';
  l.resumedAt = null;
  const minutes: Record<string, number> = {};
  for (const [id, ms] of Object.entries(l.accruedMs)) minutes[id] = Math.round((ms / 60000) * 10) / 10;
  return { live: l, minutes };
}

/** Minutes a player has so far, including time on pitch right now. */
export function liveMinutes(live: LiveState, id: string, now: number): number {
  const at = elapsedMs(live, now);
  let ms = live.accruedMs[id] ?? 0;
  if (live.enteredAt[id] !== undefined) ms += Math.max(0, at - live.enteredAt[id]);
  return ms / 60000;
}

export function clockLabel(ms: number): string {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss < 10 ? '0' : ''}${ss}`;
}

/** Plan period boundaries in ms for a match. */
export function periodBoundaryMs(periods: number, matchMinutes: number, index: number): number {
  return (matchMinutes * 60000 * index) / periods;
}
