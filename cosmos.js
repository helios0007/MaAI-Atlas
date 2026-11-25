// Map style for the 2D semantic map: projects as galaxies on a cosmic web.
// Every effect shows real data:
//   galaxy        = one project (its points); size grows with the repo score (0-6)
//   star colour   = cohort (old = warm red, new = hot blue), set in the app.js shader
//   filaments, corridors, voids, field = stage 08b structure analysis (pipeline/structure.py)
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';


function mulberry32(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (rnd) => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());

// Re-shape each project's flat disc of points into a small galaxy.
// Writes A.posC (xyz) and A.star (core 0-1, seed 0-1). The galaxy centre is the project's map position,
// so search, picking and branches stay where they were.
export function layoutGalaxies(A, count, projects) {
  if (!A.posC) { A.posC = new Float32Array(count * 3); A.star = new Float32Array(count * 2); }
  const nP = projects.length + 64;
  const sx = new Float64Array(nP), sy = new Float64Array(nP), n = new Float64Array(nP);
  for (let i = 0; i < count; i++) {
    if (A.built[i] < 0.5) continue;
    const k = Math.round(A.proj[i]);
    if (k < 0 || k >= nP) continue;
    sx[k] += A.posU[i * 3]; sy[k] += A.posU[i * 3 + 1]; n[k] += 1;
  }
  const gal = [];
  for (let k = 0; k < nP; k++) {
    const r = mulberry32(9001 + k * 7919);
    const score = projects[k]?.repo?.score ?? projects[k]?.signals?.filter?.(([, ok]) => ok).length ?? 2;
    gal.push({
      cx: n[k] ? sx[k] / n[k] : 0, cy: n[k] ? sy[k] / n[k] : 0,
      h: 0.6 * (0.8 + 0.12 * score),            // scale length: better repo = larger galaxy
      phi: r() * Math.PI * 2,                    // orientation on the sky
      q: 0.35 + 0.65 * r(),                      // tilt (1 = face-on)
      spiral: r() > 0.3,                         // 70 % spirals, 30 % ellipticals
      twist: 2.0 + r() * 1.6,
    });
  }
  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const rnd = mulberry32(4242 + i * 2654435761);  // one stream per point: adding a project moves no other star
    const seed = rnd();
    if (A.built[i] < 0.5 || A.proj[i] < 0) {
      A.posC[i3] = A.posU[i3]; A.posC[i3 + 1] = A.posU[i3 + 1]; A.posC[i3 + 2] = A.posU[i3 + 2];
      A.star[i * 2] = 0; A.star[i * 2 + 1] = seed;
      continue;
    }
    const g = gal[Math.round(A.proj[i])];
    const u = Math.min(0.985, rnd());
    const rad = -g.h * Math.log(1 - u);         // exponential disc: dense core, thin halo
    let th;
    if (g.spiral && rnd() > 0.28) {
      const arm = rnd() > 0.5 ? Math.PI : 0;
      th = arm + (rad / g.h) * g.twist * 0.55 + gauss(rnd) * (0.28 + 0.25 / (1 + rad / g.h));
    } else {
      th = rnd() * Math.PI * 2;
    }
    const lx = rad * Math.cos(th), ly = rad * Math.sin(th) * g.q;
    const c = Math.cos(g.phi), s = Math.sin(g.phi);
    A.posC[i3] = g.cx + lx * c - ly * s;
    A.posC[i3 + 1] = g.cy + lx * s + ly * c;
    A.posC[i3 + 2] = A.posU[i3 + 2] * 0.5;
    A.star[i * 2] = Math.exp(-rad / (0.55 * g.h));
    A.star[i * 2 + 1] = seed;
  }
}


// ---------------------------------------------------------------------------
// Cosmic web: filaments, corridors, voids and the structure field (stage 08b data)
//   filaments  = Physarum trail network between projects (cosmicweb-worker.js)
//   corridors  = MST paths in 64D between branch cores, with bootstrap support
//   voids      = largest empty Delaunay circles, checked in 64D
//   field      = Hessian class of the 2D density (node / filament), off by default
// Corridors go through real projects, so they move with the points from the map into the basilica.
// ---------------------------------------------------------------------------
const hexRGB = (h) => { const c = new THREE.Color(h); return [Math.round(c.r * 255), Math.round(c.g * 255), Math.round(c.b * 255)]; };
const mixRGB = (a, b, t) => a.map((v, k) => Math.round(v + (b[k] - v) * t));

