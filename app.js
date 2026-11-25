import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SemanticSearch } from './search.js';
import { CitationNetwork } from './network.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Cosmos, layoutGalaxies } from './cosmos.js';
import { WINDOW, localMorph, bezier, stoneDelay, ghostDelay, camPose } from './morph.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const smooth = (m) => m * m * (3 - 2 * m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GAP_TYPES = {
  density: { label: 'Sparse region', color: '#FACC15', long: 'Empty region of the map between branches' },
  untested: { label: 'Untested combo', color: '#F472B6', long: 'Method × domain pairing no project has tried' },
  external: { label: 'External topic', color: '#60A5FA', long: 'Strong in outside literature, weak in MaAI' },
  fading: { label: 'Fading branch', color: '#94A3B8', long: 'Branch losing share across cohorts' },
};
const STORAGE_KEY = 'maai-atlas-added-v2';
const RUBRIC_LABELS = ['README', 'Dependencies', 'Pinned versions', 'Data available', 'Licence', 'Entry point'];

// ---------------------------------------------------------------------------
// GPU morph shader (2D semantic map <-> 3D basilica)
// ---------------------------------------------------------------------------
const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aPosUmap;
  attribute vec3 aColor;
  attribute float aCohort;
  attribute float aBuilt;
  attribute float aBranch;
  attribute float aZone;
  attribute float aProj;
  attribute float aFlash;
  attribute float aMatch;
  attribute vec3 aPosCosmos;
  attribute vec2 aStar;       // x = galaxy core 0-1, y = random seed
  attribute float aDelay;     // start of this point's flight, 0-0.55 (morph.js)

  uniform float uMorph;
  uniform float uCosmos;      // space style 0-1
  uniform float uCohortN;
  uniform float uTime;
  uniform float uMaxCohort;
  uniform float uShowGhosts;
  uniform float uFocusMode;   // 0 none, 1 branch, 2 zone
  uniform float uFocusValue;
  uniform float uSelected;
  uniform float uHover;
  uniform float uSearchActive;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vCos;

  void main() {
    // local morph: each point starts at its own time (stones bottom-up, then scaffold)
    float m = smoothstep(0.0, 1.0, clamp((uMorph - aDelay) / ${WINDOW.toFixed(2)}, 0.0, 1.0));
    // quadratic Bezier flight from the map to the stone, swinging toward the viewer (same as morph.js)
    vec3 p0 = mix(aPosUmap, aPosCosmos, uCosmos);
    vec3 ctrl = 0.5 * (p0 + position) + vec3(0.0, -6.0, 16.0 + (aBranch - 2.5) * 3.0);
    float im = 1.0 - m;
    vec3 pos = im * im * p0 + 2.0 * im * m * ctrl + m * m * position;
    float c = uCosmos * (1.0 - m);

    bool isBuilt = (aBuilt > 0.5) && (aCohort <= uMaxCohort + 0.01);
    if (!isBuilt) pos.y += sin(uTime * 1.3 + position.x * 0.25 + position.z * 0.25) * 0.22 * m;
    if (aFlash > 0.01) pos.y += aFlash * 14.0 * m;

    float focus = 1.0;
    if (uFocusMode > 0.5 && uFocusMode < 1.5) focus = abs(aBranch - uFocusValue) < 0.2 ? 1.0 : 0.12;
    else if (uFocusMode > 1.5) focus = abs(aZone - uFocusValue) < 0.2 ? 1.0 : 0.12;

    float sel = (uSelected > -0.5 && abs(aProj - uSelected) < 0.5) ? 1.0 : 0.0;
    float hov = (uHover > -0.5 && abs(aProj - uHover) < 0.5) ? 1.0 : 0.0;

    float alpha = 0.0;
    float ptSize = 2.0;
    vec3 col = aColor;
    if (isBuilt) {
      alpha = mix(0.5, 0.86, m) * focus;
      ptSize = mix(3.4, 2.05, m);
      if (c > 0.001) {
        // star colour = cohort temperature (old warm, new hot), core burns white
        float t = clamp(aCohort / max(uCohortN - 1.0, 1.0), 0.0, 1.0);
        vec3 temp = mix(vec3(1.0, 0.58, 0.34), vec3(0.58, 0.76, 1.0), t);
        vec3 sc = mix(mix(col, temp, 0.5), vec3(1.0, 0.97, 0.92), aStar.x * aStar.x * 0.55);
        col = mix(col, sc, c);
        float tw = 0.8 + 0.2 * sin(uTime * (1.2 + aStar.y * 2.4) + aStar.y * 60.0);
        alpha = mix(alpha, (0.07 + 0.22 * aStar.x * aStar.x) * mix(tw, 1.0, aStar.x) * focus, c);
        ptSize = mix(ptSize, 1.3 + 1.9 * aStar.x + 0.8 * step(0.985, aStar.y), c);
      }
      if (uSearchActive > 0.5) {
        if (aMatch > 0.5) { alpha = 0.95; ptSize += 1.3; } else { alpha *= 0.1; }
      }
      if (sel > 0.5 || hov > 0.5) {
        col = mix(col, vec3(1.0), sel > 0.5 ? 0.45 : 0.25);
        ptSize += sel > 0.5 ? 2.4 : 1.2;
        alpha = max(alpha, 0.95);
      }
    } else if (uShowGhosts > 0.5) {
      alpha = mix(0.08, 0.20, m) * focus;
      ptSize = mix(1.7, 1.55, m);
      // space style: scaffold points become faint dust in the voids
      col = mix(col, vec3(0.5, 0.34, 0.24), c);
      alpha = mix(alpha, 0.07 * focus, c);
      if (uSearchActive > 0.5) alpha *= 0.4;
    }

    col = mix(col, vec3(1.0, 0.88, 0.45), aFlash);
    if (aFlash > 0.01) { ptSize += aFlash * 4.0; alpha = max(alpha, 0.98); }

    vColor = col;
    vAlpha = alpha;
    vCos = c;
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(ptSize * uPixelRatio * (145.0 / max(-mvPosition.z, 10.0)), 1.0, 14.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vCos;
  uniform float uDim;         // focus mode: 1 = normal, lower = dimmed
  void main() {
    if (vAlpha < 0.004) discard;
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float disc = smoothstep(0.5, 0.12, d);
    float glow = exp(-d * d * 26.0) + 0.18 * exp(-d * d * 7.0);
    gl_FragColor = vec4(vColor * uDim, vAlpha * uDim * mix(disc, glow, vCos));
  }
`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let meta = null;
let search = null;
let pointCount = 0;
let geometry = null;
let material = null;
let A = {}; // attribute arrays for CPU-side picking
let network = null;
const flashing = new Set();

const state = {
  morph: 1.0,
  targetMorph: 1.0,
  tween: null,       // { m0, m1, t, dur, cam: { from, to } | null }
  maxCohort: 99,
  focusMode: 0,
  focusValue: -1,
  showGhosts: true,
  showGapMarks: true,
  autoOrbit: false,
  cosmos: true,      // space style for the 2D map (saved per browser)
  cosmosAmt: 1,
  reelRunning: false,
  selected: -1,
  hover: -1,
  searchActive: false,
  gapFilter: 'all',
  history: [],
  current: null,
  upload: { open: false, zone: 5, branch: null, pin: null, manual: false, suggestion: null },
};

const CAM_3D = { pos: new THREE.Vector3(78, 34, 96), target: new THREE.Vector3(0, 6, 0) };
const CAM_2D = { pos: new THREE.Vector3(0, 8, 134), target: new THREE.Vector3(0, 8, 0) };
const ZONE_CAMERAS = [
  { pos: new THREE.Vector3(92, 22, 18), target: new THREE.Vector3(16, 4, 0) },
  { pos: new THREE.Vector3(-92, 22, -18), target: new THREE.Vector3(-16, 4, 0) },
  { pos: new THREE.Vector3(54, 48, 56), target: new THREE.Vector3(0, 22, 0) },
  { pos: new THREE.Vector3(64, 16, -54), target: new THREE.Vector3(0, -6, -6) },
  { pos: new THREE.Vector3(24, 34, 94), target: new THREE.Vector3(0, 12, 14) },
  { pos: new THREE.Vector3(38, 42, -96), target: new THREE.Vector3(0, 22, -12) },
];
let camLerp = null;

// ---------------------------------------------------------------------------
// Three.js setup
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 1000);
camera.position.copy(CAM_3D.pos);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 1);
$('canvas-wrap').appendChild(renderer.domElement);

// Bloom is used only for the space style; the normal style renders directly.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.4, 0.55);
composer.addPass(bloom);
composer.addPass(new OutputPass());
let cosmos = null;
const COSMOS_KEY = 'maai-atlas-cosmos';
try { const v = localStorage.getItem(COSMOS_KEY); if (v !== null) state.cosmos = v === '1'; } catch { /* storage blocked */ }

// Embed mode (index.html?embed&mode=0|1): the presentation deck shows the live map in a frame.
// The panels are hidden, the cosmic-web style is on, and the deck sends { atlas: 'mode', v: 0|1 }.
const PARAMS = new URLSearchParams(location.search);
const EMBED = PARAMS.has('embed');
if (EMBED) {
  state.cosmos = true;
  state.morph = Number(PARAMS.get('mode')) > 0.5 ? 1 : 0;
  const st = document.createElement('style');
  st.textContent = '#topbar,#rail,#left-col,#hud-inspector,#hud-bottom,#home,#cosmos-legend,.toast,#tooltip{display:none!important}';
  document.head.appendChild(st);
  document.documentElement.classList.add('embed');
}
state.cosmosAmt = state.cosmos ? 1 : 0;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.copy(CAM_3D.target);
controls.maxDistance = 260;
controls.minDistance = 20;

const grid = new THREE.GridHelper(120, 24, 0x263147, 0x151b28);
grid.position.y = -34.2;
grid.material.transparent = true;
grid.material.opacity = 0.45;
scene.add(grid);

const pinGroup = new THREE.Group();
const pinCore = new THREE.Mesh(new THREE.SphereGeometry(1.3, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffe07d, transparent: true, opacity: 0.95 }));
const pinRing = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.8, 32), new THREE.MeshBasicMaterial({ color: 0xe9c46a, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
pinGroup.add(pinCore, pinRing);
pinGroup.visible = false;
scene.add(pinGroup);

// ---------------------------------------------------------------------------
// Load data
// ---------------------------------------------------------------------------
async function init() {
  const [metaRes, binRes] = await Promise.all([fetch('data/atlas_meta.json'), fetch('data/points.bin')]);
  meta = await metaRes.json();
  const raw = new Float32Array(await binRes.arrayBuffer());
  const stride = meta.floats_per_point;
  if (stride < 14) throw new Error('points.bin is from the v1 generator. Run: python -m pipeline.run');
  pointCount = meta.point_count;

  const posB = new Float32Array(pointCount * 3);
  const posU = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const cohort = new Float32Array(pointCount);
  const built = new Float32Array(pointCount);
  const proj = new Float32Array(pointCount);
  const branch = new Float32Array(pointCount);
  const zone = new Float32Array(pointCount);
  for (let i = 0; i < pointCount; i++) {
    const o = i * stride;
    for (let k = 0; k < 3; k++) {
      posB[i * 3 + k] = raw[o + k];
      posU[i * 3 + k] = raw[o + 3 + k];
      colors[i * 3 + k] = raw[o + 6 + k];
    }
    cohort[i] = raw[o + 9];
    built[i] = raw[o + 10];
    proj[i] = raw[o + 11];
    branch[i] = raw[o + 12];
    zone[i] = raw[o + 13];
  }
  A = { posB, posU, colors, cohort, built, proj, branch, zone, flash: new Float32Array(pointCount), match: new Float32Array(pointCount) };
  layoutGalaxies(A, pointCount, meta.projects);
  computeDelays();

  geometry = new THREE.BufferGeometry();
  const attr = (name, arr, n) => geometry.setAttribute(name, new THREE.BufferAttribute(arr, n));
  attr('position', posB, 3);
  attr('aPosUmap', posU, 3);
  attr('aColor', colors, 3);
  attr('aCohort', cohort, 1);
  attr('aBuilt', built, 1);
  attr('aProj', proj, 1);
  attr('aBranch', branch, 1);
  attr('aZone', zone, 1);
  attr('aFlash', A.flash, 1);
  attr('aMatch', A.match, 1);
  attr('aPosCosmos', A.posC, 3);
  attr('aStar', A.star, 2);
  attr('aDelay', A.delay, 1);

  material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMorph: { value: state.morph }, uTime: { value: 0 }, uMaxCohort: { value: 99 },
      uShowGhosts: { value: 1 }, uFocusMode: { value: 0 }, uFocusValue: { value: -1 },
      uSelected: { value: -1 }, uHover: { value: -1 }, uSearchActive: { value: 0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      uCosmos: { value: state.cosmosAmt }, uCohortN: { value: meta.cohorts.length }, uDim: { value: 1 },
    },
  });
  scene.add(new THREE.Points(geometry, material));
  cosmos = new Cosmos(scene, meta, {
    layer: $('web-layer'),
    morphProject,
    onVoid: (v) => selectVoid(v),
    onCorridor: (c) => selectCorridor(c),
    onProject: (i) => selectProject(i, { fly: false }),
  });
  cosmos.setCohort(99);
  $('cl-step').textContent = cosmos.label || '';

  try {
    search = await SemanticSearch.load(meta);
  } catch (err) {
    console.warn('Search index unavailable', err);
  }

  network = new CitationNetwork($('network-canvas'), $('network-tip'), meta, {
    onProject: (p) => { closeOverlays(); selectProject(p.idx); },
    onSource: (s) => selectSource(s.idx),
  });

  buildUI();
  fitPresets();
  camera.position.copy(state.morph > 0.5 ? CAM_3D.pos : CAM_2D.pos);
  controls.target.copy(state.morph > 0.5 ? CAM_3D.target : CAM_2D.target);
  restoreLocalProjects();
  updateStats();
  animate();
  if (EMBED) {
    window.addEventListener('message', (e) => {
      const d = e.data || {};
      if (d.atlas === 'mode') transitionToMode(d.v > 0.5 ? 1 : 0);
      if (d.atlas === 'focus') cosmos.setFocus(d.k);
    });
    // slide keys go back to the deck, also after a click in the frame
    window.addEventListener('keydown', (e) => {
      if (['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' ', 'Home', 'End'].includes(e.key)) { e.preventDefault(); window.parent?.postMessage({ atlas: 'key', key: e.key }, '*'); }
    }, true);
    window.parent?.postMessage({ atlas: 'ready', v: state.morph }, '*');
  } else if (location.hash) openFromHash();
  else showWelcome();
  // home.js (programmes page) uses these two entry points
  window.dispatchEvent(new CustomEvent('atlas-ready', { detail: { meta, api: {
    openUpload: (i) => openUploadModal(i),
    showCohort: (i) => { setCohort(i); transitionToMode(0); },
  } } }));
}

// ---------------------------------------------------------------------------
// Left panel: cohorts, branches, gaps, toggles
// ---------------------------------------------------------------------------
function allCohortIdx() { return meta.cohorts.length; }

function buildUI() {
  if (meta.synthetic) $('synthetic-badge').hidden = false;

  const pills = $('cohort-pills');
  pills.style.gridTemplateColumns = `repeat(${meta.cohorts.length + 1}, 1fr)`;
  pills.innerHTML = [...meta.cohorts, 'All']
    .map((c, i) => `<button class="pill-btn ${i === allCohortIdx() ? 'active' : ''}" data-cohort="${i}">${esc(c)}</button>`).join('');
  pills.querySelectorAll('.pill-btn').forEach((b) => b.addEventListener('click', () => setCohort(Number(b.dataset.cohort))));

  buildBranchList();
  buildGapList();

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => setTab(t.dataset.tab)));
  $('branch-reset').addEventListener('click', () => setFocus(0, -1));
  $('toggle-ghosts').addEventListener('change', (e) => {
    state.showGhosts = e.target.checked;
    material.uniforms.uShowGhosts.value = state.showGhosts ? 1 : 0;
  });
  $('toggle-gapmarks').addEventListener('change', (e) => { state.showGapMarks = e.target.checked; });
  $('toggle-orbit').addEventListener('change', (e) => { state.autoOrbit = e.target.checked; });
  $('toggle-cosmos').checked = state.cosmos;
  $('toggle-cosmos').addEventListener('change', (e) => {
    state.cosmos = e.target.checked;
    try { localStorage.setItem(COSMOS_KEY, state.cosmos ? '1' : '0'); } catch { /* storage blocked */ }
  });
  $('cl-key').addEventListener('click', () => {
    const open = $('cosmos-legend').classList.toggle('open');
    $('cl-key').setAttribute('aria-expanded', String(open));
    $('cl-key').textContent = open ? 'Hide key' : 'Key';
  });
  document.querySelectorAll('#cosmos-legend [data-layer]').forEach((el) => {
    el.addEventListener('change', () => cosmos.setLayers({ [el.dataset.layer]: el.checked }));
    cosmos.setLayers({ [el.dataset.layer]: el.checked });
  });

  const slider = $('morph-slider');
  slider.addEventListener('input', () => {
    const v = Number(slider.value) / 100;
    state.tween = null;
    camLerp = null;
    state.targetMorph = v;
    state.morph = v;
    camPose(CAM_2D, CAM_3D, smooth(v), camera.position, controls.target);
    $('morph-pct').textContent = `${slider.value}%`;
    updateModeButtons(v);
  });
  $('btn-2d').addEventListener('click', () => transitionToMode(0));
  $('btn-3d').addEventListener('click', () => transitionToMode(1));
  $('btn-upload').addEventListener('click', openUploadModal);
  $('btn-reel').addEventListener('click', runKickoffReel);
  $('btn-network').addEventListener('click', openNetwork);
  $('btn-matrix').addEventListener('click', openMatrix);
  $('network-close').addEventListener('click', closeOverlays);
  $('matrix-close').addEventListener('click', closeOverlays);
  $('net-min').addEventListener('change', openNetwork);
  $('net-branch').innerHTML = `<option value="-1">All branches</option>` +
    meta.branches.map((b) => `<option value="${b.idx}">${esc(b.name)}</option>`).join('');
  $('net-branch').addEventListener('change', openNetwork);
  $('insp-back').addEventListener('click', goBack);

  buildGapMarkers();
  buildBranchLabels();
  buildSearchUI();
  buildUploadUI();

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('network-overlay').hidden || !$('matrix-overlay').hidden) closeOverlays();
      else if (state.upload.open) closeUploadModal();
    }
  });
  window.addEventListener('hashchange', openFromHash);
}

function setTab(tab) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  $('pane-branches').hidden = tab !== 'branches';
  $('pane-gaps').hidden = tab !== 'gaps';
}

function sparkline(counts, color) {
  const max = Math.max(1, ...counts);
  const w = 6, gap = 2, h = 18;
  const bars = counts.map((c, i) => {
    const bh = Math.max(1.5, (c / max) * h);
    return `<rect x="${i * (w + gap)}" y="${h - bh}" width="${w}" height="${bh}" rx="1" fill="${color}"/>`;
  }).join('');
  return `<svg class="spark" width="${counts.length * (w + gap)}" height="${h}" viewBox="0 0 ${counts.length * (w + gap)} ${h}" aria-hidden="true">${bars}</svg>`;
}

function buildBranchList() {
  const list = $('branch-list');
  list.innerHTML = meta.branches.map((b) => `
    <div class="branch-item" data-idx="${b.idx}" tabindex="0" role="button">
      <span class="swatch" style="background:${b.color};color:${b.color}"></span>
      <div class="branch-text">
        <div class="branch-name">${esc(b.name)}</div>
        <div class="branch-zone">${esc(meta.zones[b.zone_idx].name)}</div>
      </div>
      ${sparkline(b.cohort_counts || [], b.color)}
      <span class="branch-count" id="bcount-${b.idx}">${b.count}</span>
    </div>`).join('');
  list.querySelectorAll('.branch-item').forEach((el) => {
    const go = () => {
      const idx = Number(el.dataset.idx);
      if (state.focusMode === 1 && state.focusValue === idx) { setFocus(0, -1); showWelcome(); return; }
      selectBranch(idx);
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}

function buildGapList() {
  const counts = { all: meta.gaps.length };
  meta.gaps.forEach((g) => { counts[g.type] = (counts[g.type] || 0) + 1; });
  $('gap-filters').innerHTML = ['all', ...Object.keys(GAP_TYPES)].filter((t) => counts[t])
    .map((t) => `<button class="chip-btn ${state.gapFilter === t ? 'active' : ''}" data-type="${t}">
      ${t === 'all' ? '' : `<i style="background:${GAP_TYPES[t].color}"></i>`}${t === 'all' ? 'All' : GAP_TYPES[t].label} <b>${counts[t]}</b></button>`).join('');
  $('gap-filters').querySelectorAll('.chip-btn').forEach((b) => b.addEventListener('click', () => {
    state.gapFilter = b.dataset.type;
    buildGapList();
  }));
  const gaps = meta.gaps.filter((g) => state.gapFilter === 'all' || g.type === state.gapFilter)
    .sort((a, b) => b.weight - a.weight);
  $('gap-list').innerHTML = gaps.map((g) => `
    <div class="gap-item" data-idx="${g.idx}" tabindex="0" role="button">
      <i class="gap-dot" style="background:${GAP_TYPES[g.type].color}"></i>
      <div class="branch-text">
        <div class="branch-name">${esc(g.title)}</div>
        <div class="branch-zone">${GAP_TYPES[g.type].label} · ${esc(meta.zones[g.zone_idx].name.split(' & ')[0])}</div>
      </div>
    </div>`).join('');
  $('gap-list').querySelectorAll('.gap-item').forEach((el) => {
    el.addEventListener('click', () => selectGap(Number(el.dataset.idx)));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectGap(Number(el.dataset.idx)); });
  });
}

function setFocus(mode, value) {
  state.focusMode = mode;
  state.focusValue = value;
  material.uniforms.uFocusMode.value = mode;
  material.uniforms.uFocusValue.value = value;
  $('branch-reset').hidden = mode === 0;
  document.querySelectorAll('.branch-item').forEach((el) => {
    const idx = Number(el.dataset.idx);
    const b = meta.branches[idx];
    const on = (mode === 1 && idx === value) || (mode === 2 && b.zone_idx === value);
    el.classList.toggle('active', on);
    el.classList.toggle('dimmed', mode !== 0 && !on);
  });
}

function setCohort(c) {
  state.maxCohort = c >= allCohortIdx() ? 99 : c;
  material.uniforms.uMaxCohort.value = state.maxCohort;
  $('cohort-label').textContent = c >= allCohortIdx() ? 'All' : c === 0 ? meta.cohorts[0] : `≤ ${meta.cohorts[c]}`;
  document.querySelectorAll('#cohort-pills .pill-btn').forEach((b) => b.classList.toggle('active', Number(b.dataset.cohort) === c));
  updateStats();
  if (cosmos) { cosmos.setCohort(state.maxCohort); $('cl-step').textContent = cosmos.label || ''; }
  updateLabelAnchors();
}

function visibleProjects() {
  return meta.projects.filter((p) => p.cohort_idx <= state.maxCohort);
}

function updateStats() {
  let builtPts = 0;
  for (let i = 0; i < pointCount; i++) if (A.built[i] > 0.5 && A.cohort[i] <= state.maxCohort + 0.01) builtPts++;
  $('stat-projects').textContent = visibleProjects().length;
  $('stat-branches').textContent = meta.branches.filter((b) => !b.is_frontier).length;
  $('stat-gaps').textContent = meta.gaps.length;
  $('stat-sources').textContent = meta.sources.length;
  $('stat-built').textContent = `${((builtPts / pointCount) * 100).toFixed(0)}%`;
}

function updateModeButtons(v) {
  $('btn-2d').classList.toggle('active', v < 0.5);
  $('btn-3d').classList.toggle('active', v >= 0.5);
}

function flyTo(target, pos) {
  // during a map <-> basilica change, the camera stays on the same clock as the points
  if (state.tween && state.tween.cam) { state.tween.cam.to = { pos: pos.clone(), target: target.clone() }; return; }
  camLerp = { from: { pos: camera.position.clone(), target: controls.target.clone() }, to: { pos: pos.clone(), target: target.clone() }, t: 0 };
}

// One clock for the points, the camera, the lines and the labels.
// Points fly on their own delays (morph.js), so the global morph runs at constant speed.
function transitionToMode(target, cam = null) {
  state.targetMorph = target;
  updateModeButtons(target);
  const preset = cam || (target < 0.5 ? CAM_2D : CAM_3D);
  const dist = Math.abs(target - state.morph);
  camLerp = null;
  if (dist < 0.001) { flyTo(preset.target, preset.pos); state.tween = null; return; }
  state.tween = {
    m0: state.morph, m1: target, t: 0, dur: (reduceMotion ? 0.35 : 3.2) * dist + 0.15,
    cam: { from: { pos: camera.position.clone(), target: controls.target.clone() }, to: { pos: preset.pos.clone(), target: preset.target.clone() } },
  };
}

// ---------------------------------------------------------------------------
// Morph helpers shared with picking and the overlays
// ---------------------------------------------------------------------------
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const hash01 = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
let yRange = [0, 1];
function computeDelays() {
  if (!A.delay) A.delay = new Float32Array(pointCount);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pointCount; i++) { const y = A.posB[i * 3 + 1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  yRange = [y0, Math.max(y1, y0 + 1)];
  const nc = Math.max(1, meta.cohorts.length - 1);
  for (let i = 0; i < pointCount; i++) {
    const hn = (A.posB[i * 3 + 1] - y0) / (yRange[1] - y0);
    A.delay[i] = A.built[i] > 0.5 ? stoneDelay(hn, A.cohort[i] / nc, hash01(i)) : ghostDelay(hn);
  }
}
function projectDelay(p) {
  const hn = ((p.basilica?.[1] ?? 0) - yRange[0]) / (yRange[1] - yRange[0]);
  return stoneDelay(hn, p.cohort_idx / Math.max(1, meta.cohorts.length - 1), 0.5);
}
// Where one project is at global morph g (map position -> basilica stone)
function morphProject(idx, g, out) {
  const p = meta.projects[idx];
  return bezier(out, [p.xy[0], p.xy[1], 0], p.basilica || [p.xy[0], p.xy[1], 0], p.branch_idx, localMorph(g, projectDelay(p)));
}

// Camera presets fit the free space between the panels
function freeRect() {
  const W = window.innerWidth, H = window.innerHeight;
  const r = { l: 0, r: W, t: 0, b: H };
  if (EMBED) {
    // the deck keeps room for its text: pad = left, top, right, bottom (fractions of the frame)
    const [pl, pt, pr, pb] = (PARAMS.get('pad') || '0,0,0,0').split(',').map(Number);
    return { l: W * (pl || 0), r: W * (1 - (pr || 0)), t: H * (pt || 0), b: H * (1 - (pb || 0)) };
  }
  const box = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.1) return null;
    const rc = el.getBoundingClientRect();
    return rc.width > 0 && rc.width < W * 0.5 ? rc : null;
  };
  const rail = box($('rail')), left = box($('left-col')), insp = box($('hud-inspector')), top = $('topbar')?.getBoundingClientRect(), bot = box($('hud-bottom'));
  r.l = Math.max(rail ? rail.right : 0, left ? left.right : 0);
  if (insp && insp.left > W * 0.5) r.r = insp.left;
  if (top && top.bottom < H * 0.3) r.t = top.bottom;
  if (bot && bot.top > H * 0.6) r.b = bot.top;
  if (r.r - r.l < W * 0.35) { r.l = 0; r.r = W; }
  return r;
}
function fitPose(center, halfW, halfH, dir, out) {
  const W = window.innerWidth, H = window.innerHeight, fr = freeRect();
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const fw = Math.max(80, fr.r - fr.l - 24), fh = Math.max(80, fr.b - fr.t - 24);
  const d = Math.max(halfH * H / (fh * tan), halfW * H / (fw * tan));
  const ppu = H / (2 * d * tan);
  const f = dir.clone().negate().normalize(), rt = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(rt, f);
  const dx = (fr.l + fr.r) / 2 - W / 2, dy = (fr.t + fr.b) / 2 - H / 2;
  out.target.copy(center).addScaledVector(rt, -dx / ppu).addScaledVector(up, dy / ppu);
  out.pos.copy(out.target).addScaledVector(dir.clone().normalize(), d);
}
const DIR_3D = new THREE.Vector3(78, 28, 96).normalize();
function fitPresets() {
  if (!meta) return;
  const ps = meta.projects.filter((p) => p.xy);
  const xs = ps.map((p) => p.xy[0]), ys = ps.map((p) => p.xy[1]);
  const c2 = new THREE.Vector3((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2, 0);
  fitPose(c2, (Math.max(...xs) - Math.min(...xs)) / 2 + 13, (Math.max(...ys) - Math.min(...ys)) / 2 + 9, new THREE.Vector3(0, 0, 1), CAM_2D);
  // tall enough for the star on the Tower of Jesus Christ
  fitPose(new THREE.Vector3(0, 9, 0), 33, 52, DIR_3D, CAM_3D);
}
function refitIfAtPreset() {
  const near = (p) => camera.position.distanceTo(p.pos) < 6 && controls.target.distanceTo(p.target) < 6;
  const was = near(CAM_2D) ? 0 : near(CAM_3D) ? 1 : -1;
  fitPresets();
  if (was >= 0 && !state.tween) { const p = was ? CAM_3D : CAM_2D; flyTo(p.target, p.pos); }
}

// ---------------------------------------------------------------------------
// Floating labels: branch names and gap markers (2D map)
// ---------------------------------------------------------------------------
const labelEls = [];
const gapEls = [];
const tmpVec = new THREE.Vector3();

const labelAnchors = [];
// 2D anchor: the densest visible member (cosmic-web node); 3D anchor: the branch's stones
function updateLabelAnchors() {
  if (!meta) return;
  const dz = meta.structure?.density_z || [];
  meta.branches.forEach((b, i) => {
    const ms = meta.projects.filter((p) => p.branch_idx === i && p.xy && p.cohort_idx <= state.maxCohort);
    const all = meta.projects.filter((p) => p.branch_idx === i && p.basilica);
    const best = ms.length ? ms.reduce((x, y) => ((dz[y.idx] ?? 0) > (dz[x.idx] ?? 0) ? y : x)) : null;
    const p0 = best ? [best.xy[0], best.xy[1] + 4, 0] : [b.centroid[0], b.centroid[1] + 9, 0];
    const p1 = [0, 0, 0];
    all.forEach((p) => { for (let k = 0; k < 3; k++) p1[k] += p.basilica[k] / all.length; });
    p1[1] += 4;
    labelAnchors[i] = { p0, p1, empty: !ms.length };
  });
}

function buildBranchLabels() {
  updateLabelAnchors();
  const layer = $('labels-layer');
  layer.innerHTML = '';
  meta.branches.forEach((b) => {
    const el = document.createElement('div');
    el.className = 'branch-label';
    el.style.color = b.color;
    el.textContent = b.name.includes(': ') ? b.name.split(': ').pop() : b.name;
    layer.appendChild(el);
    labelEls.push(el);
  });
}

function buildGapMarkers() {
  const layer = $('gap-layer');
  layer.innerHTML = '';
  meta.gaps.forEach((g) => {
    const el = document.createElement('button');
    el.className = `gap-mark gap-${g.type}`;
    const size = 16 + Math.min(8, g.weight) * 3;
    el.style.width = el.style.height = `${size}px`;
    el.style.setProperty('--c', GAP_TYPES[g.type].color);
    el.title = `${GAP_TYPES[g.type].label}: ${g.title}`;
    el.setAttribute('aria-label', el.title);
    el.addEventListener('click', () => selectGap(g.idx, { fly: false }));
    layer.appendChild(el);
    gapEls.push(el);
  });
}

function projectToScreen(x, y, z) {
  tmpVec.set(x, y, z).project(camera);
  return { x: (tmpVec.x * 0.5 + 0.5) * window.innerWidth, y: (-tmpVec.y * 0.5 + 0.5) * window.innerHeight, behind: tmpVec.z > 1 };
}

const lblTmp = [0, 0, 0];
function updateOverlays() {
  const g = state.morph, gm = smooth(g);
  const opacity = 1 - smooth(Math.min(1, g / 0.3));
  // branch labels travel with their branch from the map to its part of the basilica
  meta.branches.forEach((b, idx) => {
    const el = labelEls[idx], an = labelAnchors[idx];
    const hide = !an || an.empty || (state.focusMode === 1 && state.focusValue !== idx) || b.is_frontier;
    if (hide) { el.style.opacity = '0'; return; }
    bezier(lblTmp, an.p0, an.p1, b.idx, gm);
    const s = projectToScreen(lblTmp[0], lblTmp[1], lblTmp[2]);
    if (s.behind) { el.style.opacity = '0'; return; }
    el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%) scale(${(1 - 0.12 * gm).toFixed(3)})`;
    // labels ride with their branch for the first half, then leave the basilica clean
    el.style.opacity = (1 - smooth(Math.min(1, Math.max(0, (g - 0.4) / 0.4)))).toFixed(2);
  });
  const gOpacity = state.showGapMarks ? opacity : 0;
  meta.gaps.forEach((g, i) => {
    const el = gapEls[i];
    if (gOpacity < 0.05) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; return; }
    const s = projectToScreen(g.xy[0], g.xy[1], 0);
    el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -50%)`;
    const active = state.current && state.current.type === 'gap' && state.current.idx === g.idx;
    el.classList.toggle('active', active);
    el.style.opacity = (gOpacity * (state.gapFilter === 'all' || state.gapFilter === g.type ? 1 : 0.25)).toFixed(2);
    el.style.pointerEvents = 'auto';
  });
}

// ---------------------------------------------------------------------------
// Point picking (exact: uses each point's project id, CPU mirror of the shader)
// ---------------------------------------------------------------------------
const mvp = new THREE.Matrix4();
function pickAt(cx, cy, { ghosts = false, radius = 12 } = {}) {
  const g = state.morph;
  const p0 = [0, 0, 0], p1 = [0, 0, 0], q = [0, 0, 0];
  camera.updateMatrixWorld();
  mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const e = mvp.elements;
  const W = window.innerWidth, H = window.innerHeight;
  const { posB, built, cohort, branch, zone, match } = A;
  // map position = mix of the flat disc and the galaxy layout, same as the shader
  const ca = state.cosmosAmt, posU = A.posU, posC = A.posC;
  const u = (j) => posU[j] * (1 - ca) + posC[j] * ca;
  let best = -1, bestScore = Infinity;
  const step = ghosts ? 2 : 1;
  for (let i = 0; i < pointCount; i += step) {
    const isBuilt = built[i] > 0.5 && cohort[i] <= state.maxCohort + 0.01;
    if (ghosts ? built[i] > 0.5 : !isBuilt) continue;
    if (state.focusMode === 1 && Math.abs(branch[i] - state.focusValue) > 0.2) continue;
    if (state.focusMode === 2 && Math.abs(zone[i] - state.focusValue) > 0.2) continue;
    if (!ghosts && state.searchActive && match[i] < 0.5) continue;
    const i3 = i * 3;
    p0[0] = u(i3); p0[1] = u(i3 + 1); p0[2] = u(i3 + 2);
    p1[0] = posB[i3]; p1[1] = posB[i3 + 1]; p1[2] = posB[i3 + 2];
    bezier(q, p0, p1, branch[i], localMorph(g, A.delay[i]));
    const [x, y, z] = q;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (w <= 0) continue;
    const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / w * 0.5 + 0.5) * W;
    const sy = (-(e[1] * x + e[5] * y + e[9] * z + e[13]) / w * 0.5 + 0.5) * H;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d < radius) {
      const score = d + w * 0.03;
      if (score < bestScore) { bestScore = score; best = i; }
    }
  }
  return best;
}

const pointer = { x: 0, y: 0, dirty: false, down: null, last: 0 };
renderer.domElement.addEventListener('pointerdown', (e) => { pointer.down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.dirty = !e.buttons;
});
renderer.domElement.addEventListener('pointerleave', () => setHover(-1));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!meta || !pointer.down) return;
  if (Math.hypot(e.clientX - pointer.down.x, e.clientY - pointer.down.y) > 5) return;
  if (state.upload.open && state.morph > 0.6) {
    const i = pickAt(e.clientX, e.clientY, { ghosts: true, radius: 30 });
    if (i >= 0) {
      const p = new THREE.Vector3(A.posB[i * 3], A.posB[i * 3 + 1], A.posB[i * 3 + 2]);
      selectUploadZone(Math.round(A.zone[i]), p, true);
      return;
    }
  }
  const i = pickAt(e.clientX, e.clientY);
  if (i >= 0) selectProject(Math.round(A.proj[i]), { fly: false });
});

function updateHover(now) {
  if (!pointer.dirty || now - pointer.last < 60 || state.upload.open) return;
  pointer.dirty = false;
  pointer.last = now;
  const i = pickAt(pointer.x, pointer.y);
  setHover(i >= 0 ? Math.round(A.proj[i]) : -1);
}

function setHover(idx) {
  state.hover = idx;
  material.uniforms.uHover.value = idx;
  const tip = $('hover-tip');
  renderer.domElement.style.cursor = idx >= 0 ? 'pointer' : '';
  if (idx < 0) { tip.hidden = true; return; }
  const p = meta.projects[idx];
  const b = meta.branches[p.branch_idx];
  tip.innerHTML = `<b>${esc(p.title)}</b><span><i style="background:${b.color}"></i>${esc(b.name)} · ${esc(p.cohort)}</span>`;
  tip.style.left = `${Math.min(pointer.x + 14, window.innerWidth - 260)}px`;
  tip.style.top = `${pointer.y + 14}px`;
  tip.hidden = false;
}

// ---------------------------------------------------------------------------
// Inspector views with history and deep links
// ---------------------------------------------------------------------------
function navigate(view, push = true) {
  if (push && state.current && !(state.current.type === view.type && state.current.idx === view.idx)) {
    state.history.push(state.current);
    if (state.history.length > 30) state.history.shift();
  }
  state.current = view;
  $('insp-back').hidden = state.history.length === 0;
  const hash = view.hash || '';
  if (hash && location.hash !== `#${hash}`) history.replaceState(null, '', `#${hash}`);
  if (!hash && location.hash) history.replaceState(null, '', location.pathname);
}

