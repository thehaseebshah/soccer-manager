import { createDemoData } from '../src/domain/seed';
import { buildSlots, computeQuotas, formationsFor, hungarian, minutesFromPlan, planRotation } from '../src/domain/lineup';
import { budgetSummary, monthlyProjection, runScenario } from '../src/domain/budget';
import { fairnessFlags, seasonMinutesMap, seasonStats } from '../src/domain/fairness';
import { applyLineup, elapsedMs, finish, newLive, pause, start, substitute } from '../src/domain/live';
import { overall } from '../src/domain/ratings';

const NOW = new Date(2026, 10, 5, 12, 0, 0);

describe('hungarian', () => {
  it('finds the min-cost assignment', () => {
    const c = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    const a = hungarian(c);
    const cost = a.reduce((s, col, row) => s + c[row][col], 0);
    expect(cost).toBe(5);
    expect(new Set(a).size).toBe(3);
  });
  it('handles rectangular matrices', () => {
    const a = hungarian([
      [5, 1, 9, 9],
      [9, 9, 1, 5],
    ]);
    expect(a).toEqual([1, 2]);
  });
});

describe('formations', () => {
  it('builds the right slot count for every formation', () => {
    for (const fmt of [7, 9, 11] as const) {
      for (const f of formationsFor(fmt)) {
        expect(buildSlots(f)).toHaveLength(fmt);
        expect(buildSlots(f)[0].role).toBe('GK');
      }
    }
  });
});

