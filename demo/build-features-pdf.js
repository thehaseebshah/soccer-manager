// Builds the Gaffer feature guide PDF.
//   NODE_PATH=$(npm root -g) node demo/build-features-pdf.js <workDir> <out.pdf>
// Needs Playwright (Chromium) and ffmpeg. Screenshots come from docs/presentation/media.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WORK = path.resolve(process.argv[2] || '/tmp/gaffer-pdf');
const OUT = path.resolve(process.argv[3] || 'docs/presentation/Gaffer_Feature_Guide.pdf');
const MEDIA = path.resolve(__dirname, '..', 'docs', 'presentation', 'media');
fs.mkdirSync(WORK, { recursive: true });

// ---------------------------------------------------------------- images (cropped, JPEG to keep the PDF small)
const img = (name, src, crop) => {
  const out = path.join(WORK, `${name}.jpg`);
  const vf = crop ? ['-vf', `crop=${crop}`] : [];
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(MEDIA, src), ...vf, '-q:v', '3', out]);
  return `file://${out}`;
};
const IM = {
  home: img('home', 'screens/02-home.png'),
  welcome: img('welcome', 'screens/01-welcome.png'),
  web: img('web', 'screens/16-web-home.png'),
  squad: img('squad', 'screens/03-squad.png'),
  profile: img('profile', 'screens/11-player-profile.png', '780:1700:0:0'),
  avail: img('avail', 'screens/05-availability.png'),
  plan: img('plan', 'screens/06-plan-window.png'),
  preview: img('preview', 'screens/07-fairness-preview.png'),
  live: img('live', 'screens/13-live-sub-due.png'),
  minutes: img('minutes', 'screens/14-minutes-played.png'),
  explainer: img('explainer', 'screens/15-parent-explainer.png'),
  finance: img('finance', 'screens/09-finance-full.png', '780:1300:0:0'),
  scenario: img('scenario', 'screens/12-scenario-full.png', '780:1200:0:1500'),
  develop: img('develop', 'screens/10-develop-full.png', '780:1550:0:100'),
  observe: img('observe', 'framed/develop-3-observation.png'),
  matchday: img('matchday', 'screens/04-matchday.png'),
};