function goBack() {
  const prev = state.history.pop();
  if (!prev) return;
  const opts = { push: false, fly: false };
  if (prev.type === 'project') selectProject(prev.idx, opts);
  else if (prev.type === 'branch') selectBranch(prev.idx, opts);
  else if (prev.type === 'gap') selectGap(prev.idx, opts);
  else if (prev.type === 'source') selectSource(prev.idx, opts);
  else if (prev.type === 'cell') showCell(prev.row, prev.col, opts);
  else if (prev.type === 'corridor') selectCorridor(prev.obj, opts);
  else if (prev.type === 'void') selectVoid(prev.obj, opts);
  else showWelcome(false);
}

function openFromHash() {
  const h = decodeURIComponent(location.hash.slice(1));
  const [kind, ...rest] = h.split('-');
  const id = rest.join('-');
  if (kind === 'p') { const p = meta.projects.find((x) => x.id === id); if (p) return selectProject(p.idx); }
  if (kind === 'b') { const b = meta.branches.find((x) => x.id === id); if (b) return selectBranch(b.idx); }
  if (kind === 'g') { const g = meta.gaps.find((x) => x.id === id); if (g) return selectGap(g.idx); }
  if (kind === 's') { const s = meta.sources.find((x) => x.id === id); if (s) return selectSource(s.idx); }
  const S = meta.structure;
  if (kind === 'c' && S) { const c = [...S.corridors, ...(S.alt_corridors || [])].find((x) => x.branches.join('.') === id); if (c) return selectCorridor(c); }
  if (kind === 'v' && S) { const v = S.voids[Number(id)]; if (v) return selectVoid(v); }
}

