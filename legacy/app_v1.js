import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------------------
// Custom GLSL Shaders for GPU Morph (2D UMAP <-> 3D Sagrada Família)
// ---------------------------------------------------------------------------
const VERTEX_SHADER = /* glsl */ `
  attribute vec3 aPosUmap;
  attribute vec3 aColor;
  attribute float aCohort;
  attribute float aBuilt;
  attribute float aBranch;
  attribute float aFlash;

  uniform float uMorph;
  uniform float uTime;
  uniform float uMaxCohort;
  uniform float uShowGhosts;
  uniform float uActiveBranch;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Ease morph smoothly with cubic smoothstep
    float m = smoothstep(0.0, 1.0, uMorph);

    // Slight spiral arc mid-transition so particles feel architectural in motion
    vec3 pos = mix(aPosUmap, position, m);
    float arc = sin(m * 3.14159265);
    pos.z += arc * (aBranch - 2.5) * 3.5;

    // Gentle upward float on unbuilt ghost scaffold
    bool isBuilt = (aBuilt > 0.5) && (aCohort <= uMaxCohort + 0.01);
    if (!isBuilt) {
      pos.y += sin(uTime * 1.3 + position.x * 0.25 + position.z * 0.25) * 0.22 * m;
    }

    // Newly uploaded stone flash / settle
    if (aFlash > 0.01) {
      pos.y += aFlash * 14.0 * m;
    }

    // Branch focus dimming
    float branchMatch = (uActiveBranch < -0.5 || abs(aBranch - uActiveBranch) < 0.2) ? 1.0 : 0.14;

    // Visibility & alpha
    float alpha = 0.0;
    float ptSize = 2.0;
    if (isBuilt) {
      alpha = 0.86 * branchMatch;
      ptSize = mix(3.4, 2.05, m);
    } else if (uShowGhosts > 0.5) {
      // Ghost scaffold is subtler in 2D UMAP, crisp architectural wireframe in 3D
      alpha = mix(0.06, 0.20, m) * branchMatch;
      ptSize = mix(1.6, 1.55, m);
    }

    // Highlight newly uploaded stone in warm gold
    vec3 col = mix(aColor, vec3(1.0, 0.88, 0.45), aFlash);
    if (aFlash > 0.01) {
      ptSize += aFlash * 4.0;
      alpha = max(alpha, 0.98);
    }

    vColor = col;
    vAlpha = alpha;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = clamp(ptSize * uPixelRatio * (145.0 / max(-mvPosition.z, 10.0)), 1.0, 12.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    if (vAlpha < 0.015) discard;
    vec2 uv = gl_PointCoord - vec2(0.5);
    float d = length(uv);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.12, d);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let meta = null;
let rawData = null;
let pointCount = 0;
let geometry = null;
let material = null;
let pointsMesh = null;

const state = {
  morph: 1.0,
  targetMorph: 1.0,
  maxCohort: 3, // 0=24/25, 1=25/26, 2=26/27, 3=All
  activeBranch: -1, // -1 = all
  showGhosts: true,
  autoOrbit: true,
  reelRunning: false,
  selectedProject: null,
  uploadCount: 0,
  uploadOpen: false,
  uploadBranch: 5,
  uploadPinPoint: null, // optional THREE.Vector3 pinned by clicking the 3D model
  prevActiveBranch: -1,
};

// Camera presets
const CAM_3D = { pos: new THREE.Vector3(78, 34, 96), target: new THREE.Vector3(0, 6, 0) };
const CAM_2D = { pos: new THREE.Vector3(0, 8, 128), target: new THREE.Vector3(0, 8, 0) };

// Architectural camera presets per Basilica zone (matches BRANCHES 0..5)
const ZONE_CAMERAS = [
  { pos: new THREE.Vector3(92, 22, 18), target: new THREE.Vector3(16, 4, 0) },   // 0: Nativity (East +X)
  { pos: new THREE.Vector3(-92, 22, -18), target: new THREE.Vector3(-16, 4, 0) }, // 1: Passion (West -X)
  { pos: new THREE.Vector3(54, 48, 56), target: new THREE.Vector3(0, 22, 0) },    // 2: Evangelist Towers
  { pos: new THREE.Vector3(64, 16, -54), target: new THREE.Vector3(0, -6, -6) },  // 3: Central Nave & Vaults
  { pos: new THREE.Vector3(24, 34, 94), target: new THREE.Vector3(0, 12, 14) },   // 4: Apse & Virgin Mary (+Z)
  { pos: new THREE.Vector3(38, 42, -96), target: new THREE.Vector3(0, 22, -12) }, // 5: Glory & Tower of Jesus (-Z)
];
let camLerp = null;

// ---------------------------------------------------------------------------
// Three.js Setup
// ---------------------------------------------------------------------------
const wrap = document.getElementById('canvas-wrap');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.5, 1000);
camera.position.copy(CAM_3D.pos);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
wrap.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.copy(CAM_3D.target);
controls.maxDistance = 260;
controls.minDistance = 28;

// Subtle architectural ground grid (visible in 3D mode)
const grid = new THREE.GridHelper(120, 24, 0x263147, 0x151b28);
grid.position.y = -34.2;
grid.material.transparent = true;
grid.material.opacity = 0.45;
scene.add(grid);

// Pulsing golden beacon showing where a student's new stone will land
const pinGroup = new THREE.Group();
const pinCore = new THREE.Mesh(
  new THREE.SphereGeometry(1.3, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xffe07d, transparent: true, opacity: 0.95 })
);
const pinRing = new THREE.Mesh(
  new THREE.RingGeometry(2.1, 2.8, 32),
  new THREE.MeshBasicMaterial({ color: 0xe9c46a, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
);
pinGroup.add(pinCore, pinRing);
pinGroup.visible = false;
scene.add(pinGroup);

// ---------------------------------------------------------------------------
// Load Binary Point Cloud + Metadata
// ---------------------------------------------------------------------------
async function init() {
  const [metaRes, binRes] = await Promise.all([
    fetch('data/atlas_meta.json'),
    fetch('data/points.bin'),
  ]);
  meta = await metaRes.json();
  const buf = await binRes.arrayBuffer();
  rawData = new Float32Array(buf);

  const stride = meta.floats_per_point; // 13
  pointCount = meta.point_count;

  const posBasilica = new Float32Array(pointCount * 3);
  const posUmap = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const cohorts = new Float32Array(pointCount);
  const built = new Float32Array(pointCount);
  const branches = new Float32Array(pointCount);
  const flashes = new Float32Array(pointCount);

  for (let i = 0; i < pointCount; i++) {
    const o = i * stride;
    posBasilica[i * 3] = rawData[o];
    posBasilica[i * 3 + 1] = rawData[o + 1];
    posBasilica[i * 3 + 2] = rawData[o + 2];

    posUmap[i * 3] = rawData[o + 3];
    posUmap[i * 3 + 1] = rawData[o + 4];
    posUmap[i * 3 + 2] = rawData[o + 5];

    colors[i * 3] = rawData[o + 6];
    colors[i * 3 + 1] = rawData[o + 7];
    colors[i * 3 + 2] = rawData[o + 8];

    cohorts[i] = rawData[o + 9];
    built[i] = rawData[o + 10];
    // rawData[o + 11] = proj_idx
    branches[i] = rawData[o + 12];
  }

  geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(posBasilica, 3));
  geometry.setAttribute('aPosUmap', new THREE.BufferAttribute(posUmap, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aCohort', new THREE.BufferAttribute(cohorts, 1));
  geometry.setAttribute('aBuilt', new THREE.BufferAttribute(built, 1));
  geometry.setAttribute('aBranch', new THREE.BufferAttribute(branches, 1));
  geometry.setAttribute('aFlash', new THREE.BufferAttribute(flashes, 1));

  material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMorph: { value: state.morph },
      uTime: { value: 0 },
      uMaxCohort: { value: state.maxCohort },
      uShowGhosts: { value: 1.0 },
      uActiveBranch: { value: -1.0 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    },
  });

  pointsMesh = new THREE.Points(geometry, material);
  scene.add(pointsMesh);

  buildUI();
  buildBranchLabels();
  updateStats();
  animate();
}

// ---------------------------------------------------------------------------
// UI Wiring
// ---------------------------------------------------------------------------
function updateStats() {
  const builtAttr = geometry.getAttribute('aBuilt');
  const cohortAttr = geometry.getAttribute('aCohort');
  let builtPts = 0;
  for (let i = 0; i < pointCount; i++) {
    if (builtAttr.array[i] > 0.5 && cohortAttr.array[i] <= state.maxCohort + 0.01) {
      builtPts++;
    }
  }
  const visibleProjects = meta.projects.filter((p) => p.cohort_idx <= state.maxCohort).length;
  document.getElementById('stat-projects').textContent = visibleProjects;
  document.getElementById('stat-built').textContent = `${((builtPts / pointCount) * 100).toFixed(1)}%`;
  document.getElementById('stat-points').textContent = `${(pointCount / 1000).toFixed(1)}k`;
}

function buildUI() {
  // Branch legend
  const list = document.getElementById('branch-list');
  list.innerHTML = '';
  meta.branches.forEach((b, idx) => {
    const count = meta.projects.filter((p) => p.branch_idx === idx).length;
    const el = document.createElement('div');
    el.className = 'branch-item';
    el.dataset.idx = idx;
    el.innerHTML = `
      <span class="swatch" style="background:${b.color};color:${b.color}"></span>
      <div class="branch-text">
        <div class="branch-name">${b.name}</div>
        <div class="branch-zone">${b.zone}</div>
      </div>
      <span class="branch-count" id="bcount-${idx}">${count}</span>
    `;
    el.addEventListener('click', () => {
      state.activeBranch = state.activeBranch === idx ? -1 : idx;
      syncBranchSelection();
    });
    list.appendChild(el);
  });

  document.getElementById('branch-reset').addEventListener('click', () => {
    state.activeBranch = -1;
    syncBranchSelection();
  });

  // Cohort pills
  document.querySelectorAll('#cohort-pills .pill-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = Number(btn.dataset.cohort);
      setCohort(c);
    });
  });

  // Toggles
  document.getElementById('toggle-ghosts').addEventListener('change', (e) => {
    state.showGhosts = e.target.checked;
    material.uniforms.uShowGhosts.value = state.showGhosts ? 1.0 : 0.0;
  });

  document.getElementById('toggle-orbit').addEventListener('change', (e) => {
    state.autoOrbit = e.target.checked;
  });

  // Morph slider & mode buttons
  const slider = document.getElementById('morph-slider');
  const pct = document.getElementById('morph-pct');
  slider.addEventListener('input', () => {
    const v = Number(slider.value) / 100;
    state.targetMorph = v;
    state.morph = v;
    pct.textContent = `${slider.value}%`;
    updateModeButtons(v);
  });

  document.getElementById('btn-2d').addEventListener('click', () => transitionToMode(0.0));
  document.getElementById('btn-3d').addEventListener('click', () => transitionToMode(1.0));
  document.getElementById('btn-upload').addEventListener('click', openUploadModal);
  document.getElementById('btn-reel').addEventListener('click', runKickoffReel);

  // Upload drawer controls
  document.getElementById('upload-close').addEventListener('click', closeUploadModal);
  document.getElementById('upload-cancel').addEventListener('click', closeUploadModal);
  document.getElementById('upload-submit').addEventListener('click', submitUploadForm);
}

function syncBranchSelection() {
  material.uniforms.uActiveBranch.value = state.activeBranch;
  document.getElementById('branch-reset').style.display = state.activeBranch >= 0 ? 'inline' : 'none';
  document.querySelectorAll('.branch-item').forEach((el) => {
    const idx = Number(el.dataset.idx);
    el.classList.toggle('active', state.activeBranch === idx);
    el.classList.toggle('dimmed', state.activeBranch >= 0 && state.activeBranch !== idx);
  });
}

function setCohort(c) {
  state.maxCohort = c;
  material.uniforms.uMaxCohort.value = c;
  const names = ['24/25', '≤ 25/26', '≤ 26/27', 'All'];
  document.getElementById('cohort-label').textContent = names[c];
  document.querySelectorAll('#cohort-pills .pill-btn').forEach((b) => {
    b.classList.toggle('active', Number(b.dataset.cohort) === c);
  });
  updateStats();
}

function updateModeButtons(v) {
  document.getElementById('btn-2d').classList.toggle('active', v < 0.5);
  document.getElementById('btn-3d').classList.toggle('active', v >= 0.5);
}

function transitionToMode(target) {
  state.targetMorph = target;
  updateModeButtons(target);
  const preset = target < 0.5 ? CAM_2D : CAM_3D;
  camLerp = {
    startPos: camera.position.clone(),
    endPos: preset.pos.clone(),
    startTarget: controls.target.clone(),
    endTarget: preset.target.clone(),
    t: 0,
  };
}

// ---------------------------------------------------------------------------
// 2D / 3D Floating Branch Labels
// ---------------------------------------------------------------------------
const labelEls = [];
function buildBranchLabels() {
  const layer = document.getElementById('labels-layer');
  layer.innerHTML = '';
  meta.branches.forEach((b) => {
    const el = document.createElement('div');
    el.className = 'branch-label';
    el.style.color = b.color;
    el.textContent = b.name;
    layer.appendChild(el);
    labelEls.push(el);
  });
}

const tmpVec = new THREE.Vector3();
function updateBranchLabels() {
  if (!meta) return;
  // Show crisp cluster labels in 2D UMAP mode, fade softly in 3D mode
  const opacity = Math.max(0, 1.0 - state.morph * 1.45);
  meta.branches.forEach((b, idx) => {
    const el = labelEls[idx];
    if (opacity < 0.03 || (state.activeBranch >= 0 && state.activeBranch !== idx)) {
      el.style.opacity = '0';
      return;
    }
    tmpVec.set(b.umap_center[0], b.umap_center[1] + 13.5, 0);
    tmpVec.project(camera);
    const x = (tmpVec.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-tmpVec.y * 0.5 + 0.5) * window.innerHeight;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.opacity = opacity.toFixed(2);
  });
}

// ---------------------------------------------------------------------------
// Student Project Upload Drawer & Direct 3D Spot Picking
// ---------------------------------------------------------------------------
const SAMPLE_UPLOADS = [
  { title: 'Neuro-Symbolic Daylight Zoning', method: 'Neuro-Symbolic', dataset: 'Barcelona Cadastre + EPW' },
  { title: 'Causal Heatwave Intervention Twin', method: 'Causal Inference', dataset: 'Landsat LST + IoT Loggers' },
  { title: 'Embodied Timber Joinery World Model', method: 'World Models', dataset: 'Robotic Assembly Logs' },
  { title: 'Post-Occupancy Facade Feedback Loop', method: 'Embodied AI', dataset: 'Indoor Comfort Sensors' },
  { title: 'Cross-Cohort Citation Lineage Agent', method: 'Knowledge Graph', dataset: 'IAAC Archive + OpenAlex' },
];

function getRemainingGhostCount(branchIdx) {
  const builtAttr = geometry.getAttribute('aBuilt');
  const branchAttr = geometry.getAttribute('aBranch');
  let n = 0;
  for (let i = 0; i < pointCount; i++) {
    if (builtAttr.array[i] < 0.5 && Math.round(branchAttr.array[i]) === branchIdx) n++;
  }
  return n;
}

function focusCameraOnZone(branchIdx) {
  const preset = ZONE_CAMERAS[branchIdx] || CAM_3D;
  camLerp = {
    startPos: camera.position.clone(),
    endPos: preset.pos.clone(),
    startTarget: controls.target.clone(),
    endTarget: preset.target.clone(),
    t: 0,
  };
}

function buildZonePicker() {
  const wrapEl = document.getElementById('zone-picker');
  wrapEl.innerHTML = '';
  meta.branches.forEach((b, idx) => {
    const rem = getRemainingGhostCount(idx);
    const card = document.createElement('div');
    card.className = `zone-card ${state.uploadBranch === idx ? 'selected' : ''}`;
    card.dataset.idx = idx;
    card.innerHTML = `
      <span class="swatch" style="background:${b.color};color:${b.color}"></span>
      <div class="zone-card-text">
        <div class="zone-card-title">${b.zone}</div>
        <div class="zone-card-sub">${b.name}</div>
      </div>
      <span class="zone-card-left">${rem > 0 ? `${(rem / 1000).toFixed(1)}k open` : 'Full'}</span>
    `;
    card.addEventListener('click', () => {
      selectUploadZone(idx, null);
    });
    wrapEl.appendChild(card);
  });
}

function selectUploadZone(branchIdx, customPin) {
  state.uploadBranch = branchIdx;
  state.uploadPinPoint = customPin;

  // Highlight chosen tower/zone in 3D and glide camera to face it
  state.activeBranch = branchIdx;
  syncBranchSelection();
  if (!customPin) {
    focusCameraOnZone(branchIdx);
    pinGroup.visible = false;
    document.getElementById('pick-hint').textContent =
      `Selected: ${meta.branches[branchIdx].zone}. Click directly on the 3D model to pin an exact spot, or place on the next course.`;
  } else {
    pinGroup.position.copy(customPin);
    pinGroup.visible = true;
    document.getElementById('pick-hint').textContent =
      `Pinned exact spot on ${meta.branches[branchIdx].zone} — ready to place stone!`;
  }

  // Auto-suggest method & dataset if empty or default
  const b = meta.branches[branchIdx];
  const mEl = document.getElementById('up-method');
  const dEl = document.getElementById('up-dataset');
  if (!mEl.dataset.edited) mEl.value = b.methods[0];
  if (!dEl.dataset.edited) dEl.value = b.datasets[0];

  document.querySelectorAll('#zone-picker .zone-card').forEach((el) => {
    el.classList.toggle('selected', Number(el.dataset.idx) === branchIdx);
  });
}

function openUploadModal() {
  if (!geometry) return;
  state.uploadOpen = true;
  state.prevActiveBranch = state.activeBranch;
  state.uploadPinPoint = null;

  // Ensure 3D Basilica & ghost scaffold are visible for picking
  if (state.targetMorph < 0.9) transitionToMode(1.0);
  if (!state.showGhosts) {
    state.showGhosts = true;
    document.getElementById('toggle-ghosts').checked = true;
    material.uniforms.uShowGhosts.value = 1.0;
  }

  const tpl = SAMPLE_UPLOADS[state.uploadCount % SAMPLE_UPLOADS.length];
  document.getElementById('up-title').value = tpl.title;
  const mEl = document.getElementById('up-method');
  const dEl = document.getElementById('up-dataset');
  mEl.dataset.edited = '';
  dEl.dataset.edited = '';
  mEl.oninput = () => { mEl.dataset.edited = '1'; };
  dEl.oninput = () => { dEl.dataset.edited = '1'; };

  const initialBranch = state.activeBranch >= 0 ? state.activeBranch : 5;
  buildZonePicker();
  selectUploadZone(initialBranch, null);

  document.getElementById('hud-inspector').style.opacity = '0';
  document.getElementById('hud-inspector').style.pointerEvents = 'none';
  const modal = document.getElementById('upload-modal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeUploadModal() {
  state.uploadOpen = false;
  state.uploadPinPoint = null;
  pinGroup.visible = false;
  const modal = document.getElementById('upload-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.getElementById('hud-inspector').style.opacity = '1';
  document.getElementById('hud-inspector').style.pointerEvents = 'auto';

  // Restore full cathedral view
  state.activeBranch = -1;
  syncBranchSelection();
}

function submitUploadForm() {
  const title = document.getElementById('up-title').value.trim() || `MaAI Project #${state.uploadCount + 1}`;
  const cohortIdx = Number(document.getElementById('up-cohort').value);
  const workType = document.getElementById('up-type').value;
  const method = document.getElementById('up-method').value.trim() || 'Neural Network';
  const dataset = document.getElementById('up-dataset').value.trim() || 'Custom Dataset';
  const reproScore = Array.from(document.querySelectorAll('.up-repro')).filter((c) => c.checked).length;
  const targetBranch = state.uploadBranch;
  const pinPt = state.uploadPinPoint ? state.uploadPinPoint.clone() : null;

  closeUploadModal();
  placeProjectStone({ title, cohortIdx, workType, method, dataset, reproScore, targetBranch, pinPt });
}