// ---------------------------------------------------------------- content
const SECTIONS = [
  {
    id: 'fair',
    title: 'Fair playing time',
    who: 'Coach and club',
    lead: 'The feature the rest of the app is built around. The club sets a minimum share of match time for every available player. Gaffer plans the rotation to keep that promise and keeps the evidence.',
    features: [
      {
        name: 'Fair-rotation planner',
        what: 'Builds a substitution plan for a match in which every available player receives at least the club’s minimum share of playing time, for example 30%.',
        how: 'The match is divided into rotation windows (six of 15 minutes for a 90-minute game by default). Each player gets a quota of windows. The extra windows go first to players with the fewest season minutes (Develop), to the strongest players (Compete), or are shared between both (Balanced). Each window is then filled with the best position fit, using the Hungarian assignment algorithm, and players keep their slot where possible so there are fewer needless position changes. If the minimum is impossible, for example with too few players, the plan says so and shows the best achievable figure.',
        where: 'Matchday › open a fixture › Rotation plan',
      },
      {
        name: 'Goalkeeper handling',
        what: 'Keepers share the goal between themselves and outfield players are never placed in goal while a keeper is available.',
        how: 'Keepers and outfield players have separate minute pools. If no keeper is available, the plan warns you and puts the best-fitting outfield player in goal.',
        where: 'Part of the planner',
      },
      {
        name: 'Pitch view and substitution windows',
        what: 'Shows the lineup on a pitch for each rotation window, who comes on, who goes off, and lets you adjust by hand.',
        how: 'Tap a window time to see that lineup. Players coming on are tagged ON and a “Changes at” card lists them. To adjust, tap a position and then a bench player; if that player is already on the pitch the two swap places. There are 13 formations: five for 11-a-side, four for 9-a-side and four for 7-a-side.',
        where: 'Fixture screen',
      },
      {
        name: 'Fairness preview',
        what: 'Shows each player’s planned minutes against the club minimum before the match is played.',
        how: 'One bar per player with a marker at the minimum. Below each bar it shows season minutes so far and the total after this match. Players below the line are shown in red.',
        where: 'Fixture screen, below the pitch',
      },
      {
        name: 'Season minutes ledger',
        what: 'Keeps a running record of every player’s minutes, appearances, starts, goals and assists.',
        how: 'It updates itself when a match is finished. The key figure is the share of available time: minutes played divided by the length of the matches the player was available for.',
        where: 'Player profile, Squad list',
      },
      {
        name: 'Fairness index',
        what: 'A single score from 0 to 100 for how evenly minutes are shared across the squad. 100 means perfectly even.',
        how: 'Calculated from how much players’ shares of available time differ from the squad average. It needs at least three players with two or more available matches, otherwise it shows a dash.',
        where: 'Home',
      },
      {
        name: 'Under-the-minimum alerts',
        what: 'Lists fit players who have been available but are below the club’s minimum share.',
        how: 'Shown on Home with each player’s share and minutes. Those players are prioritised automatically the next time a plan is generated.',
        where: 'Home',
      },
      {
        name: 'Parent and player explainer',
        what: 'Writes a plain-language message answering “why did my child play this much?”',
        how: 'Tap Explain next to any player on a finished match. The message gives the minutes in that match, the season total and share, the squad rank, the club rule and, if the player is below the minimum, a note that they will be prioritised. It can be selected and copied.',
        where: 'Finished fixture › Minutes played',
      },
    ],
    shots: [
      [IM.plan, 'Rotation plan with the changes at 30 minutes'],
      [IM.preview, 'Fairness preview against the minimum'],
      [IM.explainer, 'Parent explainer message'],
    ],
  },
  {
    id: 'match',
    title: 'Matchday',
    who: 'Coach',
    lead: 'From collecting availability to the final whistle, and the training sessions in between.',
    features: [
      {
        name: 'Fixtures',
        what: 'Create, edit and delete matches.',
        how: 'Each fixture has an opponent, kick-off date and time, home or away, an optional venue, a format (7, 9 or 11-a-side), a formation, match length and number of rotation windows. Changing the format, formation or windows clears the old plan so it cannot go stale.',
        where: 'Matchday › Add fixture',
      },
      {
        name: 'Availability',
        what: 'Records who is In, Maybe or Out for each match.',
        how: 'Injured and unavailable players are locked out automatically. “Unanswered → In” confirms everyone who has not replied. If too few players are In, a switch counts the Maybes as available, and a warning shows how many positions cannot be filled.',
        where: 'Fixture screen',
      },
      {
        name: 'Live match mode',
        what: 'Runs the match: clock, substitutions, goals, assists and exact minutes.',
        how: 'Kick off starts the clock, which can be paused and resumed. The screen shows when the next rotation window is due and what changes are planned; one tap makes them all. You can also substitute manually. Tap a player to log a goal or assist, and use the Conceded counter for the opposition. Each player’s minutes are shown on the pitch. The match state is saved as it goes. At Full time the minutes, result and starters are written to the season record.',
        where: 'Fixture screen › Start live match',
      },
      {
        name: 'Quick result entry',
        what: 'Records a match without using live mode.',
        how: 'Enter goals for and against and mark the match as played. The planned minutes are used as the minutes played.',
        where: 'Fixture screen',
      },
      {
        name: 'Match record',
        what: 'Keeps the result, the planned lineups, minutes played and events for every finished match.',
        how: 'Minutes appear as bars against the club minimum, with a small tolerance of one minute so a late substitution is not shown as a breach. Events list goals and assists with the minute.',
        where: 'Matchday › Results',
      },
      {
        name: 'Training sessions and attendance',
        what: 'Logs training sessions and who attended.',
        how: 'Each session has a date, an optional focus skill and a present or absent mark per player, with an Everyone shortcut. Attendance percentage appears on each profile and players below 70% are listed on the Develop tab.',
        where: 'Matchday › Training',
      },
    ],
    shots: [
      [IM.avail, 'Availability for the next match'],
      [IM.live, 'Live match: a substitution window is due'],
      [IM.minutes, 'Minutes played after full time'],
    ],
  },
  {
    id: 'squad',
    title: 'Squad and players',
    who: 'Coach and owner',
    lead: 'One record per player that serves both the coach and the owner.',
    features: [
      {
        name: 'Squad list',
        what: 'Lists every player with the details that matter at a glance.',
        how: 'Search by name, filter by position (GK, DEF, MID, FWD) and sort by position, rating, minutes or age. Each card shows shirt number, position, age, minutes and appearances, injury or availability status, a contract warning when one is close to ending, and the overall rating.',
        where: 'Squad tab',
      },
      {
        name: 'Player records',
        what: 'Add and edit players with all the information the planner and the budget need.',
        how: 'Name, date of birth (validated), shirt number, main position and an optional second position, preferred foot, parent or guardian, contract (annual wage, start and end, or none), starting ratings for eight skills, and up to three development focus skills with targets.',
        where: 'Squad › Add, or Player › Edit',
      },
      {
        name: 'Player status',
        what: 'Marks a player Fit, Injured or Unavailable.',
        how: 'Players who are not fit are excluded from availability and from plans.',
        where: 'Player profile',
      },
      {
        name: 'Player profile',
        what: 'A single page for each player covering playing time, skills, development and contract.',
        how: 'It shows the overall rating, minutes and share of available time, appearances and starts, goals and assists, training attendance, minutes in each of the last eight matches, skill bars with focus goals and progress, a trend line, a projected rating two years ahead, the latest observations and the contract with days remaining.',
        where: 'Squad › tap a player',
      },
    ],
    shots: [
      [IM.squad, 'Squad list'],
      [IM.profile, 'Player profile'],
    ],
  },
  {
    id: 'finance',
    title: 'Finance and contracts',
    who: 'Owner',
    lead: 'The owner’s view of the same squad: what it costs, when contracts end, and what a decision would do before it is made.',
    features: [
      {
        name: 'Wage budget overview',
        what: 'Shows the annual wage bill against the annual wage budget.',
        how: 'It shows the total committed wages, headroom, percentage of the budget used, the number of contracts and the average wage. The bar turns amber above 92% and red above 100%.',
        where: 'Finance tab, Home',
      },
      {
        name: '24-month projection',
        what: 'Projects the monthly wage bill for the next two years.',
        how: 'Each bar is one month of committed wages, with the budget as a dashed line. Contracts roll off as they expire, so the owner can see room to invest and the points where several contracts end together. Months over budget are red.',
        where: 'Finance tab',
      },
      {
        name: 'Contracts tracker',
        what: 'Lists every contract in order of expiry.',
        how: 'Each shows the wage, end date and days remaining, coloured: red for expired or under 90 days, amber under 180 days, green otherwise.',
        where: 'Finance tab',
      },
      {
        name: 'Retention risks',
        what: 'Ranks good players with short contracts, the ones you cannot afford to lose by accident.',
        how: 'Considers contracts with up to 270 days left. The score combines how far the player’s rating is above the squad average with how soon the contract ends.',
        where: 'Finance tab, top three on Home',
      },
      {
        name: 'Squad shape and age profile',
        what: 'Compares the squad with an ideal shape and shows its age balance.',
        how: 'The ideal depends on the format: for 11-a-side it is 2 goalkeepers, 6 defenders, 6 midfielders and 4 forwards. It also shows the age bands (under 19, 19 to 23, 24 to 29, 30 and over) and the average rating today and in two years.',
        where: 'Finance tab',
      },
      {
        name: 'Scenario lab',
        what: 'Tests releases, renewals and signings before they happen.',
        how: 'Release a player (with a payoff as a percentage of the remaining wages), renew a contract (new wage and length) or sign someone (name, position, age, overall rating, wage, years and fee). Stack as many as you like. The outcome shows the new wage bill, headroom, one-off costs, the change in squad rating, a new 24-month chart against the current squad and warnings: fewer than two goalkeepers, a thin position, over budget, under 5% headroom, a squad too small to rotate, or a month in the future that goes over budget.',
        where: 'Finance › Open scenario lab',
      },
      {
        name: 'Apply a scenario',
        what: 'Turns a tested scenario into real changes to the squad.',
        how: 'After a confirmation, releases remove players, renewals update contracts and signings add new players. It cannot be undone automatically.',
        where: 'Scenario lab › Apply to my squad',
      },
    ],
    shots: [
      [IM.finance, 'Finance: wage bill, 24-month chart, contracts'],
      [IM.scenario, 'Scenario lab outcome'],
    ],
  },
  {
    id: 'develop',
    title: 'Player development',
    who: 'Coach',
    lead: 'Ratings are logged as observations over time, so progress is a trend and not an opinion.',
    features: [
      {
        name: 'Skill ratings and overall',
        what: 'Rates each player on eight skills and combines them into one overall rating.',
        how: 'Pace, stamina, technique, passing, attacking, defending, mentality and goalkeeping, each from 1 to 10 in half-point steps. Goalkeeping is only used for keepers. The overall rating, from 0 to 100, weights the skills by position, so defending counts most for a defender and attacking for a forward.',
        where: 'Everywhere a player appears',
      },
      {
        name: 'Observations',
        what: 'A dated record of the coach’s assessment after training, a match or a formal review.',
        how: 'Adjust the ratings with plus and minus buttons, choose Training, Match or Assessment, and add a note. The screen shows the overall rating before and after. Each observation is a snapshot, which builds the player’s history.',
        where: 'Player profile › Observation',
      },
      {
        name: 'Focus goals',
        what: 'Up to three skills per player to work on, each with a target.',
        how: 'Progress is the distance travelled from the first observation towards the target, shown as a percentage and a marker on the skill bar.',
        where: 'Player › Edit, Player profile, Develop tab',
      },
      {
        name: 'Develop tab',
        what: 'Looks across the whole squad and tells the coach where to put effort.',
        how: 'It suggests a training focus (the weakest skill across outfield players), shows the squad skill profile, lists every individual focus goal, ranks momentum over the last four months, lists players not assessed for more than 30 days and lists players with training attendance below 70%.',
        where: 'Develop tab',
      },
      {
        name: 'Rating projection',
        what: 'Estimates a player’s overall rating two years ahead.',
        how: 'A simple age curve: younger players are expected to improve faster and players over about 30 to decline. It is a heuristic, labelled as one in the app, and not a prediction.',
        where: 'Player profile',
      },
      {
        name: 'Progress report',
        what: 'Writes a shareable summary for a player or parent.',
        how: 'It includes position, age, overall rating and change since the first observation, playing time and rank, training attendance, two strengths, two areas to grow, focus goals with progress and the coach’s latest note. On phones it opens the share sheet; on the web it can be selected and copied.',
        where: 'Player profile › Progress report',
      },
    ],
    shots: [
      [IM.develop, 'Develop tab'],
      [IM.observe, 'Logging an observation'],
    ],
    wide: [1],
  },
  {
    id: 'home',
    title: 'Home, setup and data',
    who: 'Everyone',
    lead: 'Getting started, the daily dashboard, and how data is kept.',
    features: [
      {
        name: 'Home dashboard',
        what: 'The state of the club in one screen.',
        how: 'It shows the next match with availability counts and whether a plan exists, the wage headroom, the fairness index, players under the minimum, the contracts that need action, development movers over four months, the win-draw-loss record and quick actions to add a player, add a fixture or open the scenario lab.',
        where: 'Home tab',
      },
      {
        name: 'Club setup with presets',
        what: 'Creates the club with sensible defaults for its level.',
        how: 'Youth: 9-a-side, 60 minutes, four windows, everyone gets at least 50%. Amateur: 11-a-side, 90 minutes, six windows, at least 30%. Semi-pro: 11-a-side, 90 minutes, six windows, at least 20%, with a larger starting wage budget. Everything can be changed later.',
        where: 'First launch',
      },
      {
        name: 'Demo club',
        what: 'Loads a fully populated semi-pro club for exploring or presenting.',
        how: '19 players, a season of results, contracts, development history and training attendance. All data is simulated.',
        where: 'First launch, Settings',
      },
      {
        name: 'Club settings and fair-play policy',
        what: 'Controls the rules the whole app follows.',
        how: 'Club name, currency, annual wage budget, default format, match length (20 to 120 minutes), rotation windows (2 to 9), the minimum minutes percentage (0 to 80%) and the default approach (Develop, Balanced or Compete).',
        where: 'Settings (gear icon)',
      },
      {
        name: 'Backup and restore',
        what: 'Moves all data between devices or keeps a copy.',
        how: 'Data lives on the device. Export produces a backup file as text; Restore reads it back and replaces the current data after a confirmation. Erase everything wipes the device copy.',
        where: 'Settings › Data',
      },
      {
        name: 'iOS, Android and web, light and dark',
        what: 'One codebase for three platforms, following the device’s light or dark setting.',
        how: 'Built with Expo and React Native. The web version is responsive and the layout stays comfortable on a desktop screen.',
        where: 'All screens',
      },
    ],
    shots: [
      [IM.home, 'Home dashboard'],
      [IM.welcome, 'First launch'],
      [IM.web, 'Web version at desktop width'],
    ],
    wide: [2],
  },
];