function setInspector(heading, html) {
  $('insp-heading').textContent = heading;
  const body = $('inspector-body');
  body.innerHTML = html;
  body.scrollTop = 0;
  body.querySelectorAll('[data-go]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const [kind, idx] = el.dataset.go.split(':');
      const n = Number(idx);
      if (kind === 'p') selectProject(n);
      else if (kind === 'b') selectBranch(n);
      else if (kind === 'g') selectGap(n);
      else if (kind === 's') selectSource(n);
    });
  });
}

const projLink = (i) => {
  const p = meta.projects[i];
  const b = meta.branches[p.branch_idx];
  return `<a href="#p-${esc(p.id)}" class="row-link" data-go="p:${i}"><i style="background:${b.color}"></i><span>${esc(p.title)}</span><em>${esc(p.cohort)}</em></a>`;
};
const srcLink = (i) => {
  const s = meta.sources[i];
  return `<a href="#s-${esc(s.id)}" class="row-link" data-go="s:${i}"><i class="sq"></i><span>${esc(s.title)}</span><em>${esc(s.year ?? '')}</em></a>`;
};
const chips = (arr, cls = '') => arr.map((x) => `<span class="chip ${cls}">${esc(x)}</span>`).join('');

function showWelcome(push = true) {
  setSelected(-1);
  navigate({ type: 'welcome' }, push);
  const st = meta.stats;
  setInspector('About this map', `
    ${meta.synthetic ? `<p class="note">All ${meta.projects.length} projects are <b>synthetic</b>. They stand in for real MaAI work until the IAAC blog and thesis data are ingested. Everything else (pipeline, branches, gaps, search) is computed, not hand-placed.</p>` : ''}
    <h4>How to read it</h4>
    <ul class="plain">
      <li><b>2D map:</b> projects placed by meaning. Close together means similar topics, methods and data.</li>
      <li><b>3D basilica:</b> the same points rebuilt as the Sagrada Família. Each branch builds one part.</li>
      <li><b>Faint scaffold:</b> unbuilt stone. Its amount comes from the gaps found in that branch.</li>
      <li>Hover or click any point. Use search to find projects by meaning.</li>
    </ul>
    <h4>Rules behind the basilica</h4>
    <ol class="plain">${meta.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
    <h4>Pipeline run</h4>
    <div class="insp-grid">
      <span class="insp-k">Branches</span><span class="insp-v">${st.n_branches} found by clustering · ${st.n_frontier} bridging</span>
      <span class="insp-k">Stability</span><span class="insp-v">ARI ${st.stability_ari.toFixed(2)} across 4 seeds</span>
      ${st.synthetic_theme_ari != null ? `<span class="insp-k">Check</span><span class="insp-v">ARI ${st.synthetic_theme_ari.toFixed(2)} vs. hidden synthetic themes</span>` : ''}
      <span class="insp-k">References</span><span class="insp-v">${st.raw_references} raw → ${st.unique_sources} unique</span>
      <span class="insp-k">External</span><span class="insp-v">${st.external_docs} papers used for gap analysis</span>
    </div>`);
}

