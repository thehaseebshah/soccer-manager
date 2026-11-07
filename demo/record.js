// Records the Gaffer demo videos (real app, real data) and framed stills.
//   node demo/serve.js &                       # serve dist/ on :8081
//   NODE_PATH=$(npm root -g) node demo/record.js <outDir> [scene ...]
// Needs Playwright with Chromium. Scenes: fairness, live, owner, develop.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(process.argv[2] || 'docs/presentation/media');
const WANT = process.argv.slice(3);
const BASE = 'http://localhost:8081';
const W = 1280;
const H = 800;
const wait = (p, ms) => p.waitForTimeout(ms);
// Captions need time to be read and narrated over; scale every deliberate hold by this factor.
const PACE = Number(process.env.PACE || 1.7);

async function runScene(browser, name, opts, fn) {
  if (WANT.length && !WANT.includes(name)) return;
  fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'framed'), { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: path.join(OUT, 'raw'), size: { width: W, height: H } },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', (d) => d.accept());
  if (opts.clock) await page.clock.install();
  await page.goto(`${BASE}/__frame`);
  const app = page.frameLocator('#app');

  const vis = (loc) => loc.filter({ visible: true }).first();
  const caption = (step, title, body) => page.evaluate(([a, b, c]) => window.setCaption(a, b, c), [step, title, body]);
  const note = (t) => page.evaluate((x) => window.setNote(x), t);
  const hold = (ms) => wait(page, Math.round(ms * PACE));
  const glide = async (loc) => {
    await loc.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await wait(page, 1100);
  };
  const tap = async (loc, pause = 450) => {
    await loc.waitFor({ state: 'visible', timeout: 15000 });
    await loc.scrollIntoViewIfNeeded();
    await wait(page, 150);
    const b = await loc.boundingBox();
    await page.evaluate(([x, y]) => window.moveCursor(x, y), [b.x + b.width / 2, b.y + b.height / 2]);
    await wait(page, 520);
    await page.evaluate(() => window.clickPulse());
    await loc.click();
    await wait(page, pause);
  };
  const still = async (n) => {
    // let the caption fade finish and hide the cursor so the still is clean
    await wait(page, 750);
    await page.evaluate(() => (document.getElementById('cursor').style.opacity = '0'));
    await page.screenshot({ path: path.join(OUT, 'framed', `${n}.png`) });
    await page.evaluate(() => (document.getElementById('cursor').style.opacity = '1'));
  };
  const tab = (label) => app.getByRole('tab', { name: new RegExp(label) });
  const button = (name, exact = false) => vis(app.getByRole('button', { name, exact }));

  try {
    await fn({ page, app, vis, caption, note, hold, glide, tap, still, tab, button });
    await hold(1800);
  } catch (e) {
    console.error(`SCENE ${name} FAILED:`, e.message.split('\n').slice(0, 4).join(' | '));
    await page.screenshot({ path: path.join(OUT, 'raw', `${name}-FAIL.png`) });
  }
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  fs.renameSync(src, path.join(OUT, 'raw', `${name}.webm`));
  console.log(`scene ${name} done; console errors: ${JSON.stringify(errors)}`);
}

async function loadDemo({ app, tap, hold, vis }) {
  await app.getByText('Set up your club').waitFor();
  await tap(app.getByRole('button', { name: 'Load demo club' }), 700);
  await vis(app.getByText('Northgate United')).waitFor();
  await hold(500);
}

async function planNextMatch(ctx) {
  const { app, tap, button, glide, vis } = ctx;
  await tap(button(/Unanswered/), 500);
  await tap(button(/Generate fair plan|Regenerate plan/), 900);
  await vis(app.getByText('Fairness preview')).waitFor();
}