function placeProjectStone({ title, cohortIdx, workType, method, dataset, reproScore, targetBranch, pinPt }) {
  if (!geometry) return;
  const builtAttr = geometry.getAttribute('aBuilt');
  const cohortAttr = geometry.getAttribute('aCohort');
  const branchAttr = geometry.getAttribute('aBranch');
  const posAttr = geometry.getAttribute('position');
  const flashAttr = geometry.getAttribute('aFlash');

  const candidates = [];
  for (let i = 0; i < pointCount; i++) {
    if (builtAttr.array[i] < 0.5 && Math.round(branchAttr.array[i]) === targetBranch) {
      candidates.push(i);
    }
  }
  if (candidates.length === 0) {
    showToast('This part of the basilica is 100% built! Choose another tower or façade.');
    return;
  }

  // If the student pinned an exact 3D spot, claim the nearest unbuilt points around it;
  // otherwise build cleanly bottom-to-top on that tower/zone.
  if (pinPt) {
    candidates.sort((a, b) => {
      const da = Math.hypot(
        posAttr.array[a * 3] - pinPt.x,
        posAttr.array[a * 3 + 1] - pinPt.y,
        posAttr.array[a * 3 + 2] - pinPt.z
      );
      const db = Math.hypot(
        posAttr.array[b * 3] - pinPt.x,
        posAttr.array[b * 3 + 1] - pinPt.y,
        posAttr.array[b * 3 + 2] - pinPt.z
      );
      return da - db;
    });
  } else {
    candidates.sort((a, b) => posAttr.array[a * 3 + 1] - posAttr.array[b * 3 + 1]);
  }

  // Stone density scales with reproducibility signals (160..420 points)
  const targetSize = 160 + reproScore * 65;
  const stoneSize = Math.min(targetSize, candidates.length);
  const stone = candidates.slice(0, stoneSize);

  let cx = 0, cy = 0, cz = 0;
  for (const idx of stone) {
    builtAttr.array[idx] = 1.0;
    cohortAttr.array[idx] = cohortIdx;
    flashAttr.array[idx] = 1.0;
    cx += posAttr.array[idx * 3];
    cy += posAttr.array[idx * 3 + 1];
    cz += posAttr.array[idx * 3 + 2];
  }
  builtAttr.needsUpdate = true;
  cohortAttr.needsUpdate = true;
  flashAttr.needsUpdate = true;

  const branch = meta.branches[targetBranch];
  state.uploadCount++;

  const newProj = {
    id: meta.projects.length,
    title,
    branch: branch.id,
    branch_idx: targetBranch,
    cohort: meta.cohorts[cohortIdx] || '26/27',
    cohort_idx: cohortIdx,
    work_type: workType,
    method,
    dataset,
    repro_score: reproScore,
    umap: [branch.umap_center[0] + (Math.random() - 0.5) * 14, branch.umap_center[1] + (Math.random() - 0.5) * 14],
    basilica: [cx / stoneSize, cy / stoneSize, cz / stoneSize],
    point_count: stoneSize,
  };
  meta.projects.push(newProj);

  if (state.maxCohort < cohortIdx) setCohort(3);

  const countEl = document.getElementById(`bcount-${targetBranch}`);
  if (countEl) countEl.textContent = Number(countEl.textContent) + 1;
  updateStats();
  renderInspector(newProj, true);
  showToast(`+${stoneSize} points placed on ${branch.zone}: "${newProj.title}"`);
}