function convexHull(pts) {
  const a = [...pts].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lo = [], up = [];
  for (const p of a) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of a.reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

const GRID_W = 560, VOID_W = 1800, PAD = 14;

export class Cosmos {
  // opts: { morphProject(idx, g, out), onVoid(v), onCorridor(c), onProject(idx), layer (HTMLElement) }
  constructor(scene, meta, opts) {
    this.meta = meta; this.opts = opts;
    this.S = meta.structure || null;
    this.layers = { trails: true, corridors: true, voids: true, field: false };
    this.group = new THREE.Group();
    scene.add(this.group);
    this.col = meta.branches.map((b) => hexRGB(b.color));
    const ps = meta.projects.filter((p) => p.xy);
    const xs = ps.map((p) => p.xy[0]), ys = ps.map((p) => p.xy[1]);
    this.B = { x0: Math.min(...xs) - PAD, x1: Math.max(...xs) + PAD, y0: Math.min(...ys) - PAD, y1: Math.max(...ys) + PAD };
    const B = this.B, bw = B.x1 - B.x0, bh = B.y1 - B.y0;
    this.cell = bw / GRID_W;
    this.gridH = Math.round(GRID_W * bh / bw);

    const plane = (z, order, blending) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh),
        new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, opacity: 0, blending }));
      m.position.set((B.x0 + B.x1) / 2, (B.y0 + B.y1) / 2, z);
      m.renderOrder = order; m.visible = false;
      this.group.add(m);
      return m;
    };
    this.trailMesh = plane(-2.4, -3, THREE.AdditiveBlending);
    this.fieldMesh = plane(-2.2, -2, THREE.AdditiveBlending);
    this.voidMesh = plane(-2.0, -1, THREE.NormalBlending);

    // void canvas (fill + rings), drawn again when the cohort step changes
    this.voidCanvas = document.createElement('canvas');
    this.voidCanvas.width = VOID_W; this.voidCanvas.height = Math.round(VOID_W * bh / bw);
    this.voidTex = new THREE.CanvasTexture(this.voidCanvas);
    this.voidTex.colorSpace = THREE.SRGBColorSpace;
    this.voidMesh.material.map = this.voidTex;
    if (this.S) this.fieldMesh.material.map = this.fieldTexture();

    // trails come from a worker, one result per cohort step
    this.trailTex = {};
    this.dustGeo = {};
    this.pending = new Set();
    this.dust = this.makeDust();
    this.stars = this.makeStars();
    this.t0 = performance.now();
    // focus mode: -1 = all layers, 0 galaxies, 1 filaments, 2 bridges, 3 voids. fw = eased weights.
    this.focus = -1; this.fw = [1, 1, 1, 1];
    try {
      this.worker = new Worker(new URL('./cosmicweb-worker.js', import.meta.url));
      this.worker.onmessage = (e) => this.onTrails(e.data);
    } catch (err) { console.warn('Cosmic web worker unavailable', err); this.worker = null; }

    this.layer = opts.layer;
    this.lines = []; this.els = [];
    this.trailFade = 0;
    this.step = -1;
    this.tmp = [0, 0, 0];
    this.resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
  }

  // ---------- data for one cohort step ----------
  stepFor(maxCohort) {
    const T = this.S?.timeline || [];
    let k = T.length - 1;
    for (let i = 0; i < T.length; i++) if (T[i].upto >= maxCohort) { k = i; break; }
    return Math.max(0, k);
  }

  setCohort(maxCohort) {
    if (!this.S) return;
    const k = this.stepFor(maxCohort);
    if (k === this.step) return;
    this.step = k;
    const T = this.S.timeline, last = k === T.length - 1, t = T[k];
    this.upto = t.upto;
    this.label = t.label;
    this.corridors = last ? this.S.corridors : t.corridors;
    this.voids = last ? this.S.voids : t.voids;
    this.drawVoids();
    this.buildCorridors();
    this.buildLabels();
    this.requestTrails(k);
  }

  setLayers(l) { Object.assign(this.layers, l); }

  requestTrails(k) {
    if (this.trailTex[k]) { this.trailMesh.material.map = this.trailTex[k]; this.trailMesh.material.needsUpdate = true; this.dust.geometry = this.dustGeo[k]; return; }
    this.trailMesh.material.map = null;
    this.dust.visible = false;
    this.trailFade = 0;
    if (!this.worker || this.pending.has(k)) return;
    this.pending.add(k);
    const roles = this.S.roles, upto = this.S.timeline[k].upto;
    const projects = this.meta.projects.filter((p) => p.xy && p.cohort_idx <= upto && !p.local)
      .map((p) => ({ x: p.xy[0], y: p.xy[1], b: p.branch_idx, w: roles[p.idx] === 'node' ? 1.4 : 1 }));
    this.worker.postMessage({ key: k, W: GRID_W, H: this.gridH, cell: this.cell, x0: this.B.x0, y1: this.B.y1, projects, colors: this.col, seed: 911 + k });
  }

  onTrails({ key, W, H, rgba, dust }) {
    this.pending.delete(key);
    this.dustGeo[key] = this.dustGeometry(dust);
    if (key === this.step) this.dust.geometry = this.dustGeo[key];
    // worker rows start at the top; texture rows start at the bottom
    const flip = new Uint8Array(W * H * 4);
    for (let j = 0; j < H; j++) flip.set(rgba.subarray((H - 1 - j) * W * 4, (H - j) * W * 4), j * W * 4);
    const tex = new THREE.DataTexture(flip, W, H, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    this.trailTex[key] = tex;
    if (key === this.step) { this.trailMesh.material.map = tex; this.trailMesh.material.needsUpdate = true; }
  }

  // Filament dust: many small particles on the Physarum trail. Each one drifts slowly along the
  // local filament direction and fades in and out, so matter seems to flow along the web.
  makeDust() {
    const mat = new THREE.ShaderMaterial({
      transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uScale: { value: 1 }, uFlow: { value: 2.4 } },
      vertexShader: `
        attribute vec4 aDust;           // angle, intensity, phase, speed
        uniform float uTime, uScale, uFlow;
        varying float vI; varying float vA;
        void main() {
          float ph = fract(aDust.z + uTime * aDust.w);
          vec2 dir = vec2(cos(aDust.x), sin(aDust.x));
          vec3 p = position + vec3(dir * (ph - 0.5) * uFlow, 0.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          vI = aDust.y;
          float life = sin(3.14159 * ph);                        // fade in and out along the path
          float tw = 0.75 + 0.25 * sin(uTime * (0.8 + aDust.w * 9.0) + aDust.z * 40.0);
          vA = life * tw;
          gl_PointSize = (0.8 + 1.8 * vI * vI) * uScale / -mv.z;
        }`,
      fragmentShader: `
        uniform float uAlpha;
        varying float vI; varying float vA;
        vec3 ramp(float t) {
          vec3 a = vec3(0.16, 0.26, 0.70), b = vec3(0.50, 0.40, 0.92), c = vec3(0.95, 0.60, 0.82), d = vec3(1.0, 0.93, 0.84);
          return t < 0.4 ? mix(a, b, t / 0.4) : t < 0.75 ? mix(b, c, (t - 0.4) / 0.35) : mix(c, d, (t - 0.75) / 0.25);
        }
        void main() {
          vec2 q = gl_PointCoord - 0.5;
          float r = length(q) * 2.0;
          float disc = exp(-r * r * 4.0);
          if (disc < 0.01) discard;
          float a = disc * vA * uAlpha * (0.3 + 0.5 * vI);
          gl_FragColor = vec4(ramp(vI) * a, a);
        }`,
    });
    const pts = new THREE.Points(new THREE.BufferGeometry(), mat);
    pts.position.z = -2.3; pts.renderOrder = -2; pts.frustumCulled = false; pts.visible = false;
    this.group.add(pts);
    return pts;
  }

  // Background: faint field stars far behind the map, for depth only (they carry no data).
  makeStars() {
    const n = 7000, r = mulberry32(2024), B = this.B, cx = (B.x0 + B.x1) / 2, cy = (B.y0 + B.y1) / 2;
    const w = (B.x1 - B.x0) * 2.6, h = (B.y1 - B.y0) * 2.6;
    const pos = new Float32Array(n * 3), att = new Float32Array(n * 2);
    for (let k = 0; k < n; k++) {
      pos[k * 3] = cx + (r() - 0.5) * w; pos[k * 3 + 1] = cy + (r() - 0.5) * h; pos[k * 3 + 2] = -40 - r() * 60;
      att[k * 2] = Math.pow(r(), 6); att[k * 2 + 1] = r();     // most stars very faint, a few bright
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aStar', new THREE.BufferAttribute(att, 2));
    const mat = new THREE.ShaderMaterial({
      transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uScale: { value: 1 } },
      vertexShader: `
        attribute vec2 aStar; uniform float uTime, uScale; varying float vA;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          vA = (0.15 + 0.85 * aStar.x) * (0.7 + 0.3 * sin(uTime * (0.4 + aStar.y * 1.5) + aStar.y * 90.0));
          gl_PointSize = (0.9 + 1.6 * aStar.x) * uScale / 80.0;
        }`,
      fragmentShader: `
        uniform float uAlpha; varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5) * 2.0;
          float a = exp(-r * r * 5.0) * vA * uAlpha;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vec3(0.78, 0.84, 1.0) * a, a);
        }`,
    });
    const pts = new THREE.Points(g, mat);
    pts.renderOrder = -5; pts.frustumCulled = false;
    this.group.add(pts);
    return pts;
  }

  dustGeometry(dust) {
    const n = dust.length / 4, pos = new Float32Array(n * 3), att = new Float32Array(n * 4);
    const r = mulberry32(77);
    for (let k = 0; k < n; k++) {
      pos[k * 3] = dust[k * 4]; pos[k * 3 + 1] = dust[k * 4 + 1]; pos[k * 3 + 2] = 0;
      att[k * 4] = dust[k * 4 + 2] + (r() < 0.5 ? Math.PI : 0);   // both directions along the filament
      att[k * 4 + 1] = dust[k * 4 + 3];
      att[k * 4 + 2] = r();
      att[k * 4 + 3] = 0.03 + r() * 0.06;                          // slow: one path every 11 to 33 s
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aDust', new THREE.BufferAttribute(att, 4));
    return g;
  }

  fieldTexture() {
    const f = this.S.field, cv = document.createElement('canvas');
    cv.width = f.w; cv.height = f.h;
    const g = cv.getContext('2d'), img = g.createImageData(f.w, f.h);
    const COL = { n: [255, 214, 150, 150], f: [120, 170, 255, 120] };
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) {
      const c = COL[f.cls[j * f.w + i]];
      if (c) img.data.set(c, ((f.h - 1 - j) * f.w + i) * 4);
    }
    g.putImageData(img, 0, 0);
    // the field grid has its own extent: draw it into the map bounds
    const out = document.createElement('canvas'), B = this.B;
    out.width = 660; out.height = Math.round(660 * (B.y1 - B.y0) / (B.x1 - B.x0));
    const o = out.getContext('2d'), s = out.width / (B.x1 - B.x0);
    o.filter = 'blur(2px)';
    o.drawImage(cv, (f.x0 - B.x0) * s, (B.y1 - (f.y0 + f.h * f.dy)) * s, f.w * f.dx * s, f.h * f.dy * s);
    const tex = new THREE.CanvasTexture(out);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  drawVoids() {
    const cv = this.voidCanvas, g = cv.getContext('2d'), B = this.B, s = cv.width / (B.x1 - B.x0);
    const X = (x) => (x - B.x0) * s, Y = (y) => (B.y1 - y) * s;
    g.clearRect(0, 0, cv.width, cv.height);
    const H = convexHull(this.meta.projects.filter((p) => p.xy && p.cohort_idx <= this.upto && !p.local).map((p) => p.xy));
    g.save();
    g.beginPath(); H.forEach(([x, y], q) => (q ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)))); g.closePath(); g.clip();
    g.beginPath();
    for (const v of this.voids) for (const [x, y, r] of v.circles) { g.moveTo(X(x) + r * s, Y(y)); g.arc(X(x), Y(y), r * s, 0, Math.PI * 2); }
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fill('nonzero');
    for (const v of this.voids) {
      const ok = v.status === 'robust';
      g.beginPath(); g.arc(X(v.xy[0]), Y(v.xy[1]), v.radius * s, 0, Math.PI * 2);
      g.strokeStyle = ok ? 'rgba(250,204,21,0.8)' : 'rgba(160,168,184,0.5)';
      g.lineWidth = ok ? 2.6 : 2; g.setLineDash(ok ? [] : [5, 9]); g.stroke(); g.setLineDash([]);
    }
    g.restore();
    this.voidTex.needsUpdate = true;
  }

  buildCorridors() {
    for (const l of this.lines) { this.group.remove(l.glow, l.core); l.glow.geometry.dispose(); l.core.geometry.dispose(); }
    this.lines = this.corridors.map((c) => {
      const strong = c.status === 'robust';
      const mk = (width) => {
        const mat = new LineMaterial({ vertexColors: true, linewidth: width, transparent: true, opacity: 0, depthTest: false, depthWrite: false, dashed: !strong && width < 3, dashSize: 1.2, gapSize: 1.2 });
        const line = new Line2(new LineGeometry(), mat);
        line.renderOrder = 2; line.frustumCulled = false;
        this.group.add(line);
        return line;
      };
      const a = this.col[c.branches[0]], b = this.col[c.branches[1]];
      return { c, glow: mk(5), core: mk(strong ? 1.1 : 0.8), a: mixRGB(a, [255, 255, 255], 0.35), b: mixRGB(b, [255, 255, 255], 0.35), base: [0.07, strong ? 0.5 : 0.35], key: '' };
    });
  }

  buildLabels() {
    this.layer.innerHTML = '';
    const mkBtn = (cls, text, title, fn) => {
      const el = document.createElement('button');
      el.className = 'web-el ' + cls; el.textContent = text; el.title = title; el.setAttribute('aria-label', title);
      el.addEventListener('click', fn);
      this.layer.appendChild(el);
      return el;
    };
    const bn = (i) => this.meta.branches[i].name.replace('Fabrication & Materials: ', '');
    this.els = [];
    this.voids.forEach((v) => {
      const ok = v.status === 'robust', pct = Math.round(v.support * 100);
      const text = ok ? 'Void' + (v.gap ? ' · ' + v.gap : '') + ' · ' + pct + '%' : '';
      const title = ok ? 'Void: empty in the 64D embedding too. Support ' + pct + '% over 40 bootstrap runs.'
        : 'Void on the map only. The 64D embedding does not confirm it. Support ' + pct + '%.';
      this.els.push({ kind: 'void', v, el: mkBtn(ok ? 'web-void' : 'web-void weak', text, title, () => this.opts.onVoid(v)) });
    });
    this.lines.forEach((L) => {
      const c = L.c, pct = Math.round(c.support * 100);
      this.els.push({ kind: 'cor', L, el: mkBtn('web-cor', pct + '%', 'Corridor ' + bn(c.branches[0]) + ' ↔ ' + bn(c.branches[1]) + '. Support ' + pct + '%.', () => this.opts.onCorridor(c)) });
      for (const i of c.bridge || []) {
        if (this.meta.projects[i].cohort_idx > this.upto) continue;
        this.els.push({ kind: 'bridge', i, el: mkBtn('web-bridge', '', 'Bridge project: ' + this.meta.projects[i].title, () => this.opts.onProject(i)) });
      }
    });
  }

  // ---------- per frame ----------
  setFocus(k) { this.focus = k == null || k < 0 ? -1 : Number(k); }

  // space = amount of the style in the 2D map (0-1), cos = style on (0-1), g = global morph 0-1
  update({ space, cos, g, toScreen }) {
    const DIM = 0.1;
    for (let i = 0; i < 4; i++) {
      const want = this.focus < 0 || this.focus === i ? 1 : DIM;
      this.fw[i] += (want - this.fw[i]) * 0.12;
    }
    const [, wF, wB, wV] = this.fw;
    const on = cos > 0.005 && !!this.S;
    this.group.visible = on;
    this.layer.style.display = on && space > 0.02 ? '' : 'none';
    if (!on) return;
    const L = this.layers;
    if (this.trailMesh.material.map && this.trailFade < 1) this.trailFade = Math.min(1, this.trailFade + 0.04);
    const set = (m, vis, a) => { m.visible = vis && a > 0.004; m.material.opacity = a; };
    set(this.trailMesh, L.trails && !!this.trailMesh.material.map, 0.62 * space * this.trailFade * wF);
    const du = this.dust.material.uniforms;
    du.uTime.value = (performance.now() - this.t0) / 1000;
    du.uAlpha.value = 0.95 * space * this.trailFade * wF;
    du.uScale.value = this.resolution.y * 0.12 * Math.min(2, window.devicePixelRatio || 1);
    const su = this.stars.material.uniforms;
    su.uTime.value = du.uTime.value; su.uScale.value = du.uScale.value; su.uAlpha.value = 0.4 * space;
    this.stars.visible = su.uAlpha.value > 0.004;
    this.dust.visible = L.trails && !!this.dust.geometry.attributes.position && du.uAlpha.value > 0.004;
    set(this.fieldMesh, L.field, 0.6 * space);
    set(this.voidMesh, L.voids, space * wV);

    // corridors move with their projects and stay as faint threads in the basilica
    // visible while the points travel, gone before the basilica is complete
    const tq = Math.min(1, Math.max(0, (g - 0.5) / 0.4)), lineA = cos * (1 - tq * tq * (3 - 2 * tq));
    for (const ln of this.lines) {
      const vis = L.corridors && lineA > 0.01;
      ln.glow.visible = ln.core.visible = vis;
      if (!vis) continue;
      const key = g.toFixed(4);
      if (ln.key !== key) {
        ln.key = key;
        const pts = ln.c.path.map((i) => new THREE.Vector3(...this.opts.morphProject(i, g, [0, 0, 0])));
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        const n = Math.max(24, pts.length * 10), P = [], C = [];
        for (let q = 0; q <= n; q++) {
          const p = curve.getPoint(q / n), t = q / n;
          P.push(p.x, p.y, p.z + 0.3);
          for (let k = 0; k < 3; k++) C.push((ln.a[k] + (ln.b[k] - ln.a[k]) * t) / 255);
        }
        for (const line of [ln.glow, ln.core]) { line.geometry.setPositions(P); line.geometry.setColors(C); if (line.material.dashed) line.computeLineDistances(); }
      }
      // a focused bridge is drawn brighter than normal, so it stands out on the dimmed web
      const lw = wB * (this.focus === 2 ? 1.8 : 1);
      ln.glow.material.opacity = Math.min(1, ln.base[0] * lineA * lw);
      ln.core.material.opacity = Math.min(1, ln.base[1] * lineA * lw);
      ln.glow.material.resolution.copy(this.resolution);
      ln.core.material.resolution.copy(this.resolution);
    }

    // HTML labels: 2D only
    if (space <= 0.02) return;
    for (const it of this.els) {
      let s, show;
      if (it.kind === 'void') { show = L.voids; s = toScreen(it.v.xy[0], it.v.xy[1], 0); }
      else if (it.kind === 'cor') {
        show = L.corridors;
        const br = it.L.c.bridge || it.L.c.path, a = this.meta.projects[br[0]].xy, b = this.meta.projects[br.at(-1)].xy;
        s = toScreen((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); s.y += 14;
      } else { show = L.corridors; const p = this.opts.morphProject(it.i, g, this.tmp); s = toScreen(p[0], p[1], p[2]); }
      it.el.style.opacity = show ? (space * (it.kind === 'void' ? wV : wB)).toFixed(2) : '0';
      it.el.style.pointerEvents = show && space > 0.5 ? 'auto' : 'none';
      it.el.style.transform = 'translate(' + s.x.toFixed(1) + 'px, ' + s.y.toFixed(1) + 'px) translate(-50%, -50%)';
    }
  }

  setSize(w, h) { this.resolution.set(w, h); }
}