function setSelected(idx) {
  state.selected = idx;
  material.uniforms.uSelected.value = idx;
}

function selectProject(idx, { push = true, fly = true } = {}) {
  const p = meta.projects[idx];
  if (!p) return;
  setSelected(idx);
  navigate({ type: 'project', idx, hash: `p-${p.id}` }, push);
  if (p.cohort_idx > state.maxCohort) setCohort(allCohortIdx());
  if (fly) {
    if (state.targetMorph < 0.5) flyTo(new THREE.Vector3(p.xy[0], p.xy[1], 0), new THREE.Vector3(p.xy[0], p.xy[1], 64));
    else {
      const t = new THREE.Vector3(...p.basilica);
      const dir = camera.position.clone().sub(controls.target).normalize();
      flyTo(t, t.clone().add(dir.multiplyScalar(72)));
    }
  }
  const b = meta.branches[p.branch_idx];
  const zone = meta.zones[p.zone_idx];
  const repo = p.repo;
  const repoHtml = repo ? `
    <div class="card">
      <div class="card-head"><span>Repository</span>${repo.score != null ? `<b class="score s${repo.score >= 5 ? 'hi' : repo.score >= 3 ? 'mid' : 'lo'}">${repo.score}/6</b>` : ''}</div>
      <div class="mono small break">${esc(repo.url)}</div>
      <p class="small">${esc(repo.summary || '')}</p>
      <div class="repro-bar">${(repo.signals || []).map(([l, ok]) => `<span class="repro-chip ${ok ? 'ok' : ''}">${ok ? '✓' : '·'} ${esc(l)}</span>`).join('')}</div>
      ${repo.last_commit ? `<div class="small muted">Last commit ${esc(repo.last_commit)}${repo.languages?.length ? ` · ${esc(repo.languages.join(', '))}` : ''}</div>` : ''}
    </div>` : `<div class="card muted small">No repository linked.</div>`;
  const refs = [...p.refs].sort((a, c) => meta.sources[c].cited_by.length - meta.sources[a].cited_by.length);
  setInspector('Project', `
    <span class="insp-badge" style="background:${b.color}22;color:${b.color};border:1px solid ${b.color}66" data-go="b:${b.idx}" role="button">${p.local ? '★ Added here · ' : ''}${esc(b.name)}</span>
    <div class="insp-title">${esc(p.title)}</div>
    <div class="insp-grid">
      <span class="insp-k">Cohort</span><span class="insp-v">${esc(p.cohort)} · ${esc(p.work_type)}</span>
      ${p.scale ? `<span class="insp-k">Scale</span><span class="insp-v">${esc(p.scale)}</span>` : ''}
      <span class="insp-k">Basilica</span><span class="insp-v">${esc(zone.name)} · ${p.point_count} pts</span>
    </div>
    ${p.abstract ? `<p class="abstract">${esc(p.abstract)}</p>` : ''}
    <div class="chip-group"><span class="chip-k">Methods</span>${chips(p.methods, 'm')}</div>
    ${p.data.length ? `<div class="chip-group"><span class="chip-k">Data</span>${chips(p.data, 'd')}</div>` : ''}
    ${p.domains.length ? `<div class="chip-group"><span class="chip-k">Domain</span>${chips(p.domains)}</div>` : ''}
    ${p.tools.length ? `<div class="chip-group"><span class="chip-k">Tools</span>${chips(p.tools, 't')}</div>` : ''}
    ${repoHtml}
    ${p.similar.length ? `<h4>Closest by meaning</h4><div class="rows">${p.similar.map(projLink).join('')}</div>` : ''}
    ${p.coupled.length ? `<h4>Builds on the same literature</h4><div class="rows">${p.coupled.map((c) => projLink(c.idx).replace('</em>', ` · ${c.shared} shared</em>`)).join('')}</div>` : ''}
    ${refs.length ? `<h4>Cites (${refs.length})</h4><div class="rows">${refs.slice(0, 8).map(srcLink).join('')}</div>` : ''}
  `);
}