const GLOSSARY = [
  ['Overall (OVR)', 'A rating from 0 to 100 built from the eight skills, weighted by the player’s position.'],
  ['Rotation window', 'One slice of a match with its own lineup. A 90-minute match with six windows has a change point every 15 minutes.'],
  ['Minimum minutes', 'The share of match time the club promises every available player, set in Settings.'],
  ['Share of available time', 'A player’s minutes divided by the length of the matches they were available for.'],
  ['Approach', 'Develop favours players with the fewest minutes, Compete favours the strongest, Balanced mixes both. It only affects the extra minutes above the guaranteed minimum.'],
  ['Headroom', 'The wage budget minus the committed wage bill.'],
  ['Observation', 'A dated snapshot of a player’s ratings with a coach’s note.'],
  ['Focus goal', 'A skill the player is working on, with a target rating.'],
];

const NOT_BUILT = [
  ['Accounts and cloud sync', 'Data is stored on the device only. Backup and restore move it between devices.'],
  ['Notifications and replies', 'There is no way for parents or players to respond to availability requests, and no push notifications.'],
  ['Parent or player app', 'Reports and explainer messages are produced for the coach to send; there is no parent-facing app.'],
  ['Registration and payments', 'Not part of Gaffer today. Existing club-administration platforms cover these.'],
  ['Multiple teams', 'One squad per club.'],
  ['Import and integrations', 'No spreadsheet import and no video or GPS integration.'],
  ['Device testing', 'The web build was exercised in a browser at phone size. Running on physical iPhones and Android phones has not been done yet.'],
];

