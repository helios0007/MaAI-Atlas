// Programmes start page: a flat grid of IAAC programmes (same structure as the IAAC blog front page),
// then the cohorts of the chosen programme. Only MaAI has an Atlas now; the other cards show their
// blog categories so the pipeline can add them later.
// Post counts come from the public WordPress API of blog.iaac.net (categories endpoint), read on 2026-11-24.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PROGRAMMES = [
  { abbr: 'MAA', name: 'Master in Advanced Architecture', editions: [880, 449], hue: 32 },
  { abbr: 'MACT', name: 'Master in City and Technology', editions: [434, 123], hue: 200 },
  { abbr: 'MAEBB', name: 'Master in Advanced Ecological Buildings and Biocities', editions: [242, 41], hue: 110 },
  { abbr: 'MRAC', name: 'Master in Robotics and Advanced Construction', editions: [270, 68], hue: 0 },
  { abbr: '3DPA', name: 'Postgraduate in 3D Printing Architecture', posts: 68, hue: 290 },
  { abbr: 'MaCAD', name: 'Master in Advanced Computation for Architecture and Design', posts: 823, hue: 230 },
  { abbr: 'MDDI', name: 'Master in Design for Distributed Innovation', external: true, hue: 170 },
  { abbr: 'MDEF', name: 'Master in Design for Emergent Futures', external: true, hue: 320 },
  { abbr: 'MaUP', name: 'Maestría en Urbanismo Próximo', posts: 198, hue: 60 },
  { abbr: 'MaAI', name: 'Master in AI for Architecture and the Built Environment', editions: [34, 16], live: true, hue: 45 },
];
// Blog edition suffix -> Atlas cohort (same table as pipeline/ingest_iaac_blog.py)
const EDITION_OF_COHORT = { '24/25': '01', '25/26': '02' };

let meta = null;
let api = null;
let lastFocus = null;

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function rng(seed) { return () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9 >>> 0) / 4294967296); }

// MaAI: a small copy of the real map (one dot per project, branch colour).
function liveThumb() {
  const ps = meta.projects.filter((p) => p.xy);
  const xs = ps.map((p) => p.xy[0]), ys = ps.map((p) => p.xy[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (x) => 12 + (x - x0) / (x1 - x0) * 296, sy = (y) => 168 - (y - y0) / (y1 - y0) * 156;
  const dots = ps.map((p) => {
    const c = meta.branches[p.branch_idx]?.color || '#fff';
    return `<circle cx="${sx(p.xy[0]).toFixed(1)}" cy="${sy(p.xy[1]).toFixed(1)}" r="5" fill="${c}" opacity="0.16"/><circle cx="${sx(p.xy[0]).toFixed(1)}" cy="${sy(p.xy[1]).toFixed(1)}" r="1.4" fill="#fff" opacity="0.9"/>`;
  }).join('');
  return `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" fill="#000"/>${dots}</svg>`;
}

// Other programmes: an abstract pattern, unique per programme, muted (no data behind it yet).
function patternThumb(p) {
  const r = rng(hash(p.abbr));
  let s = '';
  const kind = hash(p.abbr) % 3;
  for (let k = 0; k < 70; k++) {
    const x = r() * 320, y = r() * 180, l = 40 + r() * 30;
    if (kind === 0) s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + r() * 2.2).toFixed(1)}" fill="hsl(${p.hue},45%,${l.toFixed(0)}%)" opacity="0.55"/>`;
    else if (kind === 1) s += `<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + 24 * Math.cos(k)).toFixed(0)}" y2="${(y + 24 * Math.sin(k)).toFixed(0)}" stroke="hsl(${p.hue},40%,${l.toFixed(0)}%)" stroke-width="1" opacity="0.5"/>`;
    else s += `<rect x="${(Math.round(x / 20) * 20).toFixed(0)}" y="${(Math.round(y / 20) * 20).toFixed(0)}" width="14" height="14" rx="2" fill="none" stroke="hsl(${p.hue},40%,${l.toFixed(0)}%)" opacity="0.45"/>`;
  }
  return `<svg viewBox="0 0 320 180" aria-hidden="true"><rect width="320" height="180" fill="hsl(${p.hue},25%,6%)"/>${s}</svg>`;
}

function statusOf(p) {
  if (p.live) return `<span class="hp-chip live"><i></i>Atlas live · ${meta.cohorts.length} cohorts</span>`;
  if (p.external) return '<span class="hp-chip">Blog outside the IAAC blog</span>';
  return '<span class="hp-chip">Not in the Atlas yet</span>';
}

