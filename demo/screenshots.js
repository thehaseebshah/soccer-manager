// Captures 2x screenshots of the real app (mobile and desktop widths).
//   node demo/serve.js &
//   NODE_PATH=$(npm root -g) node demo/screenshots.js <outDir>
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(process.argv[2] || 'docs/presentation/media/screens');
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8081';

async function session(browser, viewport, fn, clock = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('dialog', (d) => d.accept());
  if (clock) await page.clock.install();
  const vis = (l) => l.filter({ visible: true }).first();
  const snap = async (n) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${n}.png`) });
  };
  const click = (l) => l.click();
  const btn = (name, exact = false) => vis(page.getByRole('button', { name, exact }));
  const tab = (n) => page.getByRole('tab', { name: new RegExp(n) });
  const demo = async () => {
    await page.goto(BASE + '/');
    await page.getByText('Set up your club').waitFor();
    await page.getByRole('button', { name: 'Load demo club' }).click();
    await vis(page.getByText('Northgate United')).waitFor();
    await page.waitForTimeout(400);
  };
  try {
    await fn({ page, vis, snap, click, btn, tab, demo, BASE });
  } catch (e) {
    console.error('FAILED', e.message.split('\n').slice(0, 3).join(' | '));
  }
  console.log('console errors:', JSON.stringify(errors));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();

  // ---- mobile, regular viewport
  await session(browser, { width: 390, height: 844 }, async ({ page, vis, snap, btn, tab, demo }) => {
    await page.goto(BASE + '/');
    await page.getByText('Set up your club').waitFor();
    await snap('01-welcome');
    await demo();
    await snap('02-home');
    await tab('Squad').click();
    await snap('03-squad');
    await tab('Matchday').click();
    await snap('04-matchday');
    await vis(page.getByText('Needs plan')).click();
    await vis(page.getByText('Rotation plan')).waitFor();
    await snap('05-availability');
    await btn(/Unanswered/).click();
    await btn(/Generate fair plan/).click();
    await vis(page.getByText('Fairness preview')).waitFor();
    await btn('30′', true).click();
    await vis(page.getByText('Changes at 30′')).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await snap('06-plan-window');
    await vis(page.getByText('Fairness preview')).evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await snap('07-fairness-preview');
  });

  // ---- mobile, tall viewport (long pages in one image)
  await session(browser, { width: 390, height: 1500 }, async ({ page, vis, snap, btn, tab, demo }) => {
    await demo();
    await snap('08-home-full');
    await tab('Finance').click();
    await snap('09-finance-full');
    await tab('Develop').click();
    await snap('10-develop-full');
    await tab('Squad').click();
    await vis(page.getByText(/^\d+\. Jordan Blake$/)).click();
    await btn('Observation').waitFor();
    await snap('11-player-profile');
    await page.goto(BASE + '/scenario');
    await page.waitForTimeout(900);
    await vis(page.getByRole('button', { name: 'Jamie Cole' })).click();
    await btn('Add to scenario').click();
    await btn('Sign', true).click();
    await vis(page.getByLabel('Name', { exact: true })).fill('Star Striker');
    await btn('FWD', true).click();
    await vis(page.getByLabel(/^Overall/)).fill('82');
    await vis(page.getByLabel(/^Annual wage/)).fill('60000');
    await vis(page.getByLabel('Years', { exact: true })).fill('3');
    await vis(page.getByLabel('Fee', { exact: true })).fill('25000');
    await btn('Add to scenario').click();
    await vis(page.getByText('Outcome')).waitFor();
    await snap('12-scenario-full');
  });

  // ---- mobile live match + played match with the clock advanced
  await session(
    browser,
    { width: 390, height: 844 },
    async ({ page, vis, snap, btn, tab, demo }) => {
      await demo();
      await tab('Matchday').click();
      await vis(page.getByText('Needs plan')).click();
      await btn(/Unanswered/).click();
      await btn(/Generate fair plan/).click();
      await btn('Start live match').click();
      await btn('Kick off', true).click();
      await page.clock.fastForward('14:50');
      await page.clock.fastForward('00:10');
      await page.waitForTimeout(900);
      await snap('13-live-sub-due');
      await btn('Make planned changes').click();
      for (let i = 0; i < 4; i++) {
        await page.clock.fastForward('15:00');
        await page.waitForTimeout(500);
        await btn('Make planned changes').click();
      }
      await page.clock.fastForward('15:00');
      await page.waitForTimeout(700);
      await btn('Full time', true).click();
      await vis(page.getByText('Minutes played')).waitFor();
      await vis(page.getByText('Minutes played')).evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await snap('14-minutes-played');
      await vis(page.getByRole('button', { name: /^Explain/ }).last()).click();
      await vis(page.getByText('Message for parent / player')).evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await snap('15-parent-explainer');
    },
    true,
  );

  // ---- desktop width (the same app as a web app)
  await session(browser, { width: 1280, height: 800 }, async ({ page, vis, snap, tab, demo }) => {
    await demo();
    await snap('16-web-home');
    await tab('Finance').click();
    await snap('17-web-finance');
    await tab('Squad').click();
    await snap('18-web-squad');
  });

  await browser.close();
})();