(async () => {
  const browser = await chromium.launch();

  // ------------------------------------------------------------------ 1. fairness
  await runScene(browser, 'fairness', {}, async (c) => {
    const { app, vis, caption, hold, tap, glide, still, button } = c;
    await caption('Scene 1 · The problem', 'Why didn’t my child play?', 'Most club apps run the admin. Gaffer connects playing time, the wage budget and player development in one place.');
    await hold(4500);
    await loadDemo(c);
    await caption('Scene 1 · The club today', 'Northgate United, at a glance', 'Next match, wage headroom and a fairness index built from every minute played this season.');
    await still('fairness-1-home');
    await hold(4500);
    await glide(vis(app.getByText(/Under the \d+% minutes rule/)));
    await caption('Scene 1 · The alert', 'Gaffer spots who is being squeezed', 'These players have been available but are below the club’s minimum share of match time. The planner will prioritise them.');
    await still('fairness-2-alert');
    await hold(5000);
    await tap(button('Plan next match'), 900);
    await caption('Scene 1 · Plan the match', 'Confirm who is in, then one tap', 'Availability is collected per player. Gaffer builds a rotation plan around it.');
    await still('fairness-3-availability');
    await hold(3500);
    await tap(button(/Unanswered/), 600);
    await tap(button(/Generate fair plan/), 1200);
    await caption('Scene 1 · The plan', 'Everyone gets at least 30%', 'Keepers share the goal. Outfield players are placed by position, strength and how many minutes they’ve had so far.');
    await glide(button(/^GK:/));
    await still('fairness-4-plan');
    await hold(4200);
    await tap(button('15′', true), 500);
    await tap(button('30′', true), 800);
    await caption('Scene 1 · Substitutions', 'Planned changes, window by window', 'See exactly who comes on and who goes off at each point, and adjust by tapping a position.');
    await glide(vis(app.getByText('Changes at 30′')));
    await still('fairness-5-changes');
    await hold(5000);
    await glide(vis(app.getByText('Fairness preview')));
    await caption('Scene 1 · The proof', 'Nobody falls under the line', 'The marker is the club’s minimum. Catch-up minutes go first to players who have had the least.');
    await still('fairness-6-preview');
    await hold(5500);
  });

  // ------------------------------------------------------------------ 2. live match
  await runScene(browser, 'live', { clock: true }, async (c) => {
    const { app, vis, caption, note, hold, tap, glide, still, tab, button, page } = c;
    await caption('Scene 2 · Match day', 'From plan to touchline', 'The same plan runs the match: clock, substitutions, goals and exact minutes.');
    await loadDemo(c);
    await tap(tab('Matchday'), 600);
    await tap(vis(app.getByText('Needs plan')), 900);
    await planNextMatch(c);
    await glide(button('Start live match'));
    await still('live-1-ready');
    await tap(button('Start live match'), 900);
    await vis(app.getByText('Ready')).waitFor();
    await caption('Scene 2 · Kick-off', 'One tap to start the clock', 'The starting XI comes from the plan. Every player’s minutes are tracked live.');
    await note('⏩ The match clock is fast-forwarded in this recording. A real match runs 90 minutes.');
    await hold(2500);
    await tap(button('Kick off', true), 1200);
    await page.clock.fastForward('14:50');
    await hold(1600);
    await page.clock.fastForward('00:10');
    await hold(1200);
    await caption('Scene 2 · Sub window', 'Gaffer says when a change is due', 'At 15:00 the planned substitutions appear. One tap makes them.');
    await still('live-2-due');
    await hold(3800);
    await tap(button('Make planned changes'), 1000);
    await tap(button(/^ST:/), 700);
    await caption('Scene 2 · Events', 'Log a goal in two taps', 'Tap the player, tap Goal. Assists and conceded goals work the same way.');
    await tap(button('Goal', true), 900);
    await still('live-3-goal');
    await hold(3000);
    await caption('Scene 2 · The rest of the match', 'Each window, one tap', 'Windows at 30, 45, 60 and 75 minutes follow the same pattern.');
    for (let i = 0; i < 4; i++) {
      await page.clock.fastForward('15:00');
      await wait(page, 600);
      await tap(button('Make planned changes'), 500);
    }
    await page.clock.fastForward('15:00');
    await hold(900);
    await still('live-4-fulltime');
    await tap(button('Full time', true), 1500);
    await vis(app.getByText('Minutes played')).waitFor();
    await caption('Scene 2 · The record', 'Exact minutes, saved automatically', 'The season ledger updates itself. Bars show each player against the club’s minimum.');
    await glide(vis(app.getByText('Minutes played')));
    await still('live-5-minutes');
    await hold(4500);
    await tap(vis(app.getByRole('button', { name: /^Explain/ }).last()), 900);
    await caption('Scene 2 · The parent conversation', 'A factual answer in one tap', 'Minutes, season share, squad rank and the club’s rule, written in plain language and ready to send.');
    await glide(vis(app.getByText('Message for parent / player')));
    await still('live-6-explainer');
    await hold(7000);
  });

  // ------------------------------------------------------------------ 3. owner
  await runScene(browser, 'owner', {}, async (c) => {
    const { app, vis, caption, hold, tap, glide, still, tab, button } = c;
    await caption('Scene 3 · The owner’s view', 'Where the money goes', 'The same squad data drives the wage budget, contracts and risk.');
    await loadDemo(c);
    await tap(tab('Finance'), 900);
    await still('owner-1-finance');
    await hold(4000);
    await glide(vis(app.getByText('Next 24 months (monthly wage bill)')));
    await caption('Scene 3 · 24-month outlook', 'Wages roll off as contracts expire', 'Bars are committed wages, the dashed line is the budget. Spot the room to invest, and the cliffs.');
    await still('owner-2-chart');
    await hold(5500);
    await glide(vis(app.getByText('Retention risks')));
    await caption('Scene 3 · Retention', 'Good players with short contracts', 'Ranked by rating and time left, so the ones you can’t afford to lose by accident come first.');
    await still('owner-3-retention');
    await hold(5000);
    await tap(button('Open scenario lab'), 1000);
    await caption('Scene 3 · Scenario lab', 'Test a decision before you make it', 'Stack releases, renewals and signings and see the effect on budget and squad shape.');
    await hold(3500);
    await tap(vis(app.getByRole('button', { name: 'Jamie Cole' })), 500);
    await tap(button('Add to scenario'), 700);
    await caption('Scene 3 · Scenario', 'Release the first-choice keeper, sign a striker', 'A £60k-a-year striker looks affordable on paper.');
    await tap(button('Sign', true), 600);
    await vis(app.getByLabel('Name', { exact: true })).pressSequentially('Star Striker', { delay: 70 });
    await tap(button('FWD', true), 400);
    await vis(app.getByLabel(/^Overall/)).fill('82');
    await vis(app.getByLabel(/^Annual wage/)).fill('60000');
    await vis(app.getByLabel('Years', { exact: true })).fill('3');
    await vis(app.getByLabel('Fee', { exact: true })).fill('25000');
    await hold(900);
    await tap(button('Add to scenario'), 900);
    await vis(app.getByText('Outcome')).waitFor();
    await glide(vis(app.getByText('Outcome')));
    await caption('Scene 3 · The catch', 'Affordable, but one keeper left', 'Gaffer flags the squad-shape problem and shows the wage bill, one-off costs and a new 24-month chart.');
    await still('owner-4-scenario');
    await hold(7000);
  });

  // ------------------------------------------------------------------ 4. development
  await runScene(browser, 'develop', {}, async (c) => {
    const { app, vis, caption, hold, tap, glide, still, tab, button } = c;
    await caption('Scene 4 · Development', 'Track every player’s growth', 'Ratings are logged as observations, so progress is a trend, not an opinion.');
    await loadDemo(c);
    await tap(tab('Develop'), 900);
    await still('develop-1-overview');
    await hold(4500);
    await caption('Scene 4 · Squad view', 'Gaffer suggests what to train', 'It finds the weakest skill across the squad and tracks individual focus goals.');
    await glide(vis(app.getByText('Squad profile')));
    await hold(4000);
    await tap(tab('Squad'), 800);
    await tap(vis(app.getByText(/^\d+\. Jordan Blake$/)), 1000);
    await caption('Scene 4 · A player profile', 'Minutes, skills and contract together', 'One profile for the coach and the owner: playing time, development trend and contract status.');
    await still('develop-2-profile');
    await hold(3500);
    await glide(button('Observation'));
    await hold(1200);
    await tap(button('Observation'), 900);
    await caption('Scene 4 · After training', 'Log what you saw', 'Adjust the ratings, add a note. The trend and projection update.');
    await tap(button('Increase Attacking', true), 350);
    await tap(button('Increase Attacking', true), 350);
    await tap(button('Increase Technique', true), 500);
    await vis(app.getByLabel(/Coach.s note/)).pressSequentially('Sharper movement in behind and much better link play. Next: first touch under pressure.', { delay: 28 });
    await hold(800);
    await still('develop-3-observation');
    await tap(button('Save observation'), 1200);
    await tap(button('Progress report'), 900);
    await caption('Scene 4 · Share it', 'A progress report for the player or parent', 'Strengths, areas to grow, focus goals and playing time, in one message.');
    await glide(vis(app.getByText('Report (select to copy)')));
    await still('develop-4-report');
    await hold(7000);
  });

  await browser.close();
})();