function renderGrid() {
  $('home-crumb').innerHTML = '<b>Programmes</b>';
  $('home-lead').textContent = 'Choose your programme, then your cohort, to add your work to the Atlas.';
  $('home-body').innerHTML = `<div class="hp-grid">${PROGRAMMES.map((p, i) => `
    <button class="hp-card ${p.live ? 'is-live' : ''}" data-i="${i}">
      <span class="hp-thumb">${p.live ? liveThumb() : patternThumb(p)}</span>
      <span class="hp-abbr">${esc(p.abbr)}</span>
      <span class="hp-name">${esc(p.name)}</span>
      ${statusOf(p)}
    </button>`).join('')}</div>`;
  $('home-body').querySelectorAll('.hp-card').forEach((b) => b.addEventListener('click', () => renderProgramme(PROGRAMMES[Number(b.dataset.i)])));
}

function crumb(p) {
  $('home-crumb').innerHTML = `<button class="hp-link" id="home-back"><svg class="ic sm" viewBox="0 0 24 24"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>Programmes</button><span class="hp-sep">/</span><b>${esc(p.abbr)}</b>`;
  $('home-back').addEventListener('click', renderGrid);
}

function renderProgramme(p) {
  crumb(p);
  if (!p.live) {
    $('home-lead').textContent = p.name;
    const eds = p.editions ? p.editions.map((n, i) => `<div class="hp-stat"><b>${n}</b><span>blog posts · edition 0${i + 1}</span></div>`).join('')
      : p.posts ? `<div class="hp-stat"><b>${p.posts}</b><span>blog posts</span></div>` : '';
    $('home-body').innerHTML = `
      <div class="hp-empty">
        <svg class="ic"><use href="assets/icons/atlas-icons.svg#i-scaffold"/></svg>
        <h3>This programme is not in the Atlas yet</h3>
        <p>${p.external
          ? 'Its projects are published on a separate site, not on the IAAC blog. A new connector is necessary to read them.'
          : 'The pipeline can read its blog category with the same connector as MaAI. Faculty must first approve the cohort table and what can be published.'}</p>
        ${eds ? `<div class="hp-stats">${eds}</div>` : ''}
        <button class="hp-btn ghost" id="hp-back2">Back to programmes</button>
      </div>`;
    $('hp-back2').addEventListener('click', renderGrid);
    return;
  }
  $('home-lead').textContent = `${p.name}. Choose your cohort.`;
  const counts = meta.cohorts.map((_, i) => meta.projects.filter((x) => x.cohort_idx === i).length);
  const max = Math.max(...counts, 1);
  $('home-body').innerHTML = `
    ${meta.synthetic ? '<p class="hp-note">The projects in these cohorts are synthetic. A real upload is saved in your browser and exported as JSON for faculty review.</p>' : ''}
    <div class="hp-cohorts">${meta.cohorts.map((c, i) => {
      const ed = EDITION_OF_COHORT[c];
      const branches = new Set(meta.projects.filter((x) => x.cohort_idx === i).map((x) => x.branch_idx)).size;
      return `
      <div class="hp-cohort">
        <div class="hp-c-head"><span class="hp-c-year">${esc(c)}</span><span class="hp-chip">${ed ? `Blog edition ${ed}` : 'No blog edition yet'}</span></div>
        <div class="hp-c-bar"><i style="width:${(counts[i] / max * 100).toFixed(0)}%"></i></div>
        <div class="hp-c-meta"><span><b>${counts[i]}</b> projects</span><span><b>${branches}</b> branches</span></div>
        <div class="hp-c-actions">
          <button class="hp-btn primary" data-add="${i}"><svg class="ic sm"><use href="assets/icons/atlas-icons.svg#i-stone-add"/></svg>Add my work</button>
          <button class="hp-btn ghost" data-explore="${i}"><svg class="ic sm"><use href="assets/icons/atlas-icons.svg#i-map"/></svg>Explore</button>
        </div>
      </div>`;
    }).join('')}</div>`;
  $('home-body').querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { closeHome(); api.openUpload(Number(b.dataset.add)); }));
  $('home-body').querySelectorAll('[data-explore]').forEach((b) => b.addEventListener('click', () => { closeHome(); api.showCohort(Number(b.dataset.explore)); }));
}

export function openHome() {
  if (!meta) return;
  lastFocus = document.activeElement;
  renderGrid();
  $('home').hidden = false;
  document.body.classList.add('home-open');
  $('home-skip').focus();
}
export function closeHome() {
  $('home').hidden = true;
  document.body.classList.remove('home-open');
  if (lastFocus && lastFocus.focus && lastFocus !== document.body) lastFocus.focus();
}

window.addEventListener('atlas-ready', (e) => {
  ({ meta, api } = e.detail);
  $('home-skip').addEventListener('click', closeHome);
  $('btn-home').addEventListener('click', openHome);
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !$('home').hidden) { ev.stopImmediatePropagation(); closeHome(); }
  }, true);
  if (!location.hash) openHome();
});