function selectBranch(idx, { push = true, fly = true } = {}) {
  const b = meta.branches[idx];
  setSelected(-1);
  setFocus(1, idx);
  navigate({ type: 'branch', idx, hash: `b-${b.id}` }, push);
  if (fly) {
    if (state.targetMorph < 0.5) flyTo(new THREE.Vector3(b.centroid[0], b.centroid[1], 0), new THREE.Vector3(b.centroid[0], b.centroid[1], 82));
    else { const z = ZONE_CAMERAS[b.zone_idx]; flyTo(z.target, z.pos); }
  }
  const members = meta.projects.filter((p) => p.branch_idx === idx);
  const central = [...members].sort((a, c) =>
    Math.hypot(a.xy[0] - b.centroid[0], a.xy[1] - b.centroid[1]) - Math.hypot(c.xy[0] - b.centroid[0], c.xy[1] - b.centroid[1])).slice(0, 6);
  const zone = meta.zones[b.zone_idx];
  const gaps = meta.gaps.filter((g) => g.zone_idx === b.zone_idx);
  const counts = b.cohort_counts || [];
  const max = Math.max(1, ...counts);
  const bars = counts.map((c, i) => `
    <div class="bar-col"><div class="bar" style="height:${(c / max) * 46}px;background:${b.color}"></div><span class="mono">${c}</span><em>${esc(meta.cohorts[i])}</em></div>`).join('');
  const reproAvg = members.filter((p) => p.repo?.score != null);
  setInspector('Research branch', `
    <span class="insp-badge" style="background:${b.color}22;color:${b.color};border:1px solid ${b.color}66">${esc(zone.name)}</span>
    <div class="insp-title">${esc(b.name)}</div>
    <p class="small muted">${esc(b.subtitle)}</p>
    <p class="abstract">${esc(b.description)}</p>
    ${counts.length ? `<h4>Projects per cohort</h4><div class="bars">${bars}</div>` : ''}
    ${b.keywords.length ? `<div class="chip-group"><span class="chip-k">Keywords</span>${chips(b.keywords)}</div>` : ''}
    <div class="insp-grid">
      <span class="insp-k">Zone built</span><span class="insp-v">${Math.round(zone.built_fraction * 100)}% · gap weight ${zone.gap_weight}</span>
      ${reproAvg.length ? `<span class="insp-k">Repos</span><span class="insp-v">${reproAvg.length}/${members.length} · mean ${(reproAvg.reduce((a, p) => a + p.repo.score, 0) / reproAvg.length).toFixed(1)}/6</span>` : ''}
    </div>
    ${b.anchors?.length ? `<h4>Anchor sources</h4><p class="small muted">Cited far more inside this branch than elsewhere.</p><div class="rows">${b.anchors.map(srcLink).join('')}</div>` : ''}
    ${gaps.length ? `<h4>Gaps on this part of the building</h4><div class="rows">${gaps.map(gapLink).join('')}</div>` : ''}
    <h4>Central projects</h4><div class="rows">${central.map((p) => projLink(p.idx)).join('')}</div>
  `);
}

const gapLink = (g) => `<a href="#g-${esc(g.id)}" class="row-link" data-go="g:${g.idx}"><i style="background:${GAP_TYPES[g.type].color}"></i><span>${esc(g.title)}</span><em>${GAP_TYPES[g.type].label}</em></a>`;

function selectGap(idx, { push = true, fly = true } = {}) {
  const g = meta.gaps[idx];
  setSelected(-1);
  setFocus(0, -1);
  navigate({ type: 'gap', idx, hash: `g-${g.id}` }, push);
  setTab('gaps');
  if (fly) transitionToMode(0, { target: new THREE.Vector3(g.xy[0], g.xy[1], 0), pos: new THREE.Vector3(g.xy[0], g.xy[1], 78) });
  const t = GAP_TYPES[g.type];
  setInspector('Research gap', `
    <span class="insp-badge" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}66">${t.long}</span>
    <div class="insp-title">${esc(g.title)}</div>
    <p class="abstract">${esc(g.description)}</p>
    <h4>Evidence</h4>
    <ul class="plain small">${g.evidence.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    <div class="insp-grid">
      <span class="insp-k">Score</span><span class="insp-v">${g.score}</span>
      <span class="insp-k">Scaffold</span><span class="insp-v">+${g.weight} project-equivalents on ${esc(meta.zones[g.zone_idx].name)}</span>
    </div>
    ${g.related.length ? `<h4>Projects around it</h4><div class="rows">${g.related.map(projLink).join('')}</div>` : ''}
    <p class="note small">A candidate for faculty review, not a conclusion.</p>
  `);
}

const bname = (i) => meta.branches[i].name.replace('Fabrication & Materials: ', '');
const bchip = (i) => `<a href="#b-${esc(meta.branches[i].id)}" class="row-link" data-go="b:${i}"><i style="background:${meta.branches[i].color}"></i><span>${esc(meta.branches[i].name)}</span></a>`;

