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

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rel = (f) => `media/${f}`;

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
  <figcaption><span>${esc(v.title)} · ${mmss(v.secs)}</span><a href="${rel(v.file)}" target="_blank" rel="noopener">Open file</a></figcaption>
</figure>`;
  }
  if (m.type === 'image') {
    return `<figure class="media"><a href="${rel(m.file)}" target="_blank" rel="noopener"><img src="${rel(m.file)}" alt="${esc(m.caption)}" loading="lazy"></a><figcaption><span>${esc(m.caption)}</span><a href="${rel(m.file)}" target="_blank" rel="noopener">Open image</a></figcaption></figure>`;
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

const nav = C.acts.map((a) => `<a href="#${a.id}">${esc(a.title.replace(/^Demo \d: /, 'Demo: '))}</a>`).join('') + '<a href="#questions">Questions</a><a href="#appendix">Appendix</a>';

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
.checks input{margin-top:5px;width:18px;height:18px;accent-color:var(--accent)}
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
  <a class="cta" href="#full">Play the full demo</a>
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
      <figcaption><span>${esc(vids.full.title)} · ${mmss(vids.full.secs)} · silent, narrate from the script below</span><a href="${rel(vids.full.file)}" target="_blank" rel="noopener">Open file</a></figcaption>
    </figure>
  </section>

${C.acts.map(actHtml).join('\n')}

  <section class="sec" id="questions">
    <h2>Questions you may get</h2>
    ${C.qa.map((x) => `<details><summary>${esc(x.q)}</summary><p>${esc(x.a)}</p></details>`).join('\n    ')}
  </section>

  <section class="sec" id="appendix">
    <h2>Appendix</h2>
    <div class="panel" style="margin-bottom:24px"><h3 class="label">Screenshots (open any image at full size)</h3>
      <div class="gallery">${C.gallery.map(([f, c]) => `<figure><a href="${rel(f)}" target="_blank" rel="noopener"><img src="${rel(f)}" alt="${esc(c)}" loading="lazy"></a><figcaption>${esc(c)}</figcaption></figure>`).join('')}</div>
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