// ---------------------------------------------------------------- HTML
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let n = 0;
const featureHtml = (f) => {
  n += 1;
  return `<article class="feat"><div class="num">${String(n).padStart(2, '0')}</div><div class="body">
    <h3>${esc(f.name)}</h3>
    <p><b>What it does.</b> ${esc(f.what)}</p>
    <p><b>How it works.</b> ${esc(f.how)}</p>
    <p class="where">Where: ${esc(f.where)}</p></div></article>`;
};
const total = SECTIONS.reduce((a, s) => a + s.features.length, 0);
const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const overviewRows = SECTIONS.map((s) => `<tr><th>${esc(s.title)}</th><td>${s.features.length}</td><td>${esc(s.who)}</td><td>${s.features.map((f) => esc(f.name)).join(', ')}</td></tr>`).join('');

const sectionsHtml = SECTIONS.map((s, i) => {
  const shots = s.shots
    .map(([src, cap], k) => `<figure class="${(s.wide || []).includes(k) ? 'wide' : ''}"><img src="${src}" alt="${esc(cap)}"><figcaption>${esc(cap)}</figcaption></figure>`)
    .join('');
  return `<section class="area" id="${s.id}">
    <header class="areahead"><div class="letter">${String.fromCharCode(65 + i)}</div><div><h2>${esc(s.title)}</h2><p class="who">For: ${esc(s.who)}</p></div></header>
    <p class="lead">${esc(s.lead)}</p>
    <div class="shots">${shots}</div>
    ${s.features.map(featureHtml).join('')}
  </section>`;
}).join('');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Gaffer Feature Guide</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Public+Sans:wght@400;500;600;700&display=swap">
<style>
@page{size:A4;margin:16mm 16mm 18mm}
:root{--ink:#0E1B14;--muted:#52615A;--line:#D5DDD6;--green:#0E7A4C;--deep:#0B3D2E;--mint:#E6F2EA;--amber:#8A5A00}
*{box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:"Public Sans","Segoe UI",system-ui,sans-serif;color:var(--ink);font-size:10pt;line-height:1.5}
h1,h2,h3{font-family:"Bricolage Grotesque","Public Sans",system-ui,sans-serif;margin:0}
.cover{height:262mm;background:var(--deep);color:#EAF4EE;border-radius:6mm;padding:22mm 18mm;display:flex;flex-direction:column;justify-content:space-between;break-after:page}
.cover .kick{font-size:9pt;letter-spacing:.2em;text-transform:uppercase;color:#9FD9BC;font-weight:600}
.cover h1{font-size:76pt;line-height:.95;letter-spacing:-.03em;font-weight:800;margin:6mm 0 4mm}
.cover .sub{font-size:20pt;max-width:120mm;line-height:1.2;font-family:"Bricolage Grotesque",sans-serif;font-weight:700}
.cover .facts{display:grid;gap:2mm;font-size:10.5pt;color:#C9DBD0}
.cover .facts b{color:#fff}
.pitchline{height:1px;background:rgba(234,244,238,.3);margin:6mm 0}
h2{font-size:22pt;letter-spacing:-.015em}
h3{font-size:12.5pt;margin-bottom:1.5mm}
.intro p{max-width:165mm}
.panel{background:var(--mint);border-radius:3mm;padding:5mm 6mm;margin:5mm 0}
table{border-collapse:collapse;width:100%;font-size:9pt}
th,td{text-align:left;vertical-align:top;padding:2.2mm 3mm;border-bottom:1px solid var(--line)}
thead th{font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
tbody th{white-space:nowrap}
.area{break-before:page}
.areahead{display:flex;gap:5mm;align-items:center;margin-bottom:3mm}
.letter{width:14mm;height:14mm;border-radius:3mm;background:var(--green);color:#fff;font-family:"Bricolage Grotesque",sans-serif;font-weight:800;font-size:20pt;display:grid;place-items:center}
.who{margin:1mm 0 0;color:var(--muted);font-size:9pt}
.lead{font-size:11pt;max-width:165mm;margin:0 0 5mm;color:#26362D}
.feat{display:grid;grid-template-columns:11mm 1fr;gap:3mm;padding:3.5mm 0;border-top:1px solid var(--line);break-inside:avoid}
.num{font-family:"Bricolage Grotesque",sans-serif;font-weight:800;color:var(--green);font-size:13pt;line-height:1.1}
.feat p{margin:0 0 1.6mm}
.where{font-size:8.5pt;color:var(--amber);font-weight:600}
.shots{display:flex;gap:5mm;margin:0 0 6mm;align-items:flex-start;break-inside:avoid;flex-wrap:wrap}
.shots figure{margin:0;width:52mm}
.shots figure.wide{width:95mm}
.shots img{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:2.5mm}
.shots figcaption{font-size:8pt;color:var(--muted);padding-top:1.5mm}
.gloss{display:grid;grid-template-columns:42mm 1fr;gap:2mm 5mm;font-size:9.5pt}
.gloss dt{font-weight:700}
.gloss dd{margin:0}
.note{font-size:8.5pt;color:var(--muted)}
</style></head><body>

<section class="cover">
  <div><div class="kick">Feature guide</div><h1>Gaffer</h1><div class="sub">One app that connects the owner’s books to the coach’s lineup.</div></div>
  <div>
    <div class="pitchline"></div>
    <div class="facts"><div><b>${total} features</b> across ${SECTIONS.length} areas</div><div>iOS, Android and web from one codebase</div><div>${today}</div>
    <div style="font-size:8.5pt;color:#9FD9BC;margin-top:3mm">Every screenshot in this guide shows simulated demo data.</div></div>
  </div>
</section>

<section class="intro" style="break-after:page">
  <h2>What Gaffer is</h2>
  <p>Gaffer is a club manager for soccer coaches and owners. Most club apps handle administration, such as registration, payments and messages. Gaffer focuses on three things that usually live in separate tools: fair playing time, the wage budget and contracts, and player development. All three use the same squad data.</p>
  <div class="panel"><b>The core idea.</b> A club chooses a minimum share of match time for every available player. Gaffer plans each match to keep that promise, records what actually happened, and gives the coach a factual answer when a parent asks why their child played the way they did. The owner’s view of budget and contracts comes from the same players.</div>
  <h3 style="margin:6mm 0 2mm">Features at a glance</h3>
  <table><thead><tr><th>Area</th><th>Features</th><th>For</th><th>Includes</th></tr></thead><tbody>${overviewRows}</tbody></table>
  <h3 style="margin:7mm 0 2mm">How to read this guide</h3>
  <p>Each feature is numbered so you can refer to it in conversation. For each one, “What it does” says what you get, “How it works” explains the behaviour and the rules behind it, and “Where” says where to find it in the app. The glossary and the list of what is not built yet are at the end.</p>
</section>

${sectionsHtml}

<section class="area" id="glossary">
  <header class="areahead"><div class="letter">?</div><div><h2>Glossary</h2></div></header>
  <dl class="gloss">${GLOSSARY.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl>
  <h2 style="margin-top:10mm">Not built yet</h2>
  <p class="lead">So the guide is complete about what exists and what does not.</p>
  <table><thead><tr><th>Area</th><th>Status</th></tr></thead><tbody>${NOT_BUILT.map(([a, b]) => `<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table>
  <h2 style="margin-top:10mm">How it was checked</h2>
  <p>The core logic (rotation planner, budget and scenarios, live clock and fairness figures) is covered by automated unit tests. The app passes a type check and lint, builds for the web, and was walked through in a browser. Ratings projections are simple heuristics. The market research behind the concept came from a limited set of searches, mostly vendor material.</p>
  <p class="note">Gaffer feature guide · ${today}</p>
</section>
</body></html>`;

(async () => {
  const htmlPath = path.join(WORK, 'features.html');
  fs.writeFileSync(htmlPath, html);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate:
      '<div style="width:100%;font-size:8px;color:#52615A;padding:0 16mm;display:flex;justify-content:space-between;font-family:Arial,sans-serif"><span>Gaffer feature guide</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
  });
  await browser.close();
  console.log('wrote', OUT, `${total} features`);
})();
