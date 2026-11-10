// Renders demo/presentation-content.js to (a) an HTML page fragment for publishing and (b) a Markdown script.
//   node demo/build-presentation.js --media <dir with video/ framed/ screens/> --html <out.html> --md <out.md>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const C = require('./presentation-content.js');

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const MEDIA = path.resolve(arg('media') || 'docs/presentation/media');
const HTML_OUT = arg('html');
const MD_OUT = arg('md');
const MEDIA_HTML_OUT = arg('media-html');

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rel = (f) => `media/${f}`;
const hashOf = (m) => (m.type === 'video' ? m.key : path.basename(m.file, path.extname(m.file)));
const screenUrl = (id) => `media.html#${id}`;
const NEWTAB = 'target="_blank" rel="noopener"';

function duration(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(MEDIA, file)]).toString().trim();
    return Math.round(parseFloat(out));
  } catch {
    return null;
  }
}
const mmss = (s) => (s == null ? '' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

const vids = {};
for (const [k, v] of Object.entries(C.videos)) vids[k] = { ...v, secs: duration(v.file) };
const clipTotal = ['fairness', 'live', 'owner', 'develop'].reduce((a, k) => a + (vids[k].secs || 0), 0);
const shotCount = C.gallery.length;

// Timings are derived, never typed: narration at ~150 words a minute, and never shorter than the clip itself.
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
let cursor = 0;
for (const a of C.acts) {
  const words = a.say.join(' ').split(/\s+/).length;
  let secs = Math.ceil(words / 2.5 / 5) * 5;
  if (a.media.type === 'video') secs = Math.max(secs, (vids[a.media.key].secs || 0) + 10);
  a.start = fmt(cursor);
  a.length = fmt(secs);
  cursor += secs;
}
const totalRuntime = cursor;
const runtimeLabel = `about ${Math.round(totalRuntime / 60)} min + questions`;

// ------------------------------------------------------------------ HTML
function mediaHtml(m) {
  if (m.type === 'video') {
    const v = vids[m.key];
    return `<figure class="media">
  <video id="v-${m.key}" controls preload="metadata" playsinline poster="${rel(v.poster)}"><source src="${rel(v.file)}" type="video/mp4"></video>
  <figcaption><span>${esc(v.title)} · ${mmss(v.secs)}</span></figcaption>
  <div class="openrow"><a class="btn" href="${screenUrl(m.key)}" ${NEWTAB}>Open on second screen ↗</a><a class="btn ghost" href="${rel(v.file)}" ${NEWTAB}>Video file ↗</a></div>
</figure>`;
  }
  if (m.type === 'image') {
    return `<figure class="media"><a href="${screenUrl(hashOf(m))}" ${NEWTAB}><img src="${rel(m.file)}" alt="${esc(m.caption)}" loading="lazy"></a><figcaption><span>${esc(m.caption)}</span></figcaption><div class="openrow"><a class="btn" href="${screenUrl(hashOf(m))}" ${NEWTAB}>Open on second screen ↗</a><a class="btn ghost" href="${rel(m.file)}" ${NEWTAB}>Image file ↗</a></div></figure>`;
  }
  const head = m.head.map((h) => `<th scope="col">${esc(h)}</th>`).join('');
  const rows = m.rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`).join('');
  return `<div class="media tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function actHtml(a, i) {
  const say = a.say.map((p) => `<p>${esc(p)}</p>`).join('');
  const doList = a.do.map((d) => `<li>${esc(d)}</li>`).join('');
  return `<section class="act" id="${a.id}" aria-labelledby="h-${a.id}">
  <header class="acthead">
    <div class="time"><span>${a.start}</span><span class="len">${a.length}</span></div>
    <div><h2 id="h-${a.id}">${esc(a.title)}</h2><p class="goal">${esc(a.goal)}</p></div>
  </header>
  <div class="actbody${a.media.type === 'video' ? ' hasvideo' : ''}">
    <div class="say"><h3 class="label">What to say</h3>${say}</div>
    ${mediaHtml(a.media)}
  </div>
  <div class="do"><h3 class="label">What to do</h3><ul>${doList}</ul></div>
</section>`;
}

const nav = `<a class="navmedia" href="${screenUrl('full')}" ${NEWTAB}>Media screen ↗</a>` + C.acts.map((a) => `<a href="#${a.id}">${esc(a.title.replace(/^Demo \d: /, 'Demo: '))}</a>`).join('') + '<a href="#questions">Questions</a><a href="#appendix">Appendix</a>';

const html = `<title>Gaffer Presenter Script</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=IBM+Plex+Mono:wght@500;600&family=Public+Sans:wght@400;500;600;700&display=swap">
<style>
/* Layout concept: a rehearsal script. Each act pairs the words to say (left) with the thing to show (right), stage directions underneath. */
:root{
  --bg:#F1F4F1; --surface:#FFFFFF; --ink:#0E1B14; --muted:#53635A; --line:#D8E0D9;
  --accent:#0E7A4C; --accent-ink:#FFFFFF; --pitch:#0B3D2E; --pitch-ink:#EAF4EE; --pitch-dim:#9FD9BC;
  --say:#E6F2EA; --do:#FFF3D6; --do-ink:#6F4B00; --do-line:#EBD59B;
  --display:"Bricolage Grotesque","Avenir Next","Segoe UI",system-ui,sans-serif;
  --body:"Public Sans","Segoe UI",system-ui,-apple-system,sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --bg:#09110C; --surface:#111B15; --ink:#E8F0EA; --muted:#9DB0A4; --line:#22332A;
  --accent:#2BC27C; --accent-ink:#04160D; --pitch:#0A3225; --pitch-ink:#EAF4EE; --pitch-dim:#8FD2B2;
  --say:#12251B; --do:#2A2108; --do-ink:#F2C766; --do-line:#4A3B12; color-scheme:dark}}
:root[data-theme="dark"]{
  --bg:#09110C; --surface:#111B15; --ink:#E8F0EA; --muted:#9DB0A4; --line:#22332A;
  --accent:#2BC27C; --accent-ink:#04160D; --pitch:#0A3225; --pitch-ink:#EAF4EE; --pitch-dim:#8FD2B2;
  --say:#12251B; --do:#2A2108; --do-ink:#F2C766; --do-line:#4A3B12; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.55;margin:0}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);background:var(--pitch);z-index:30}
a{color:var(--accent)}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:4px}
.wrap{width:100%;max-width:1120px;margin-inline:auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.hero{background:var(--pitch);color:var(--pitch-ink)}
.hero .wrap{padding-block:56px 40px;display:grid;gap:18px}
.brand{display:flex;align-items:center;gap:10px;font-family:var(--mono);font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--pitch-dim)}
.brand i{width:14px;height:14px;border-radius:4px;background:#2BC27C;display:inline-block}
.hero h1{font-family:var(--display);font-weight:800;font-size:clamp(44px,8vw,92px);line-height:.95;letter-spacing:-.03em;margin:0}
.hero .sub{font-size:clamp(18px,2.4vw,24px);max-width:34ch;margin:0;color:var(--pitch-ink);text-wrap:balance}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.chip{font-family:var(--mono);font-size:13px;padding:5px 11px;border:1px solid rgba(234,244,238,.32);border-radius:999px;color:var(--pitch-ink)}
.cta{display:inline-block;margin-top:10px;background:#2BC27C;color:#04160D;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none;width:fit-content}
nav.toc{position:sticky;top:env(safe-area-inset-top,0px);z-index:20;background:var(--surface);border-bottom:1px solid var(--line)}
nav.toc .wrap{display:flex;gap:4px;overflow-x:auto;padding-block:8px;scrollbar-width:thin}
nav.toc a{white-space:nowrap;text-decoration:none;color:var(--muted);font-size:14px;font-weight:600;padding:6px 10px;border-radius:8px}
nav.toc a:hover{background:var(--say);color:var(--ink)}
main{padding-block:32px 72px;display:grid;gap:40px}
.label{font-family:var(--mono);font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:24px;display:grid;gap:12px}
.panel h2{font-family:var(--display);font-size:28px;line-height:1.1;margin:0;letter-spacing:-.01em}
.panel ul{margin:0;padding-left:20px;display:grid;gap:8px}
.panel.two{grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:28px}
.checks{list-style:none;padding:0!important;display:grid;gap:10px}
.checks label{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.checks input{margin-top:5px;width:18px;height:18px;flex:none;accent-color:var(--accent)}
.act{display:grid;gap:18px;scroll-margin-top:72px}
.acthead{display:grid;grid-template-columns:auto 1fr;gap:18px;align-items:start}
.time{font-family:var(--mono);display:grid;gap:2px;text-align:left;border-left:4px solid var(--accent);padding-left:12px;min-width:76px}
.time span:first-child{font-size:22px;font-weight:600}
.time .len{font-size:12px;color:var(--muted)}
.time .len::before{content:"runs "}
.act h2{font-family:var(--display);font-weight:800;font-size:clamp(28px,4vw,40px);line-height:1.05;letter-spacing:-.02em;margin:0;text-wrap:balance}
.goal{margin:6px 0 0;color:var(--muted);max-width:62ch}
.actbody{display:grid;gap:22px;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);align-items:start}
.actbody.hasvideo{grid-template-columns:minmax(0,.9fr) minmax(0,1.2fr)}
.say{background:var(--say);border-radius:16px;padding:22px 24px;min-width:0}
.say p{margin:0 0 14px;font-size:18px;line-height:1.6;max-width:60ch}
.say p:last-child{margin-bottom:0}
.media{margin:0;min-width:0}
.media video,.media img{width:100%;height:auto;display:block;border-radius:14px;background:#04100A;border:1px solid var(--line)}
.media figcaption{display:flex;justify-content:space-between;gap:12px;font-size:13px;color:var(--muted);padding-top:8px}
.tablewrap{overflow-x:auto;background:var(--surface);border:1px solid var(--line);border-radius:14px}
table{border-collapse:collapse;width:100%;font-size:14.5px}
th,td{text-align:left;vertical-align:top;padding:10px 14px;border-bottom:1px solid var(--line)}
thead th{font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);white-space:nowrap}
tbody th{font-weight:700}
tbody tr:last-child th,tbody tr:last-child td{border-bottom:0}
.openrow{display:flex;flex-wrap:wrap;gap:8px;padding-top:10px}
.btn{display:inline-block;background:var(--accent);color:var(--accent-ink);font-weight:700;font-size:14px;padding:9px 14px;border-radius:9px;text-decoration:none;border:1px solid var(--accent)}
.btn.ghost{background:transparent;color:var(--accent);border-color:var(--line)}
.btn:hover{filter:brightness(1.08)}
.ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}
.ctas .cta{margin-top:0}
.cta.ghost{background:transparent;color:var(--pitch-ink);border:1px solid rgba(234,244,238,.45)}
nav.toc a.navmedia{background:var(--accent);color:var(--accent-ink)}
nav.toc a.navmedia:hover{background:var(--accent);color:var(--accent-ink);filter:brightness(1.1)}
.do{background:var(--do);color:var(--do-ink);border:1px solid var(--do-line);border-radius:12px;padding:14px 18px}
.do .label{color:var(--do-ink)}
.do ul{margin:0;padding-left:20px;display:grid;gap:4px}
details{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:14px 18px}
details+details{margin-top:10px}
summary{cursor:pointer;font-weight:700;font-size:17px}
details p{margin:10px 0 0;max-width:70ch}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr));gap:16px}
.gallery figure{margin:0;display:grid;gap:8px;align-content:start}
.gallery img{width:100%;height:auto;border-radius:12px;border:1px solid var(--line);display:block;background:var(--surface)}
.gallery figcaption{font-size:13px;color:var(--muted)}
.timeline{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.timeline li{display:grid;grid-template-columns:120px 1fr;gap:14px}
.timeline b{font-family:var(--mono);font-size:13px;text-transform:uppercase;letter-spacing:.08em}
.sec h2{font-family:var(--display);font-size:clamp(26px,3.4vw,34px);margin:0 0 14px;letter-spacing:-.01em}
footer{border-top:1px solid var(--line);padding-block:24px 40px;color:var(--muted);font-size:14px}
code{font-family:var(--mono);font-size:.92em}
@media (max-width:860px){
  .actbody,.actbody.hasvideo{grid-template-columns:minmax(0,1fr)}
  .actbody .media{order:-1}
  .acthead{grid-template-columns:1fr}
  .timeline li{grid-template-columns:1fr;gap:2px}
}
</style>

<header class="hero"><div class="wrap">
  <div class="brand"><i></i>Presenter script and demo kit</div>
  <h1>${esc(C.title)}</h1>
  <p class="sub">${esc(C.tagline)}</p>
  <div class="chips"><span class="chip">${esc(C.audience)}</span><span class="chip">${runtimeLabel}</span><span class="chip">${clipTotal ? mmss(clipTotal) : '—'} of demo clips</span><span class="chip">${shotCount} screenshots</span></div>
  <div class="ctas"><a class="cta" href="${screenUrl('full')}" ${NEWTAB}>Open media screen ↗</a><a class="cta ghost" href="#full">Play the full demo here</a></div>
</div></header>
<nav class="toc" aria-label="Sections"><div class="wrap">${nav}</div></nav>

<main class="wrap">
  <section class="panel two" id="start" aria-label="How to use this page">
    <div><h2>How to use this</h2><ul>${C.howToUse.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div><h2>Before you start</h2><ul class="checks">${C.preflight.map((x, i) => `<li><label><input type="checkbox" id="pf-${i}"><span>${esc(x)}</span></label></li>`).join('')}</ul></div>
  </section>

  <section class="sec" id="full">
    <h2>The whole demo in one file</h2>
    <figure class="media">
      <video id="v-full" controls preload="metadata" playsinline poster="${rel(vids.full.poster)}"><source src="${rel(vids.full.file)}" type="video/mp4"></video>
      <figcaption><span>${esc(vids.full.title)} · ${mmss(vids.full.secs)} · silent, narrate from the script below</span></figcaption>
      <div class="openrow"><a class="btn" href="${screenUrl('full')}" ${NEWTAB}>Open on second screen ↗</a><a class="btn ghost" href="${rel(vids.full.file)}" ${NEWTAB}>Video file ↗</a></div>
    </figure>
  </section>

${C.acts.map(actHtml).join('\n')}

  <section class="sec" id="questions">
    <h2>Questions you may get</h2>
    ${C.qa.map((x) => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('\n    ')}
  </section>

  <section class="sec" id="appendix">
    <h2>Appendix</h2>
    <div class="panel" style="margin-bottom:24px"><h3 class="label">Screenshots (click to open on the second screen)</h3>
      <div class="gallery">${C.gallery.map(([f, c]) => `<figure><a href="${screenUrl(path.basename(f, '.png'))}" ${NEWTAB}><img src="${rel(f)}" alt="${esc(c)}" loading="lazy"></a><figcaption>${esc(c)}</figcaption></figure>`).join('')}</div>
    </div>
    <div class="panel two" style="margin-bottom:24px">
      <div><h3 class="label">What we did, start to finish</h3><ol class="timeline" style="padding:0">${C.recap.map((r) => `<li><b>${esc(r.phase)}</b><span>${esc(r.what)}</span></li>`).join('')}</ol></div>
      <div><h3 class="label">Problems the testing caught</h3><ul>${C.bugs.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>
    </div>
    <div class="panel" style="margin-bottom:24px"><h3 class="label">Sources for the market slide</h3>
      <ul>${C.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul>
      <p style="margin:0;color:var(--muted);font-size:14px">These came from a limited set of searches. Several are vendor blogs or comparison sites. Verify any figure before quoting it outside this meeting.</p>
    </div>
    <div class="panel"><h3 class="label">Run it yourself</h3>
      <p style="margin:0">Code and README: <a href="${esc(C.repo)}" target="_blank" rel="noopener">${esc(C.repo)}</a></p>
      <p style="margin:0"><code>npm install</code> then <code>npm run web</code>, then tap “Load demo club”. The demo recordings are reproducible with the scripts in the <code>demo/</code> folder.</p>
    </div>
  </section>
</main>
<footer><div class="wrap">Gaffer presenter kit. All demo data is simulated. Built from the repository above.</div></footer>
<script>
(function(){
  try{document.querySelectorAll('.checks input').forEach(function(el){
    var k='gaffer-pf-'+el.id; if(localStorage.getItem(k)==='1') el.checked=true;
    el.addEventListener('change',function(){try{localStorage.setItem(k,el.checked?'1':'0')}catch(e){}});
  });}catch(e){}
  // only one clip plays at a time
  var vs=[].slice.call(document.querySelectorAll('video'));
  vs.forEach(function(v){v.addEventListener('play',function(){vs.forEach(function(o){if(o!==v)o.pause();});});});
})();
</script>
`;

// ------------------------------------------------------------------ Markdown
function mediaMd(m) {
  if (m.type === 'video') {
    const v = vids[m.key];
    return `▶ **[${v.title} (${mmss(v.secs)})](${rel(v.file)})**  \n[![${v.title}](${rel(v.poster)})](${rel(v.file)})`;
  }
  if (m.type === 'image') return `![${m.caption}](${rel(m.file)})\n\n*${m.caption}*`;
  const head = `| ${m.head.join(' | ')} |\n| ${m.head.map(() => '---').join(' | ')} |`;
  return `${head}\n${m.rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`;
}

const md = `# ${C.title}: ${C.subtitle}

> ${C.tagline}
>
> Audience: ${C.audience}. ${runtimeLabel[0].toUpperCase() + runtimeLabel.slice(1)}. ${mmss(clipTotal)} of demo clips, ${shotCount} screenshots.
>
> The same content, with the videos playable inline, is published as a web page. This file is the copy that lives with the code.
>
> Second screen: open \`media.html\` (next to this file) in a browser on your other display. It shows any clip or image full size, with keyboard shortcuts. In the published web page, every section has an “Open on second screen” button.

## How to use this

${C.howToUse.map((x) => `- ${x}`).join('\n')}

## Before you start

${C.preflight.map((x) => `- [ ] ${x}`).join('\n')}

## Demo clips

| Clip | Length | File |
| --- | --- | --- |
${['full', 'fairness', 'live', 'owner', 'develop'].map((k) => `| ${vids[k].title} | ${mmss(vids[k].secs)} | [${path.basename(vids[k].file)}](${rel(vids[k].file)}) |`).join('\n')}

## Script

${C.acts
  .map(
    (a, i) => `### ${i + 1}. ${a.title}

**Time:** starts at ${a.start}, runs about ${a.length}
**Goal:** ${a.goal}

**On screen**

${mediaMd(a.media)}

**What to do**

${a.do.map((d) => `- ${d}`).join('\n')}

**What to say**

${a.say.map((p) => `> ${p}`).join('\n>\n')}
`,
  )
  .join('\n')}
## Questions you may get

${C.qa.map((x) => `**${x.q}**  \n${x.a}\n`).join('\n')}
## Appendix

### Screenshots

${C.gallery.map(([f, c]) => `![${c}](${rel(f)})  \n*${c}*\n`).join('\n')}
### What we did, start to finish

${C.recap.map((r) => `- **${r.phase}.** ${r.what}`).join('\n')}

### Problems the testing caught

${C.bugs.map((b) => `- ${b}`).join('\n')}

### Sources for the market slide

${C.sources.map((s) => `- [${s.label}](${s.url})`).join('\n')}

These came from a limited set of searches. Several are vendor blogs or comparison sites. Verify any figure before quoting it outside this meeting.

### Run it yourself

Code: ${C.repo}

\`npm install\` then \`npm run web\`, then tap "Load demo club". The recordings are reproducible with the scripts in \`demo/\`: start the server (\`node demo/serve.js\`), then run \`demo/record.js\` and \`demo/screenshots.js\` with Playwright installed.
`;


// ------------------------------------------------------------------ second-screen media page (a full standalone document)
function mediaScreenHtml() {
  const items = [];
  for (const k of ['full', 'fairness', 'live', 'owner', 'develop']) {
    const v = vids[k];
    items.push({ id: k, type: 'video', group: 'Demo clips', title: v.title, meta: mmss(v.secs), src: rel(v.file), poster: rel(v.poster) });
  }
  for (const [f, c] of C.gallery) items.push({ id: path.basename(f, '.png'), type: 'image', group: 'Screenshots', title: c, meta: 'screenshot', src: rel(f) });
  const framedDir = path.join(MEDIA, 'framed');
  const framed = fs.existsSync(framedDir) ? fs.readdirSync(framedDir).filter((x) => x.endsWith('.png')).sort() : [];
  const pretty = (n) => n.replace(/\.png$/, '').replace(/^(\w+)-(\d)-/, (_, a, b) => `${a[0].toUpperCase() + a.slice(1)} ${b}: `).replace(/-/g, ' ');
  for (const f of framed) items.push({ id: f.replace(/\.png$/, ''), type: 'image', group: 'Phone-framed stills', title: pretty(f), meta: 'still', src: rel(`framed/${f}`) });
  const data = JSON.stringify(items).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gaffer Media Screen</title>
<style>
:root{color-scheme:dark;--bg:#070E0A;--panel:#0E1A13;--line:#1F3328;--ink:#E8F0EA;--muted:#93A89A;--accent:#2BC27C;--accent-ink:#04160D}
*{box-sizing:border-box}
html,body{height:100%;margin:0}
body{background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:grid;grid-template-columns:320px minmax(0,1fr);overflow:hidden}
aside{background:var(--panel);border-right:1px solid var(--line);overflow-y:auto;padding:16px 12px 24px}
aside h1{font-size:15px;letter-spacing:.14em;text-transform:uppercase;margin:4px 8px 4px;color:var(--accent)}
aside p.hint{margin:0 8px 14px;color:var(--muted);font-size:13px;line-height:1.45}
aside h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:18px 8px 6px}
.list{display:grid;gap:4px}
.item{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;text-align:left;width:100%;background:transparent;color:var(--ink);border:1px solid transparent;border-radius:10px;padding:9px 10px;font:inherit;font-size:14px;cursor:pointer}
.item:hover{background:#13241A}
.item[aria-current="true"]{background:#16301F;border-color:var(--accent)}
.item .key{font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--accent-ink);background:var(--accent);border-radius:5px;min-width:20px;text-align:center;padding:1px 5px}
.item .key.none{background:#1F3328;color:var(--muted)}
.item .meta{color:var(--muted);font-size:12px}
.thumbs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:0 4px}
.thumb{padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#000;cursor:pointer;aspect-ratio:1/1.5}
.thumb img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}
.thumb[aria-current="true"]{border-color:var(--accent)}
.thumbs.wide{grid-template-columns:repeat(2,1fr)}
.thumbs.wide .thumb{aspect-ratio:16/10}
main{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-width:0;height:100vh}
header.bar{display:flex;gap:12px;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid var(--line)}
header.bar h2{margin:0;font-size:18px}
header.bar .sub{color:var(--muted);font-size:13px}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.actions button,.actions a{background:#16301F;color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:8px 12px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none}
.actions button:hover,.actions a:hover{border-color:var(--accent)}
#stage{display:flex;align-items:center;justify-content:center;padding:16px;min-height:0;background:#000}
#stage video,#stage img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block;border-radius:6px}
footer.keys{padding:9px 20px;border-top:1px solid var(--line);color:var(--muted);font-size:12.5px}
kbd{font-family:ui-monospace,Menlo,monospace;background:#16301F;border:1px solid var(--line);border-radius:5px;padding:1px 6px;color:var(--ink)}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
@media (max-width:860px){body{grid-template-columns:1fr;grid-template-rows:auto 1fr;overflow:auto;height:auto}aside{border-right:0;border-bottom:1px solid var(--line);max-height:38vh}main{height:auto;min-height:70vh}#stage{min-height:50vh}}
</style></head>
<body>
<aside aria-label="Media list">
  <h1>Gaffer media screen</h1>
  <p class="hint">Keep the script on your other screen. Pick a clip or image here, or use the keyboard.</p>
  <div id="lists"></div>
</aside>
<main>
  <header class="bar"><div><h2 id="title">Loading</h2><div class="sub" id="sub"></div></div>
    <div class="actions"><button id="fs" type="button">Full screen (F)</button><a id="file" href="#" target="_blank" rel="noopener">Open file ↗</a></div></header>
  <div id="stage" aria-live="polite"></div>
  <footer class="keys"><kbd>Space</kbd> play or pause · <kbd>0</kbd> full demo · <kbd>1</kbd>–<kbd>4</kbd> demos 1 to 4 · <kbd>←</kbd> <kbd>→</kbd> previous or next · <kbd>F</kbd> full screen · clips have no sound, so narrate over them</footer>
</main>
<script>
(function(){
  var ITEMS=${data};
  var cur=0, stage=document.getElementById('stage');
  var groups=[]; ITEMS.forEach(function(it){ if(groups.indexOf(it.group)<0) groups.push(it.group); });
  var lists=document.getElementById('lists'), nodes={};
  groups.forEach(function(g){
    var h=document.createElement('h2'); h.textContent=g; lists.appendChild(h);
    var wrap=document.createElement('div');
    var isVid=g==='Demo clips';
    wrap.className=isVid?'list':'thumbs'+(g==='Phone-framed stills'?' wide':'');
    ITEMS.forEach(function(it,i){
      if(it.group!==g) return;
      var b=document.createElement('button'); b.type='button'; b.setAttribute('data-i',i);
      if(isVid){
        b.className='item';
        var k=document.createElement('span'); k.className='key'; k.textContent=it.id==='full'?'0':String(ITEMS.filter(function(x){return x.group===g&&x.id!=='full';}).indexOf(it)+1); b.appendChild(k);
        var t=document.createElement('span'); t.textContent=it.title; b.appendChild(t);
        var m=document.createElement('span'); m.className='meta'; m.textContent=it.meta; b.appendChild(m);
      } else {
        b.className='thumb'; b.title=it.title; b.setAttribute('aria-label',it.title);
        var im=document.createElement('img'); im.src=it.src; im.alt=''; im.loading='lazy'; b.appendChild(im);
      }
      b.addEventListener('click',function(){ select(i,true); });
      nodes[i]=b; wrap.appendChild(b);
    });
    lists.appendChild(wrap);
  });
  function select(i,push){
    if(i<0||i>=ITEMS.length) return;
    cur=i; var it=ITEMS[i];
    Object.keys(nodes).forEach(function(k){ nodes[k].setAttribute('aria-current', String(+k===i)); });
    stage.innerHTML='';
    var el;
    if(it.type==='video'){ el=document.createElement('video'); el.controls=true; el.playsInline=true; el.preload='auto'; el.poster=it.poster||''; el.src=it.src; }
    else { el=document.createElement('img'); el.src=it.src; el.alt=it.title; }
    stage.appendChild(el);
    document.getElementById('title').textContent=it.title;
    document.getElementById('sub').textContent=it.type==='video'?('Video · '+it.meta+' · no audio'):'Image';
    var f=document.getElementById('file'); f.href=it.src;
    document.title=it.title+' · Gaffer media screen';
    if(push){ try{ history.replaceState(null,'','#'+it.id); }catch(e){ location.hash=it.id; } }
    if(nodes[i] && nodes[i].className.indexOf('thumb')===0 && nodes[i].scrollIntoView) nodes[i].scrollIntoView({block:'nearest'});
  }
  function fromHash(){
    var id=(location.hash||'').replace('#','');
    for(var i=0;i<ITEMS.length;i++){ if(ITEMS[i].id===id){ select(i,false); return; } }
    select(0,false);
  }
  function toggleFs(){
    var d=document, el=stage;
    if(d.fullscreenElement){ d.exitFullscreen(); } else if(el.requestFullscreen){ el.requestFullscreen().catch(function(){}); }
  }
  document.getElementById('fs').addEventListener('click',toggleFs);
  window.addEventListener('hashchange',fromHash);
  window.addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    var v=stage.querySelector('video');
    if(e.key===' '||e.code==='Space'){ if(v){ e.preventDefault(); if(v.paused) v.play(); else v.pause(); } }
    else if(e.key==='ArrowRight'){ select((cur+1)%ITEMS.length,true); }
    else if(e.key==='ArrowLeft'){ select((cur-1+ITEMS.length)%ITEMS.length,true); }
    else if(e.key==='f'||e.key==='F'){ toggleFs(); }
    else if(e.key==='0'){ select(0,true); }
    else if(/^[1-4]$/.test(e.key)){ select(+e.key,true); }
  });
  fromHash();
})();
</script>
</body></html>
`;
}

if (MEDIA_HTML_OUT) {
  fs.writeFileSync(MEDIA_HTML_OUT, mediaScreenHtml());
  console.log('wrote', MEDIA_HTML_OUT);
}
if (HTML_OUT) {
  fs.mkdirSync(path.dirname(HTML_OUT), { recursive: true });
  fs.writeFileSync(HTML_OUT, html);
  console.log('wrote', HTML_OUT, `${Math.round(html.length / 1024)}KB`);
}
if (MD_OUT) {
  fs.mkdirSync(path.dirname(MD_OUT), { recursive: true });
  fs.writeFileSync(MD_OUT, md);
  console.log('wrote', MD_OUT);
}
