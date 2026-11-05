import type { AppData, Club, Fixture, Observation, Player, PosGroup, Ratings, Skill, Training } from './types';
import { SKILLS } from './types';
import { buildSlots, formationsFor, minutesFromPlan, planRotation } from './lineup';
import { overall, overallOfRatings } from './ratings';
import { addDays, addMonths, ageOn, clamp, toISODate, toISODateTime, uid } from './util';

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROSTER: { name: string; pos: PosGroup; alt?: PosGroup; skill: number }[] = [
  { name: 'Jamie Cole', pos: 'GK', skill: 7 },
  { name: 'Ollie Barnes', pos: 'GK', skill: 5.5 },
  { name: 'Marcus Reid', pos: 'DEF', skill: 7 },
  { name: 'Tom Whitfield', pos: 'DEF', skill: 6.8 },
  { name: 'Kyle Anderson', pos: 'DEF', alt: 'MID', skill: 6.4 },
  { name: 'Danny Okafor', pos: 'DEF', skill: 6.1 },
  { name: 'Ben Hargreaves', pos: 'DEF', skill: 5.4 },
  { name: 'Sam Patel', pos: 'DEF', alt: 'MID', skill: 5.0 },
  { name: 'Luca Romano', pos: 'MID', skill: 7.4 },
  { name: 'Jack Thornton', pos: 'MID', alt: 'FWD', skill: 6.9 },
  { name: 'Ethan Walsh', pos: 'MID', skill: 6.3 },
  { name: 'Reece Dawson', pos: 'MID', alt: 'DEF', skill: 5.8 },
  { name: 'Mo Hassan', pos: 'MID', skill: 5.3 },
  { name: 'Finn Gallagher', pos: 'MID', skill: 4.9 },
  { name: 'Callum Fraser', pos: 'FWD', skill: 7.6 },
  { name: 'Jordan Blake', pos: 'FWD', alt: 'MID', skill: 6.6 },
  { name: 'Tyrese Campbell', pos: 'FWD', skill: 6.0 },
  { name: 'Harry Doyle', pos: 'FWD', skill: 5.2 },
  { name: 'Noah Kingsley', pos: 'FWD', alt: 'MID', skill: 4.8 },
];

const PRIMARY: Record<PosGroup, Skill[]> = {
  GK: ['goalkeeping', 'mentality'],
  DEF: ['defending', 'stamina', 'mentality'],
  MID: ['passing', 'technique', 'stamina'],
  FWD: ['attacking', 'pace', 'technique'],
};