function selectCorridor(c, { push = true, fly = true } = {}) {
  setSelected(-1);
  setFocus(0, -1);
  const key = c.branches.join('.');
  navigate({ type: 'corridor', idx: key, obj: c, hash: `c-${key}` }, push);
  if (fly) {
    const br = c.bridge || c.path, a = meta.projects[br[0]].xy, b = meta.projects[br.at(-1)].xy;
    const t = new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
    transitionToMode(0, { target: t, pos: t.clone().setZ(92) });
  }
  const pct = Math.round(c.support * 100);
  setInspector('Corridor', `
    <span class="insp-badge web">Cosmic web · corridor</span>
    <div class="insp-title">${esc(bname(c.branches[0]))} ↔ ${esc(bname(c.branches[1]))}</div>
    <p class="abstract">The shortest chain of similar projects between the cores of the two branches. The chain is found in the 64D embedding, not on the flat map. The flat map only shows it.</p>
    <div class="insp-grid">
      <span class="insp-k">Support</span><span class="insp-v">${pct}% of 40 bootstrap runs (${c.status})</span>
      <span class="insp-k">Separation</span><span class="insp-v">${c.separation} × the usual step in a branch</span>
      <span class="insp-k">Similarity</span><span class="insp-v">${c.similarity}</span>
      <span class="insp-k">Cohorts</span><span class="insp-v">${(c.cohorts || []).map((k) => esc(meta.cohorts[k])).join(', ') || '—'}</span>
    </div>
    <h4>Branches</h4><div class="rows">${c.branches.map(bchip).join('')}</div>
    ${(c.bridge || []).length ? `<h4>Bridge projects</h4><div class="rows">${c.bridge.map(projLink).join('')}</div>` : ''}
    <h4>Path</h4><div class="rows">${c.path.map(projLink).join('')}</div>
    ${(c.shared_sources || []).length ? `<h4>Sources both sides cite</h4><div class="rows">${c.shared_sources.map(srcLink).join('')}</div>` : ''}
    <p class="note small">In the 3D view the same line runs through the stones of these projects.</p>
  `);
}

function selectVoid(v, { push = true, fly = true } = {}) {
  setSelected(-1);
  setFocus(0, -1);
  const vi = (meta.structure?.voids || []).indexOf(v);
  navigate({ type: 'void', idx: `v${vi}-${v.xy.join(',')}`, obj: v, hash: vi >= 0 ? `v-${vi}` : '' }, push);
  if (fly) transitionToMode(0, { target: new THREE.Vector3(v.xy[0], v.xy[1], 0), pos: new THREE.Vector3(v.xy[0], v.xy[1], Math.max(70, v.radius * 3)) });
  const ok = v.status === 'robust', pct = Math.round(v.support * 100);
  const gap = v.gap ? meta.gaps.find((g) => g.id === v.gap) : null;
  setInspector('Void', `
    <span class="insp-badge web">Cosmic web · ${ok ? 'void' : 'map-only void'}</span>
    <div class="insp-title">Empty region between ${(v.branches || []).map((i) => esc(bname(i))).join(', ')}</div>
    <p class="abstract">${ok
      ? 'No project sits in this region of the map, and the 64D embedding is also empty here. It is a candidate for new research.'
      : 'The region is empty on the flat map, but not in the 64D embedding. The map projection can make it. Do not use it as a gap without more evidence.'}</p>
    <div class="insp-grid">
      <span class="insp-k">Support</span><span class="insp-v">${pct}% of 40 bootstrap runs</span>
      <span class="insp-k">64D check</span><span class="insp-v">emptiness ${v.emptiness_64d} (${v.confirmed_64d ? 'confirmed, ≥ 1.2' : 'not confirmed, < 1.2'})</span>
      <span class="insp-k">Radius</span><span class="insp-v">${v.radius} map units</span>
    </div>
    ${gap ? `<h4>Linked gap</h4><div class="rows"><a href="#g-${esc(gap.id)}" class="row-link" data-go="g:${gap.idx}"><i style="background:${GAP_TYPES[gap.type].color}"></i><span>${esc(gap.title)}</span></a></div>` : ''}
    <h4>Projects on the rim</h4><div class="rows">${(v.rim || []).map(projLink).join('')}</div>
    <p class="note small">A candidate for faculty review, not a conclusion.</p>
  `);
}

function selectSource(idx, { push = true } = {}) {
  const s = meta.sources[idx];
  setSelected(-1);
  navigate({ type: 'source', idx, hash: `s-${s.id}` }, push);
  const byBranch = new Map();
  s.cited_by.forEach((i) => {
    const b = meta.projects[i].branch_idx;
    byBranch.set(b, (byBranch.get(b) || 0) + 1);
  });
  const dist = [...byBranch.entries()].sort((a, c) => c[1] - a[1]).map(([b, n]) =>
    `<div class="dist-row"><i style="background:${meta.branches[b].color}"></i><span>${esc(meta.branches[b].name)}</span><span class="mono">${n}</span></div>`).join('');
  setInspector('Source', `
    <span class="insp-badge src">Bibliography · ${esc(s.id)}</span>
    <div class="insp-title">${esc(s.title)}</div>
    <div class="insp-grid">
      <span class="insp-k">Author</span><span class="insp-v">${esc(s.author)}</span>
      <span class="insp-k">Year</span><span class="insp-v">${esc(s.year ?? '—')}</span>
      ${s.venue ? `<span class="insp-k">Venue</span><span class="insp-v">${esc(s.venue)}</span>` : ''}
      <span class="insp-k">Merged</span><span class="insp-v">${s.variants} citation style${s.variants === 1 ? '' : 's'}</span>
    </div>
    <h4>Cited by ${s.cited_by.length} projects</h4>
    <div class="dist">${dist}</div>
    <div class="rows">${s.cited_by.slice(0, 40).map(projLink).join('')}</div>
  `);
}

function showCell(row, col, { push = true } = {}) {
  const fam = meta.matrix.rows[row];
  const dom = meta.matrix.cols[col];
  navigate({ type: 'cell', row, col }, push);
  const ps = meta.projects.filter((p) => p.families?.includes(fam) && p.domains.includes(dom));
  setInspector('Method × domain', `
    <div class="insp-title">${esc(fam)} × ${esc(dom)}</div>
    <p class="small muted">${ps.length} project${ps.length === 1 ? '' : 's'} · expected ${meta.matrix.expected[row][col]} if methods and domains paired at random.</p>
    <div class="rows">${ps.map((p) => projLink(p.idx)).join('')}</div>`);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
function buildSearchUI() {
  const input = $('search-input');
  const box = $('search-results');
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(input.value), 140);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = box.querySelector('[data-idx]');
      if (first) { selectProject(Number(first.dataset.idx)); box.hidden = true; }
    }
    if (e.key === 'Escape') clearSearch();
  });
  input.addEventListener('focus', () => { if (box.innerHTML && input.value.trim()) box.hidden = false; });
  document.addEventListener('pointerdown', (e) => { if (!$('search').contains(e.target)) box.hidden = true; });
  $('search-clear').addEventListener('click', clearSearch);
}

function runSearch(q) {
  const box = $('search-results');
  $('search-clear').hidden = !q;
  if (!q || q.trim().length < 2) { clearSearch(false); return; }
  if (!search) {
    box.innerHTML = `<div class="sr-empty">Search index not loaded. Run the pipeline to create it.</div>`;
    box.hidden = false;
    return;
  }
  const { results, all } = search.search(q, visibleProjects(), 8);
  if (!results.length) {
    box.innerHTML = `<div class="sr-empty">No close matches. Try describing the topic, method or data.</div>`;
    box.hidden = false;
    setMatches(new Set());
    return;
  }
  const top = results[0].score;
  const strong = all.filter((r) => r.score >= Math.max(0.3, top * 0.6)).slice(0, 25);
  setMatches(new Set(strong.map((r) => r.p.idx)));
  box.innerHTML = `<div class="sr-head">${strong.length} strong match${strong.length === 1 ? '' : 'es'} highlighted on the map</div>` +
    results.map(({ p, score }) => {
      const b = meta.branches[p.branch_idx];
      return `<button class="sr-item" data-idx="${p.idx}">
        <i style="background:${b.color}"></i>
        <span class="sr-text"><b>${esc(p.title)}</b><em>${esc(b.name)} · ${esc(p.cohort)} · ${esc(p.methods[0] || '')}</em></span>
        <span class="sr-score"><span style="width:${Math.min(100, (score / Math.max(top, 0.01)) * 100)}%"></span></span>
      </button>`;
    }).join('');
  box.querySelectorAll('.sr-item').forEach((el) => el.addEventListener('click', () => {
    selectProject(Number(el.dataset.idx));
    box.hidden = true;
  }));
  box.hidden = false;
}

function setMatches(set) {
  state.searchActive = set.size > 0;
  for (let i = 0; i < pointCount; i++) A.match[i] = set.has(Math.round(A.proj[i])) ? 1 : 0;
  geometry.getAttribute('aMatch').needsUpdate = true;
  material.uniforms.uSearchActive.value = state.searchActive ? 1 : 0;
}

function clearSearch(clearInput = true) {
  if (clearInput) $('search-input').value = '';
  $('search-results').hidden = true;
  $('search-results').innerHTML = '';
  $('search-clear').hidden = !$('search-input').value;
  if (state.searchActive) setMatches(new Set());
}

// ---------------------------------------------------------------------------
// Overlays: citation network and method x domain matrix
// ---------------------------------------------------------------------------
function openNetwork() {
  $('matrix-overlay').hidden = true;
  $('network-overlay').hidden = false;
  const vis = new Set(visibleProjects().map((p) => p.idx));
  const st = network.open({ minCites: Number($('net-min').value), branch: Number($('net-branch').value), visibleProjects: vis });
  showToast(`${st.projects} projects · ${st.sources} sources · ${st.links} citations. Scroll to zoom, drag to pan.`);
}