describe('rotation planner', () => {
  const data = createDemoData(NOW);
  const slots = buildSlots(formationsFor(11)[0]);
  const avail = data.players.filter((p) => p.status === 'fit');

  it('fills every slot with a distinct player each period', () => {
    const plan = planRotation({ players: avail, slots, periods: 6, minPct: 30, seasonMinutes: {}, balance: 0.5 });
    expect(plan.periods).toHaveLength(6);
    for (const period of plan.periods) {
      expect(period.every((id) => id !== null)).toBe(true);
      expect(new Set(period).size).toBe(11);
    }
  });

  it('guarantees the minimum share to every available player', () => {
    for (const balance of [0, 0.5, 1]) {
      const plan = planRotation({ players: avail, slots, periods: 6, minPct: 33, seasonMinutes: {}, balance });
      const mins = minutesFromPlan(plan.periods, 90);
      for (const p of avail) expect(mins[p.id] ?? 0).toBeGreaterThanOrEqual(30 - 1e-9);
    }
  });

  it('puts goalkeepers in goal', () => {
    const plan = planRotation({ players: avail, slots, periods: 6, minPct: 30, seasonMinutes: {}, balance: 0.5 });
    for (const period of plan.periods) {
      const gk = avail.find((p) => p.id === period[0]);
      expect(gk?.position).toBe('GK');
    }
  });

  it('keepers share the goal and never play outfield; outfield players never go in goal', () => {
    const plan = planRotation({ players: avail, slots, periods: 6, minPct: 30, seasonMinutes: {}, balance: 0.5 });
    const byId = Object.fromEntries(avail.map((p) => [p.id, p]));
    let keeperWindows = 0;
    for (const period of plan.periods) {
      period.forEach((id, j) => {
        const p = byId[id as string];
        if (slots[j].role === 'GK') {
          expect(p.position).toBe('GK');
          keeperWindows++;
        } else {
          expect(p.position).not.toBe('GK');
        }
      });
    }
    expect(keeperWindows).toBe(6);
    const mins = minutesFromPlan(plan.periods, 90);
    avail.filter((p) => p.position === 'GK').forEach((g) => expect(mins[g.id]).toBeGreaterThanOrEqual(30));
  });

  it('gives under-used players more time (catch-up fairness)', () => {
    const season: Record<string, number> = {};
    avail.forEach((p) => (season[p.id] = 600));
    const low = avail[avail.length - 1];
    season[low.id] = 0;
    const fair = computeQuotas({ players: avail, slots, periods: 6, minPct: 0, seasonMinutes: season, balance: 0 });
    const neutral = computeQuotas({ players: avail, slots, periods: 6, minPct: 0, seasonMinutes: {}, balance: 0 });
    expect(fair.quotas[low.id]).toBeGreaterThanOrEqual(neutral.quotas[low.id]);
    expect(Object.values(fair.quotas).reduce((a, b) => a + b, 0)).toBe(66);
  });

  it('competitive mode gives stronger players more time than development mode', () => {
    const best = [...avail].sort((a, b) => overall(b) - overall(a))[0];
    const dev = computeQuotas({ players: avail, slots, periods: 6, minPct: 0, seasonMinutes: {}, balance: 0 });
    const comp = computeQuotas({ players: avail, slots, periods: 6, minPct: 0, seasonMinutes: {}, balance: 1 });
    expect(comp.quotas[best.id]).toBeGreaterThanOrEqual(dev.quotas[best.id]);
  });

  it('warns when the minimum is infeasible', () => {
    const fewSlots = buildSlots(formationsFor(11)[0]);
    const many = Array.from({ length: 20 }, (_, i) => ({ ...avail[i % avail.length], id: `x${i}` }));
    const plan = planRotation({ players: many, slots: fewSlots, periods: 6, minPct: 90, seasonMinutes: {}, balance: 0.5 });
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it('copes with too few players', () => {
    const plan = planRotation({ players: avail.slice(0, 8), slots, periods: 4, minPct: 30, seasonMinutes: {}, balance: 0.5 });
    expect(plan.periods[0].filter(Boolean)).toHaveLength(8);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });
});

describe('budget', () => {
  const data = createDemoData(NOW);
  const club = data.club!;

  it('summarises committed wages under budget', () => {
    const s = budgetSummary(data.players, club, NOW);
    expect(s.annualCommitted).toBeGreaterThan(0);
    expect(s.utilisation).toBeGreaterThan(0.8);
    expect(s.utilisation).toBeLessThan(1);
  });

  it('projects wages falling as contracts expire', () => {
    const proj = monthlyProjection(data.players, club, NOW, 36);
    expect(proj[35].committed).toBeLessThan(proj[0].committed);
  });

  it('scenario: releasing a player reduces the bill and adds a payoff', () => {
    const p = data.players[2];
    const res = runScenario(data.players, club, [{ type: 'release', playerId: p.id, payoffPct: 50 }], NOW);
    expect(res.after.annualCommitted).toBe(res.before.annualCommitted - (p.contract?.annualWage ?? 0));
    expect(res.oneOffCost).toBeGreaterThan(0);
  });

  it('scenario: releasing both goalkeepers warns', () => {
    const gks = data.players.filter((p) => p.position === 'GK');
    const res = runScenario(data.players, club, gks.map((g) => ({ type: 'release' as const, playerId: g.id, payoffPct: 0 })), NOW);
    expect(res.warnings.some((w) => /goalkeeper/i.test(w))).toBe(true);
  });

  it('scenario: an expensive signing can push over budget', () => {
    const res = runScenario(data.players, club, [{ type: 'sign', name: 'Star', position: 'FWD', age: 25, rating: 85, annualWage: club.annualWageBudget, years: 2, fee: 0 }], NOW);
    expect(res.after.utilisation).toBeGreaterThan(1);
    expect(res.warnings.some((w) => /budget/i.test(w))).toBe(true);
  });
});

describe('fairness over a season', () => {
  const data = createDemoData(NOW);
  it('aggregates minutes and flags under-used players', () => {
    const mins = seasonMinutesMap(data.fixtures);
    expect(Object.keys(mins).length).toBeGreaterThan(10);
    const stats = seasonStats(data.players, data.fixtures, data.trainings);
    const flags = fairnessFlags(stats, data.club!);
    // a "best XI" coach with no minimum rule should leave somebody under 30%
    expect(flags.length).toBeGreaterThan(0);
  });
});

describe('live match', () => {
  it('tracks minutes through a substitution', () => {
    let l = newLive(['a', 'b']);
    l = start(l, 0);
    l = substitute(l, 1, 'c', 10 * 60000);
    const { minutes } = finish(l, 30 * 60000);
    expect(minutes).toEqual({ a: 30, b: 10, c: 20 });
  });

  it('pause stops the clock', () => {
    let l = start(newLive(['a']), 1000);
    l = pause(l, 61000);
    expect(elapsedMs(l, 999999)).toBe(60000);
  });

  it('applyLineup keeps clocks for players who stay on', () => {
    let l = start(newLive(['a', 'b']), 0);
    l = applyLineup(l, ['a', 'c'], 15 * 60000);
    const { minutes } = finish(l, 45 * 60000);
    expect(minutes.a).toBe(45);
    expect(minutes.b).toBe(15);
    expect(minutes.c).toBe(30);
  });
});

describe('demo data', () => {
  it('has enough confirmed players for the next fixture to be fully staffed', () => {
    const d = createDemoData(NOW);
    const next = d.fixtures.filter((f) => f.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date))[0];
    const yes = d.players.filter((p) => p.status === 'fit' && next.availability[p.id] === 'yes').length;
    expect(yes).toBeGreaterThanOrEqual(13);
  });
});