function simulateStudentUpload() {
  const targetBranch = state.activeBranch >= 0 ? state.activeBranch : 5;
  const tpl = SAMPLE_UPLOADS[state.uploadCount % SAMPLE_UPLOADS.length];
  placeProjectStone({
    title: `${tpl.title} (#${state.uploadCount + 1})`,
    cohortIdx: 2,
    workType: 'Thesis (MaAI-02)',
    method: tpl.method,
    dataset: tpl.dataset,
    reproScore: 4,
    targetBranch,
    pinPt: null,
  });
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ---------------------------------------------------------------------------
// 10-Second Choreographed Kickoff Reel (ready to screen-record!)
// ---------------------------------------------------------------------------
async function runKickoffReel() {
  if (state.reelRunning) return;
  state.reelRunning = true;
  const btn = document.getElementById('btn-reel');
  btn.textContent = '● Recording Reel…';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  state.activeBranch = -1;
  syncBranchSelection();

  // 1. Start on 2D Semantic UMAP (2.2s)
  setCohort(3);
  transitionToMode(0.0);
  showToast('1 · 2D Semantic Map (conceptual closeness)');
  await sleep(2400);

  // 2. Morph into 3D Sagrada Família starting at 24/25 cohort (2.4s)
  setCohort(0);
  transitionToMode(1.0);
  showToast('2 · Morphing into Sagrada Família · Cohort 24/25');
  await sleep(2300);

  // 3. Grow Cohort 25/26 -> 26/27 (2.8s)
  setCohort(1);
  showToast('3 · Cohort 25/26 rises upward');
  await sleep(1400);
  setCohort(2);
  showToast('4 · Cohort 26/27 + unbuilt research-gap scaffold');
  await sleep(1500);

  // 4. Fire a live student upload onto the Central Tower (2.2s)
  simulateStudentUpload();
  await sleep(2200);

  btn.textContent = '▶ 10s Kickoff Reel';
  state.reelRunning = false;
}

// ---------------------------------------------------------------------------
// Click-to-Inspect Nearest Project (works in both 2D & 3D!)
// ---------------------------------------------------------------------------
const pointer = new THREE.Vector2();
let downPos = { x: 0, y: 0 };

renderer.domElement.addEventListener('pointerdown', (e) => {
  downPos = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('pointerup', (e) => {
  if (!meta) return;
  // Ignore drag/orbit gestures
  if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 5) return;

  // If the Upload Drawer is open in 3D mode, clicking the model pins the exact unbuilt spot!
  if (state.uploadOpen && state.morph > 0.6) {
    const builtAttr = geometry.getAttribute('aBuilt');
    const branchAttr = geometry.getAttribute('aBranch');
    const posAttr = geometry.getAttribute('position');
    let bestIdx = -1;
    let bestScore = Infinity;

    // Stride by 3 for instant <4ms screen-space nearest unbuilt ghost lookup
    for (let i = 0; i < pointCount; i += 3) {
      if (builtAttr.array[i] >= 0.5) continue;
      tmpVec.set(posAttr.array[i * 3], posAttr.array[i * 3 + 1], posAttr.array[i * 3 + 2]).project(camera);
      if (tmpVec.z > 1 || tmpVec.z < -1) continue;
      const sx = (tmpVec.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-tmpVec.y * 0.5 + 0.5) * window.innerHeight;
      const d = Math.hypot(sx - e.clientX, sy - e.clientY);
      if (d < 34) {
        // Prefer closer to cursor and nearer to camera
        const score = d + tmpVec.z * 8;
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
    }

    if (bestIdx >= 0) {
      const pinned = new THREE.Vector3(
        posAttr.array[bestIdx * 3],
        posAttr.array[bestIdx * 3 + 1],
        posAttr.array[bestIdx * 3 + 2]
      );
      const pickedBranch = Math.round(branchAttr.array[bestIdx]);
      selectUploadZone(pickedBranch, pinned);
      return;
    }
  }

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

  // Screen-space nearest project centroid (fast & accurate in both 2D and 3D)
  const m = state.morph;
  const smoothM = m * m * (3 - 2 * m);
  let best = null;
  let bestDist = 28; // px threshold

  for (const p of meta.projects) {
    if (p.cohort_idx > state.maxCohort) continue;
    if (state.activeBranch >= 0 && p.branch_idx !== state.activeBranch) continue;

    const px = p.umap[0] * (1 - smoothM) + p.basilica[0] * smoothM;
    const py = p.umap[1] * (1 - smoothM) + p.basilica[1] * smoothM;
    const pz = 0 * (1 - smoothM) + p.basilica[2] * smoothM;

    tmpVec.set(px, py, pz).project(camera);
    if (tmpVec.z > 1) continue;
    const sx = (tmpVec.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-tmpVec.y * 0.5 + 0.5) * window.innerHeight;
    const d = Math.hypot(sx - e.clientX, sy - e.clientY);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }

  if (best) renderInspector(best, false);
});

function renderInspector(p, isNew) {
  const b = meta.branches[p.branch_idx];
  const signals = ['README', 'Deps', 'Data', 'Licence'];
  const chips = signals
    .map((s, i) => `<span class="repro-chip ${i < p.repro_score ? 'ok' : ''}">${i < p.repro_score ? '✓' : '·'} ${s}</span>`)
    .join('');

  document.getElementById('inspector-body').innerHTML = `
    <span class="insp-badge" style="background:${b.color}22;color:${b.color};border:1px solid ${b.color}66">
      ${isNew ? '★ New Upload · ' : ''}${b.name}
    </span>
    <div class="insp-title">${p.title}</div>
    <div class="insp-grid">
      <span class="insp-k">Cohort</span><span class="insp-v">${p.cohort}</span>
      <span class="insp-k">Work type</span><span class="insp-v">${p.work_type}</span>
      <span class="insp-k">AI Method</span><span class="insp-v">${p.method}</span>
      <span class="insp-k">Dataset</span><span class="insp-v">${p.dataset}</span>
      <span class="insp-k">Basilica</span><span class="insp-v">${b.zone}</span>
      <span class="insp-k">Stone</span><span class="insp-v">${p.point_count} pts</span>
    </div>
    <div class="repro-bar">${chips}</div>
  `;
}

// ---------------------------------------------------------------------------
// Animation Loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;

  // Smooth morph interpolation
  if (Math.abs(state.morph - state.targetMorph) > 0.0005) {
    state.morph += (state.targetMorph - state.morph) * Math.min(1, dt * 3.8);
    const pct = Math.round(state.morph * 100);
    document.getElementById('morph-slider').value = pct;
    document.getElementById('morph-pct').textContent = `${pct}%`;
  }
  material.uniforms.uMorph.value = state.morph;
  material.uniforms.uTime.value = elapsed;

  // Decay flash attribute on newly uploaded stones
  const flashAttr = geometry.getAttribute('aFlash');
  let flashDirty = false;
  for (let i = 0; i < pointCount; i++) {
    if (flashAttr.array[i] > 0.001) {
      flashAttr.array[i] = Math.max(0, flashAttr.array[i] - dt * 0.65);
      flashDirty = true;
    }
  }
  if (flashDirty) flashAttr.needsUpdate = true;

  // Camera preset lerp
  if (camLerp) {
    camLerp.t = Math.min(1, camLerp.t + dt * 1.45);
    const k = camLerp.t * camLerp.t * (3 - 2 * camLerp.t);
    camera.position.lerpVectors(camLerp.startPos, camLerp.endPos, k);
    controls.target.lerpVectors(camLerp.startTarget, camLerp.endTarget, k);
    if (camLerp.t >= 1) camLerp = null;
  } else if (state.autoOrbit && state.morph > 0.65 && !state.uploadOpen) {
    // Gentle architectural turntable rotation in 3D mode (paused while picking upload spot)
    const angle = dt * 0.14;
    const x = camera.position.x;
    const z = camera.position.z;
    camera.position.x = x * Math.cos(angle) - z * Math.sin(angle);
    camera.position.z = x * Math.sin(angle) + z * Math.cos(angle);
  }

  // Pulse golden target beacon when pinning an upload spot
  if (pinGroup.visible) {
    const s = 1.0 + 0.22 * Math.sin(elapsed * 5.0);
    pinRing.scale.set(s, s, s);
    pinRing.lookAt(camera.position);
  }

  // Fade ground grid out in 2D UMAP mode
  grid.material.opacity = 0.42 * state.morph;

  controls.update();
  updateBranchLabels();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