function openMatrix() {
  $('network-overlay').hidden = true;
  $('matrix-overlay').hidden = false;
  const M = meta.matrix;
  const max = Math.max(1, ...M.observed.flat());
  const flagged = new Map();
  meta.gaps.filter((g) => g.type === 'untested').forEach((g) => flagged.set(g.title, g.idx));
  const groups = [];
  M.col_groups.forEach((g) => {
    if (!groups.length || groups[groups.length - 1].name !== g) groups.push({ name: g, n: 0 });
    groups[groups.length - 1].n++;
  });
  let html = `<table class="matrix"><thead><tr><th></th>${groups.map((g) => `<th colspan="${g.n}" class="grp">${esc(g.name)}</th>`).join('')}</tr>
    <tr><th></th>${M.cols.map((c) => `<th class="col"><span>${esc(c)}</span></th>`).join('')}</tr></thead><tbody>`;
  M.rows.forEach((r, i) => {
    html += `<tr><th class="row">${esc(r)}</th>`;
    M.cols.forEach((c, j) => {
      const o = M.observed[i][j];
      const gi = flagged.get(`${r} × ${c}`);
      const a = o ? 0.12 + 0.78 * (o / max) : 0;
      html += `<td class="${gi != null ? 'flag' : ''} ${o ? 'has' : ''}" style="--a:${a.toFixed(2)}" data-r="${i}" data-c="${j}" ${gi != null ? `data-gap="${gi}"` : ''}
        title="${esc(r)} × ${esc(c)}: ${o} observed, ${M.expected[i][j]} expected">${o || (gi != null ? '?' : '')}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  $('matrix-wrap').innerHTML = html;
  $('matrix-wrap').querySelectorAll('td').forEach((td) => td.addEventListener('click', () => {
    if (td.dataset.gap) selectGap(Number(td.dataset.gap), { fly: false });
    else if (td.classList.contains('has')) showCell(Number(td.dataset.r), Number(td.dataset.c));
  }));
}

function closeOverlays() {
  $('network-overlay').hidden = true;
  $('matrix-overlay').hidden = true;
  network.close();
}

// ---------------------------------------------------------------------------
// Add a project: semantic placement, scaffold claiming, local persistence
// ---------------------------------------------------------------------------
const SAMPLE_UPLOADS = [
  { title: 'Causal Retrofit Twins', method: 'Causal Inference', dataset: 'Smart meter data',
    abstract: 'Energy savings from retrofit programmes are estimated with engineering models rather than measured outcomes. We apply causal inference with difference-in-differences to smart meter data to measure which retrofit measures actually reduce building energy use.' },
  { title: 'Embodied Assembly World Model', method: 'World Model', dataset: 'Robot logs',
    abstract: 'Construction robots operate on changing sites. We train a world model from robot experience and plan timber assembly actions inside the learned model for robotic fabrication.' },
  { title: 'Post-Occupancy Comfort Loop', method: 'Time-Series Transformer', dataset: 'Indoor comfort sensors',
    abstract: 'Buildings are rarely evaluated after occupancy. Indoor comfort sensors and occupant feedback train a model of comfort and space use that feeds back into facade control.' },
];

function buildUploadUI() {
  $('up-cohort').innerHTML = meta.cohorts.map((c, i) => `<option value="${i}" ${i === meta.cohorts.length - 1 ? 'selected' : ''}>${esc(c)}</option>`).join('');
  $('repro-checks').innerHTML = RUBRIC_LABELS.map((l, i) => `<label><input type="checkbox" class="up-repro" id="up-repro-${i}" ${i < 3 ? 'checked' : ''}/> ${l}</label>`).join('');
  let t = null;
  ['up-title', 'up-abstract', 'up-method', 'up-dataset'].forEach((id) => $(id).addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(suggestPlacement, 220);
  }));
  $('upload-close').addEventListener('click', closeUploadModal);
  $('upload-cancel').addEventListener('click', closeUploadModal);
  $('upload-submit').addEventListener('click', submitUploadForm);
  $('upload-export').addEventListener('click', exportLocalProjects);
}

function uploadText() {
  return ['up-title', 'up-abstract', 'up-method', 'up-dataset'].map((id) => $(id).value).join('. ');
}

/** Nearest projects in LSA space -> branch vote, map position and zone. */
function placementFor(text) {
  if (!search) return null;
  const q = search.embed(text);
  if (!q) return null;
  const scored = meta.projects.map((p) => ({ p, s: search.cosine(q, p.idx) })).sort((a, b) => b.s - a.s).slice(0, 7);
  const votes = new Map();
  let wx = 0, wy = 0, wsum = 0;
  for (const { p, s } of scored) {
    const w = Math.max(s, 0) ** 2;
    votes.set(p.branch_idx, (votes.get(p.branch_idx) || 0) + w);
    wx += p.xy[0] * w; wy += p.xy[1] * w; wsum += w;
  }
  if (!wsum) return null;
  let branch = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const topSim = scored[0].s;
  // weakly connected to everything -> it belongs to the frontier
  const frontier = meta.branches.find((b) => b.is_frontier);
  if (topSim < 0.35 && frontier) branch = frontier.idx;
  return { q, branch, zone: meta.branches[branch].zone_idx, xy: [wx / wsum, wy / wsum], neighbours: scored.map((x) => x.p.idx), topSim };
}

function suggestPlacement() {
  const s = placementFor(uploadText());
  state.upload.suggestion = s;
  const el = $('placement-suggest');
  if (!s) {
    el.innerHTML = `<span class="muted">Write a title or abstract to get a suggested place on the map.</span>`;
  } else {
    const b = meta.branches[s.branch];
    el.innerHTML = `<b style="color:${b.color}">Suggested: ${esc(b.name)}</b>
      <span class="muted">Closest (${s.topSim.toFixed(2)}): ${s.neighbours.slice(0, 3).map((i) => esc(meta.projects[i].title)).join(', ')}</span>`;
    if (!state.upload.manual) selectUploadZone(s.zone, null, false);
  }
  buildZonePicker();
}

function openGhostCount(z) {
  let n = 0;
  for (let i = 0; i < pointCount; i++) if (A.built[i] < 0.5 && Math.round(A.zone[i]) === z) n++;
  return n;
}

function buildZonePicker() {
  const wrapEl = $('zone-picker');
  const sug = state.upload.suggestion;
  wrapEl.innerHTML = meta.zones.map((z) => {
    const names = z.branch_idxs.map((i) => meta.branches[i].name).join(' · ') || 'No branch yet';
    const color = z.branch_idxs.length ? meta.branches[z.branch_idxs[0]].color : '#6b7890';
    const open = openGhostCount(z.idx);
    return `<div class="zone-card ${state.upload.zone === z.idx ? 'selected' : ''}" data-idx="${z.idx}" role="button" tabindex="0">
      <span class="swatch" style="background:${color};color:${color}"></span>
      <div class="zone-card-text"><div class="zone-card-title">${esc(z.name)}${sug && sug.zone === z.idx ? ' <span class="tag">suggested</span>' : ''}</div>
      <div class="zone-card-sub">${esc(names)}</div></div>
      <span class="zone-card-left">${open ? `${(open / 1000).toFixed(1)}k open` : 'Full'}</span></div>`;
  }).join('');
  wrapEl.querySelectorAll('.zone-card').forEach((c) => c.addEventListener('click', () => selectUploadZone(Number(c.dataset.idx), null, true)));
}

function selectUploadZone(z, pin, manual) {
  state.upload.zone = z;
  state.upload.pin = pin;
  if (manual) state.upload.manual = true;
  setFocus(2, z);
  if (pin) {
    pinGroup.position.copy(pin);
    pinGroup.visible = true;
    $('pick-hint').textContent = `Pinned a spot on ${meta.zones[z].name}.`;
  } else {
    pinGroup.visible = false;
    if (manual || !state.upload.open) { const c = ZONE_CAMERAS[z]; flyTo(c.target, c.pos); }
    $('pick-hint').textContent = 'Or click the 3D model to pin an exact spot.';
  }
  document.querySelectorAll('#zone-picker .zone-card').forEach((el) => el.classList.toggle('selected', Number(el.dataset.idx) === z));
}

function openUploadModal(cohortIdx) {
  if (!geometry) return;
  closeOverlays();
  state.upload = { open: true, zone: 5, branch: null, pin: null, manual: false, suggestion: null };
  if (state.targetMorph < 0.9) transitionToMode(1);
  if (!state.showGhosts) { state.showGhosts = true; $('toggle-ghosts').checked = true; material.uniforms.uShowGhosts.value = 1; }
  const tpl = SAMPLE_UPLOADS[(meta.projects.filter((p) => p.local).length) % SAMPLE_UPLOADS.length];
  $('up-title').value = tpl.title;
  $('up-abstract').value = tpl.abstract;
  $('up-method').value = tpl.method;
  $('up-dataset').value = tpl.dataset;
  $('up-repo').value = '';
  if (Number.isInteger(cohortIdx) && meta.cohorts[cohortIdx]) $('up-cohort').value = String(cohortIdx);
  setHover(-1);
  suggestPlacement();
  const s = state.upload.suggestion;
  selectUploadZone(s ? s.zone : 5, null, false);
  const c = ZONE_CAMERAS[state.upload.zone];
  flyTo(c.target, c.pos);
  $('hud-inspector').classList.add('faded');
  const modal = $('upload-modal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeUploadModal() {
  state.upload.open = false;
  pinGroup.visible = false;
  const modal = $('upload-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  $('hud-inspector').classList.remove('faded');
  setFocus(0, -1);
}

function submitUploadForm() {
  const signals = RUBRIC_LABELS.map((l, i) => [l, $(`up-repro-${i}`).checked]);
  const s = state.upload.suggestion;
  const zone = state.upload.zone;
  const zoneBranches = meta.zones[zone].branch_idxs;
  const branch = s && zoneBranches.includes(s.branch) ? s.branch : (zoneBranches[0] ?? meta.branches.find((b) => b.is_frontier).idx);
  const rec = {
    title: $('up-title').value.trim() || 'Untitled MaAI project',
    abstract: $('up-abstract').value.trim(),
    cohort_idx: Number($('up-cohort').value),
    work_type: $('up-type').value,
    method: $('up-method').value.trim(),
    dataset: $('up-dataset').value.trim(),
    repo: $('up-repo').value.trim(),
    signals,
    zone,
    branch,
    pin: state.upload.pin ? state.upload.pin.toArray() : null,
    xy: s ? s.xy : meta.branches[branch].centroid,
    added_at: new Date().toISOString(),
  };
  closeUploadModal();
  if (placeProjectStone(rec)) saveLocalProject(rec);
}

function placeProjectStone(rec, { silent = false } = {}) {
  const z = rec.zone;
  const candidates = [];
  for (let i = 0; i < pointCount; i++) if (A.built[i] < 0.5 && Math.round(A.zone[i]) === z) candidates.push(i);
  if (!candidates.length) {
    if (!silent) showToast(`${meta.zones[z].name} is fully built. Choose another part of the basilica.`);
    return false;
  }
  if (rec.pin) {
    const [px, py, pz] = rec.pin;
    const d = (i) => (A.posB[i * 3] - px) ** 2 + (A.posB[i * 3 + 1] - py) ** 2 + (A.posB[i * 3 + 2] - pz) ** 2;
    candidates.sort((a, b) => d(a) - d(b));
  } else {
    candidates.sort((a, b) => A.posB[a * 3 + 1] - A.posB[b * 3 + 1]);
  }
  const zoneInfo = meta.zones[z];
  const score = rec.signals.filter(([, ok]) => ok).length;
  const avg = zoneInfo.projects ? zoneInfo.built_points / zoneInfo.projects : 300;
  const size = Math.min(candidates.length, Math.round(Math.max(120, Math.min(700, avg * (1 + 0.08 * score)))));
  const stone = candidates.slice(0, size);
  const idx = meta.projects.length;
  const b = meta.branches[rec.branch];
  const rgb = new THREE.Color(b.color);
  let cx = 0, cy = 0, cz = 0;
  for (const i of stone) {
    A.built[i] = 1;
    A.cohort[i] = rec.cohort_idx;
    A.proj[i] = idx;
    A.branch[i] = rec.branch;
    const r = Math.sqrt(Math.random()) * 1.1, th = Math.random() * Math.PI * 2;
    A.posU[i * 3] = rec.xy[0] + r * Math.cos(th);
    A.posU[i * 3 + 1] = rec.xy[1] + r * Math.sin(th);
    A.posU[i * 3 + 2] = 0;
    A.colors[i * 3] = rgb.r * 0.95; A.colors[i * 3 + 1] = rgb.g * 0.95; A.colors[i * 3 + 2] = rgb.b * 0.95;
    if (!silent) { A.flash[i] = 1; flashing.add(i); }
    cx += A.posB[i * 3]; cy += A.posB[i * 3 + 1]; cz += A.posB[i * 3 + 2];
  }
  layoutGalaxies(A, pointCount, [...meta.projects, { signals: rec.signals }]);
  computeDelays();
  ['aBuilt', 'aCohort', 'aProj', 'aBranch', 'aPosUmap', 'aColor', 'aFlash', 'aPosCosmos', 'aStar', 'aDelay'].forEach((n) => { geometry.getAttribute(n).needsUpdate = true; });

  const placement = search ? placementFor(`${rec.title}. ${rec.abstract}. ${rec.method}. ${rec.dataset}`) : null;
  const p = {
    idx, id: `local-${Date.parse(rec.added_at) || idx}`, title: rec.title, synthetic: false, local: true,
    cohort: meta.cohorts[rec.cohort_idx], cohort_idx: rec.cohort_idx, work_type: rec.work_type, abstract: rec.abstract,
    methods: rec.method ? [rec.method] : [], families: [], data: rec.dataset ? [rec.dataset] : [], tools: [], scale: null, domains: [], tags: [],
    repo: rec.repo ? { url: rec.repo, score, summary: 'Added in this browser. Run the pipeline to analyse the repository.', signals: rec.signals, languages: [], last_commit: null } : null,
    refs: [], similar: placement ? placement.neighbours.slice(0, 5) : [], coupled: [],
    xy: rec.xy, basilica: [cx / stone.length, cy / stone.length, cz / stone.length], point_count: stone.length,
    branch_idx: rec.branch, zone_idx: z,
  };
  meta.projects.push(p);
  if (search) search.addProjectVector(placement ? placement.q : null);
  zoneInfo.projects += 1;
  b.count += 1;
  const countEl = $(`bcount-${rec.branch}`);
  if (countEl) countEl.textContent = b.count;
  if (state.maxCohort < rec.cohort_idx) setCohort(allCohortIdx());
  updateStats();
  if (!silent) {
    selectProject(idx, { fly: false });
    showToast(`+${stone.length} points placed on ${zoneInfo.name}: "${rec.title}"`);
  }
  return true;
}

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function saveLocalProject(rec) {
  try {
    const all = loadLocal();
    all.push(rec);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* storage unavailable: the stone stays for this session only */ }
}

function restoreLocalProjects() {
  const recs = loadLocal();
  recs.forEach((r) => placeProjectStone(r, { silent: true }));
  if (recs.length) showToast(`Restored ${recs.length} project${recs.length === 1 ? '' : 's'} you added in this browser.`);
}

function exportLocalProjects() {
  const recs = loadLocal();
  if (!recs.length) { showToast('No projects added in this browser yet.'); return; }
  const out = recs.map((r) => ({
    title: r.title, abstract: r.abstract, cohort: meta.cohorts[r.cohort_idx], work_type: r.work_type.toLowerCase(),
    methods_free_text: [r.method].filter(Boolean), data_free_text: [r.dataset].filter(Boolean),
    repo: r.repo ? { url: r.repo, signals_self_reported: Object.fromEntries(r.signals) } : null,
    suggested_branch: meta.branches[r.branch]?.name, added_at: r.added_at,
    review: { status: 'pending' }, consent: { public: null, show_names: null },
  }));
  const blob = new Blob([JSON.stringify({ projects: out }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'maai-atlas-submissions.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast(`Exported ${out.length} submission${out.length === 1 ? '' : 's'} for review.`);
}

let toastTimer = null;
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

// ---------------------------------------------------------------------------
// Kickoff reel (for screen recording)
// ---------------------------------------------------------------------------
async function runKickoffReel() {
  if (state.reelRunning) return;
  state.reelRunning = true;
  const btn = $('btn-reel');
  btn.classList.add('recording');
  closeOverlays();
  clearSearch();
  setFocus(0, -1);
  setCohort(allCohortIdx());
  transitionToMode(0);
  showToast('Semantic map: every project placed by meaning');
  await sleep(2600);
  showToast('Markers: gaps the pipeline detected between and beyond branches');
  await sleep(2200);
  setCohort(0);
  transitionToMode(1);
  showToast(`Morphing into the basilica · cohort ${meta.cohorts[0]}`);
  await sleep(2400);
  for (let c = 1; c < meta.cohorts.length; c++) {
    setCohort(c);
    showToast(`Cohort ${meta.cohorts[c]} builds upward`);
    await sleep(1400);
  }
  setCohort(allCohortIdx());
  showToast('Faint scaffold = detected research gaps');
  await sleep(1600);
  const tpl = SAMPLE_UPLOADS[0];
  const s = placementFor(`${tpl.title}. ${tpl.abstract}`);
  const branch = s ? s.branch : meta.branches.find((b) => b.is_frontier).idx;
  const zone = meta.branches[branch].zone_idx;
  const c = ZONE_CAMERAS[zone];
  flyTo(c.target, c.pos);
  await sleep(900);
  placeProjectStone({ ...tpl, cohort_idx: meta.cohorts.length - 1, work_type: 'Thesis', repo: '', signals: RUBRIC_LABELS.map((l) => [l, true]),
    zone, branch, pin: null, xy: s ? s.xy : [0, 0], added_at: new Date().toISOString() });
  await sleep(2200);
  btn.classList.remove('recording');
  state.reelRunning = false;
}

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
function animate(now = 0) {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  const tw = state.tween;
  if (tw) {
    // real time, not the clamped frame time: the change takes the same time on a slow GPU
    const nowS = performance.now() / 1000;
    tw.t = Math.min(tw.dur, tw.t + Math.min(0.25, nowS - (tw.last ?? nowS)));
    tw.last = nowS;
    const k = tw.t / tw.dur;
    state.morph = tw.m0 + (tw.m1 - tw.m0) * k;
    if (tw.cam) camPose(tw.cam.from, tw.cam.to, smooth(Math.min(1, k * 1.08)), camera.position, controls.target);
    if (k >= 1) { state.morph = tw.m1; state.tween = null; }
    const pct = Math.round(state.morph * 100);
    if (EMBED) window.parent?.postMessage({ atlas: 'morph', v: state.morph }, '*');
    $('morph-slider').value = pct;
    $('morph-pct').textContent = `${pct}%`;
  }
  material.uniforms.uMorph.value = state.morph;
  material.uniforms.uTime.value = elapsed;
  state.cosmosAmt += ((state.cosmos ? 1 : 0) - state.cosmosAmt) * Math.min(1, dt * 3);
  if (Math.abs(state.cosmosAmt - (state.cosmos ? 1 : 0)) < 0.002) state.cosmosAmt = state.cosmos ? 1 : 0;
  material.uniforms.uCosmos.value = state.cosmosAmt;
  const space = state.cosmosAmt * (1 - smooth(state.morph));
  cosmos.update({ space: state.cosmosAmt * (1 - smooth(Math.min(1, state.morph / 0.35))), cos: state.cosmosAmt, g: state.morph, toScreen: projectToScreen });
  // focus mode (deck tabs): galaxies dim with the cosmos focus weight, only in the 2D map
  { const gw = 1 + (cosmos.fw[0] - 1) * (1 - smooth(state.morph)); material.uniforms.uDim.value = gw; $('labels-layer').style.opacity = gw.toFixed(3); $('gap-layer').style.opacity = cosmos.fw[3].toFixed(3); }
  document.body.classList.toggle('cosmos-on', space > 0.5);

  if (flashing.size) {
    for (const i of flashing) {
      A.flash[i] = Math.max(0, A.flash[i] - dt * 0.65);
      if (A.flash[i] <= 0) flashing.delete(i);
    }
    geometry.getAttribute('aFlash').needsUpdate = true;
  }

  if (camLerp) {
    camLerp.t = Math.min(1, camLerp.t + dt * (reduceMotion ? 4 : 1.2));
    camPose(camLerp.from, camLerp.to, smooth(camLerp.t), camera.position, controls.target);
    if (camLerp.t >= 1) camLerp = null;
  } else if (state.autoOrbit && state.morph > 0.65 && !state.upload.open && state.hover < 0 && state.selected < 0) {
    const angle = dt * 0.14;
    const x = camera.position.x - controls.target.x;
    const z = camera.position.z - controls.target.z;
    camera.position.x = controls.target.x + x * Math.cos(angle) - z * Math.sin(angle);
    camera.position.z = controls.target.z + x * Math.sin(angle) + z * Math.cos(angle);
  }

  if (pinGroup.visible) {
    const s = 1 + 0.22 * Math.sin(elapsed * 5);
    pinRing.scale.set(s, s, s);
    pinRing.lookAt(camera.position);
  }
  grid.material.opacity = 0.42 * state.morph;

  controls.update();
  updateHover(now);
  updateOverlays();
  if (space > 0.01) {
    bloom.strength = 0.6 * space;
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  if (cosmos) cosmos.setSize(window.innerWidth, window.innerHeight);
  clearTimeout(fitTimer);
  fitTimer = setTimeout(refitIfAtPreset, 150);
});
let fitTimer = null;
// panels open and close: fit the views again when the slide ends
let bodyCls = '';
new MutationObserver(() => {
  const c = document.body.className.replace('cosmos-on', '').trim();
  if (c === bodyCls) return;
  bodyCls = c;
  clearTimeout(fitTimer); fitTimer = setTimeout(refitIfAtPreset, 340);
})
  .observe(document.body, { attributes: true, attributeFilter: ['class'] });
// a user drag takes the camera; the points finish their change alone
controls.addEventListener('start', () => { if (state.tween) state.tween.cam = null; camLerp = null; });

init().catch((err) => {
  console.error(err);
  $('inspector-body').innerHTML = `<p class="note">Could not load the Atlas data: ${esc(err.message)}. Serve the folder over HTTP (python -m http.server) after running the pipeline.</p>`;
});