export function createDemoData(now = new Date()): AppData {
  const rand = rng(20260);
  const club: Club = {
    name: 'Northgate United',
    currency: '£',
    annualWageBudget: 0,
    defaultFormat: 11,
    matchMinutes: 90,
    periods: 6,
    minMinutesPct: 30,
    balance: 0.5,
    level: 'semi-pro',
  };

  const players: Player[] = [];
  const observations: Observation[] = [];

  ROSTER.forEach((r, i) => {
    const age = 17 + Math.floor(rand() * 17);
    const dob = toISODate(new Date(now.getFullYear() - age, Math.floor(rand() * 12), 1 + Math.floor(rand() * 27)));
    const ratings = {} as Ratings;
    for (const s of SKILLS) {
      let base = r.skill + (rand() - 0.5) * 2;
      if (PRIMARY[r.pos].includes(s)) base += 1.1;
      if (s === 'goalkeeping') base = r.pos === 'GK' ? r.skill + 1 + (rand() - 0.5) : 1.5;
      ratings[s] = clamp(Math.round(base * 2) / 2, 1, 10);
    }
    const id = `p${i + 1}`;
    const ovr = overallOfRatings(ratings, r.pos);
    const wage = Math.round((4000 + Math.max(0, ovr - 45) * 1100) / 100) * 100;
    // spread contract ends: a few expiring soon, most 1-3 years out
    const daysToEnd = [40, 75, 120, 210, 330, 420, 520, 640, 760, 900][i % 10] + Math.floor(rand() * 20);
    const end = addDays(now, daysToEnd);
    const player: Player = {
      id,
      name: r.name,
      dob,
      position: r.pos,
      altPosition: r.alt,
      shirt: i + 1,
      foot: rand() < 0.2 ? 'L' : rand() < 0.1 ? 'B' : 'R',
      status: 'fit',
      contract: { annualWage: wage, start: toISODate(addMonths(now, -(3 + Math.floor(rand() * 18)))), end: toISODate(end) },
      ratings,
      focus: [],
      focusTargets: {},
    };
    players.push(player);

    // observation history: 4 snapshots over the last ~5 months, trending by age
    const growth = ageOn(dob, now) < 23 ? 0.18 : ageOn(dob, now) > 30 ? -0.05 : 0.04;
    for (let k = 0; k < 4; k++) {
      const back = (3 - k) * 40;
      const snap = {} as Ratings;
      for (const s of SKILLS) {
        snap[s] = clamp(Math.round((ratings[s] - growth * (3 - k) * (0.5 + rand()) ) * 2) / 2, 1, 10);
      }
      if (k === 3) Object.assign(snap, ratings);
      observations.push({
        id: uid(),
        playerId: id,
        date: toISODate(addDays(now, -back)),
        kind: k === 0 ? 'baseline' : k === 3 ? 'assessment' : 'training',
        ratings: snap,
        note: k === 0 ? 'Start-of-season baseline.' : k === 3 ? 'Latest assessment.' : 'Progress check after training block.',
      });
    }
  });

  // development focus for some players
  const focusFor = (p: Player) => {
    const skills = [...PRIMARY[p.position]].sort((a, b) => p.ratings[a] - p.ratings[b]);
    p.focus = [skills[0]];
    p.focusTargets = { [skills[0]]: Math.min(10, Math.ceil(p.ratings[skills[0]]) + 1) };
  };
  players.filter((_, i) => i % 3 === 0).forEach(focusFor);

  // status
  players[5].status = 'injured';
  players[5].statusNote = 'Hamstring — 3 weeks';
  players[12].status = 'unavailable';
  players[12].statusNote = 'Away on holiday';

  // total wage → budget at ~88% utilisation
  const total = players.reduce((s, p) => s + (p.contract?.annualWage ?? 0), 0);
  club.annualWageBudget = Math.round(total / 0.88 / 10000) * 10000;

  const format = club.defaultFormat;
  const formation = formationsFor(format)[0];
  const slots = buildSlots(formation);
  const fixtures: Fixture[] = [];
  const seasonMinutes: Record<string, number> = {};
  const opponents = ['Riverside Rovers', 'Eastfield Town', 'Hillcrest Athletic', 'Park Lane FC', 'Dockside City', 'Millbrook Wanderers', 'St Mary’s', 'Harbour Albion', 'Kingsbridge', 'Oakwood Rangers'];

  const mkFixture = (offsetDays: number, idx: number, played: boolean): Fixture => {
    const d = addDays(now, offsetDays);
    d.setHours(15, 0, 0, 0);
    const availability: Fixture['availability'] = {};
    players.forEach((p) => {
      if (p.status !== 'fit') availability[p.id] = 'no';
      else availability[p.id] = played ? (rand() < 0.1 ? 'no' : 'yes') : rand() < 0.88 ? 'yes' : rand() < 0.6 ? 'maybe' : 'no';
    });
    const fx: Fixture = {
      id: `f${idx}`,
      date: toISODateTime(d),
      opponent: opponents[idx % opponents.length],
      home: idx % 2 === 0,
      format,
      formationId: formation.id,
      periods: club.periods,
      matchMinutes: club.matchMinutes,
      status: played ? 'played' : 'scheduled',
      availability,
      events: [],
    };
    if (played) {
      const avail = players.filter((p) => availability[p.id] === 'yes');
      // a "traditional" coach: the best 13 outfield/GK pick play, the fringe barely feature
      const ranked = [...avail].sort((a, b) => overall(b) - overall(a));
      const firstGk = ranked.find((p) => p.position === 'GK');
      const regulars = ranked.filter((p) => p.position !== 'GK').slice(0, 12);
      const pool = firstGk ? [firstGk, ...regulars] : regulars;
      const fringe = avail.filter((p) => !pool.includes(p));
      const plan = planRotation({ players: pool, slots, periods: club.periods, minPct: 0, seasonMinutes, balance: 0.95 });
      const lastPeriod = plan.periods[club.periods - 1];
      if (idx === 1 || idx === 4 || idx === 6) {
        // token cameo for one fringe player in the final window
        const cameo = fringe[idx % Math.max(fringe.length, 1)];
        if (cameo) {
          const si = slots.findIndex((sl, j) => sl.role === cameo.position && j > 0);
          const j = si > 0 ? si : 1;
          lastPeriod[j] = cameo.id;
        }
      }
      fx.plan = { periods: plan.periods, balance: 0.95, generatedAt: toISODateTime(d) };
      fx.minutes = minutesFromPlan(plan.periods, club.matchMinutes);
      fx.starters = plan.periods[0].filter((x): x is string => !!x);
      for (const [id, m] of Object.entries(fx.minutes)) seasonMinutes[id] = (seasonMinutes[id] ?? 0) + m;
      const gf = Math.floor(rand() * 4);
      const ga = Math.floor(rand() * 3);
      fx.result = { for: gf, against: ga };
      const onPitch = fx.plan.periods.flat().filter((x): x is string => !!x);
      for (let g = 0; g < gf; g++) {
        const scorer = onPitch[Math.floor(rand() * onPitch.length)];
        fx.events.push({ id: uid(), playerId: scorer, type: 'goal', minute: 5 + Math.floor(rand() * 85) });
        if (rand() < 0.7) {
          const assister = onPitch[Math.floor(rand() * onPitch.length)];
          if (assister !== scorer) fx.events.push({ id: uid(), playerId: assister, type: 'assist', minute: fx.events[fx.events.length - 1].minute });
        }
      }
    }
    return fx;
  };

  [-49, -42, -35, -28, -21, -14, -7].forEach((o, i) => fixtures.push(mkFixture(o, i, true)));
  [3, 10, 17].forEach((o, i) => fixtures.push(mkFixture(o, 7 + i, false)));

  const trainings: Training[] = [];
  for (let t = 8; t >= 1; t--) {
    const d = addDays(now, -t * 5);
    const attendance: Record<string, boolean> = {};
    players.forEach((p, i) => {
      // some players are chronic late-arrivers/absentees
      const rate = i % 7 === 3 ? 0.55 : 0.88;
      attendance[p.id] = rand() < rate;
    });
    trainings.push({ id: `t${t}`, date: toISODate(d), focus: (['passing', 'defending', 'stamina', 'attacking'] as Skill[])[t % 4], attendance });
  }

  return { club, players, observations, fixtures, trainings };
}

export { overall };
