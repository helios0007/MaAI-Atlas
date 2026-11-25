// MaAI Atlas UI shell: the guide dialog, keyboard shortcuts and the panel collapse.
// app.js owns the scene and the data views; this file only adds the chrome around them.
const $ = (id) => document.getElementById(id);
const SEEN_KEY = 'maai-atlas-guide-seen';

function store(get, value) {
  try {
    if (get) return localStorage.getItem(SEEN_KEY);
    localStorage.setItem(SEEN_KEY, value);
  } catch { /* storage can be blocked; the guide then opens each visit */ }
  return null;
}

let lastFocus = null;
function openGuide() {
  lastFocus = document.activeElement;
  $('about-overlay').hidden = false;
  $('about-close').focus();
}
function closeGuide() {
  $('about-overlay').hidden = true;
  store(false, '1');
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

['btn-about', 'btn-about-top'].forEach((id) => $(id).addEventListener('click', openGuide));
$('about-close').addEventListener('click', closeGuide);
$('about-start').addEventListener('click', closeGuide);
$('about-overlay').addEventListener('click', (e) => { if (e.target.id === 'about-overlay') closeGuide(); });

// Click the active rail tab again to hide or show the left panel.
// The document capture listener runs before the app.js handler changes the active tab.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.rail-btn.tab');
  if (!btn) return;
  const collapse = btn.classList.contains('active') && !document.body.classList.contains('panel-collapsed');
  document.body.classList.toggle('panel-collapsed', collapse);
}, true);

window.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  if (e.key === 'Escape' && !$('about-overlay').hidden) { e.stopImmediatePropagation(); closeGuide(); return; }
  if (!typing && (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
    e.preventDefault();
    $('search-input').focus();
  }
  if (!typing && e.key === '?') openGuide();
}, true);

// Counts for the "This run" block come from the same file app.js loads.
fetch('data/atlas_meta.json').then((r) => r.json()).then((meta) => {
  const st = meta.stats || {};
  $('about-synthetic').hidden = !meta.synthetic;
  const rows = [
    [meta.projects?.length, 'projects'],
    [meta.branches?.filter((b) => !b.is_frontier).length, 'research branches'],
    [meta.gaps?.length, 'gaps found'],
    [st.raw_references != null ? `${st.raw_references} → ${st.unique_sources}` : null, 'references after cleaning'],
    [st.stability_ari != null ? st.stability_ari.toFixed(2) : null, 'branch stability (ARI)'],
  ].filter(([v]) => v != null);
  $('about-stats').innerHTML = rows.map(([v, l]) => `<div class="run-stat"><b>${v}</b><span>${l}</span></div>`).join('');
}).catch(() => { $('about-stats').innerHTML = '<span class="muted small">Run the pipeline to see the counts.</span>'; });

// The Programmes page (home.js) is the first screen now; the guide opens only from its buttons or "?".
