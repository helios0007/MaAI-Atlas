// Physarum filaments for the cosmic-web map style (runs in a Web Worker, a few seconds per cohort step).
// Model: Jones 2010 agents, as used by Burchett et al. 2020 (MCPM) to trace the cosmic web between galaxies.
// Agents sense the trail ahead, turn toward the strongest trail, move and deposit. Projects are food:
// they emit trail on each step, so the network stays on the data and does not drift into empty space.
// Input:  { key, W, H, cell, x0, y1, projects: [{ x, y, b, w }], colors: [[r,g,b]...], seed }
// Output: { key, W, H, rgba, dust }
//   rgba = soft gas glow (Uint8ClampedArray), dust = Float32Array [x, y, angle, intensity] per particle,
//   sampled from the trail density, angle = local filament direction (for the flow animation)
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// density colour scale, as in rendered cosmological simulations:
// thin gas deep blue, filaments violet, dense knots warm white
const RAMP = [
  [0.00, [10, 22, 70]],
  [0.22, [38, 64, 168]],
  [0.45, [112, 84, 210]],
  [0.68, [214, 120, 190]],
  [0.85, [255, 196, 140]],
  [1.00, [255, 246, 228]],
];
function ramp(t) {
  t = Math.min(1, Math.max(0, t));
  for (let k = 1; k < RAMP.length; k++) {
    if (t <= RAMP[k][0]) {
      const [t0, a] = RAMP[k - 1], [t1, b] = RAMP[k], u = (t - t0) / (t1 - t0);
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

self.onmessage = (e) => {
  const { key, W, H, cell, x0, y1, projects, colors, seed } = e.data;
  const N = W * H;
  const S = W / 340;                       // grid scale relative to the first version
  const gpos = projects.map((p) => [(p.x - x0) / cell, (y1 - p.y) / cell, p.w, p.b]);

  // food field and branch density per cell
  const F = new Float32Array(N), sig = 1.6 * S, win = Math.ceil(sig * 3);
  const nb = colors.length, dens = Array.from({ length: nb }, () => new Float32Array(N));
  const sigO = 7.5 / cell, invO = 1 / (2 * sigO * sigO), winO = Math.ceil(sigO * 3);
  for (const [gx, gy, w, b] of gpos) {
    for (let j = Math.max(0, Math.floor(gy - win)); j < Math.min(H, gy + win); j++)
      for (let i = Math.max(0, Math.floor(gx - win)); i < Math.min(W, gx + win); i++)
        F[j * W + i] += w * Math.exp(-((i - gx) ** 2 + (j - gy) ** 2) / (2 * sig * sig));
    if (b < 0 || b >= nb) continue;
    const d = dens[b];
    for (let j = Math.max(0, Math.floor(gy - winO)); j < Math.min(H, gy + winO); j++)
      for (let i = Math.max(0, Math.floor(gx - winO)); i < Math.min(W, gx + winO); i++)
        d[j * W + i] += Math.exp(-((i - gx) ** 2 + (j - gy) ** 2) * invO);
  }
  // web skeleton: Gabriel graph of the projects (a and b are linked when no other project lies
  // in the circle with diameter ab). It holds the minimum spanning tree and gives the mesh of
  // filaments around empty voids that a cosmic web has. Each link adds a thin line of food,
  // weaker for long links, slightly curved, so the agents grow many filaments and not one ring.
  {
    const P = gpos, n = P.length, rL = mulberry32((seed || 911) * 7 + 3);
    const sigL = 0.9 * S, invL = 1 / (2 * sigL * sigL), wL = Math.ceil(sigL * 3);
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      const mx = (P[a][0] + P[b][0]) / 2, my = (P[a][1] + P[b][1]) / 2;
      const r2 = ((P[a][0] - P[b][0]) ** 2 + (P[a][1] - P[b][1]) ** 2) / 4;
      if (r2 < 0.25) continue;
      let ok = true;
      for (let c = 0; c < n && ok; c++) if (c !== a && c !== b && (P[c][0] - mx) ** 2 + (P[c][1] - my) ** 2 < r2) ok = false;
      if (!ok) continue;
      const len = 2 * Math.sqrt(r2), w = 0.55 * Math.exp(-len / (70 * S)) + 0.08;
      const nx = -(P[b][1] - P[a][1]) / len, ny = (P[b][0] - P[a][0]) / len, bend = (rL() - 0.5) * 0.3 * len;
      const steps = Math.ceil(len / (0.6 * S));
      for (let q = 0; q <= steps; q++) {
        const t = q / steps, bow = 4 * t * (1 - t) * bend;
        const gx = P[a][0] + (P[b][0] - P[a][0]) * t + nx * bow, gy = P[a][1] + (P[b][1] - P[a][1]) * t + ny * bow;
        for (let j = Math.max(0, Math.floor(gy - wL)); j < Math.min(H, gy + wL); j++)
          for (let i = Math.max(0, Math.floor(gx - wL)); i < Math.min(W, gx + wL); i++)
            F[j * W + i] += w * 0.3 * Math.exp(-((i - gx) ** 2 + (j - gy) ** 2) * invL);
      }
    }
  }

  // soft branch tint per cell (density-squared weighted), used only as a light tint
  const tint = new Float32Array(N * 4);
  for (let o = 0; o < N; o++) {
    let r = 0, g = 0, bl = 0, wS = 0;
    for (let b = 0; b < nb; b++) { const d = dens[b][o], w = d * d; wS += w; r += colors[b][0] * w; g += colors[b][1] * w; bl += colors[b][2] * w; }
    if (wS > 1e-9) { tint[o * 4] = r / wS; tint[o * 4 + 1] = g / wS; tint[o * 4 + 2] = bl / wS; tint[o * 4 + 3] = 1; }
  }

  // decay grows with the distance to the nearest project, so trails do not wander off the map
  const decay = new Float32Array(N);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let m = Infinity;
    for (const g of gpos) { const d = (g[0] - i) ** 2 + (g[1] - j) ** 2; if (d < m) m = d; }
    const d = Math.sqrt(m) * cell;
    decay[j * W + i] = d < 10 ? 0.95 : Math.max(0.885, 0.95 - (d - 10) * 0.0025);
  }

  // agents: more of them and a short sensor, so the network is fine and branched
  const rnd = mulberry32(seed || 911), NA = Math.round(26000 * S * S);
  const ax = new Float32Array(NA), ay = new Float32Array(NA), aa = new Float32Array(NA);
  let Tr = new Float32Array(N), T2 = new Float32Array(N);
  const SA = 0.785, RA = 0.785, SO = 6 * S, STEP = 1.0 * S, JIT = 0.05;
  const sense = (x, y) => { const i = x | 0, j = y | 0; if (i < 0 || j < 0 || i >= W || j >= H) return -1; return Tr[j * W + i]; };
  const spawn = (k) => { const g = gpos[Math.floor(rnd() * gpos.length)]; ax[k] = g[0] + (rnd() - 0.5) * 4 * S; ay[k] = g[1] + (rnd() - 0.5) * 4 * S; aa[k] = rnd() * 6.2832; };
  if (gpos.length) for (let k = 0; k < NA; k++) spawn(k);
  const ITER = gpos.length ? 300 : 0;
  for (let it = 0; it < ITER; it++) {
    for (let o = 0; o < N; o++) Tr[o] += F[o] * 2;
    for (let k = 0; k < NA; k++) {
      if (rnd() < 0.004) spawn(k);
      let a = aa[k]; const x = ax[k], y = ay[k];
      const f = sense(x + Math.cos(a) * SO, y + Math.sin(a) * SO);
      const l = sense(x + Math.cos(a - SA) * SO, y + Math.sin(a - SA) * SO);
      const r = sense(x + Math.cos(a + SA) * SO, y + Math.sin(a + SA) * SO);
      if (f >= l && f >= r) { /* keep going */ } else if (f < l && f < r) a += (rnd() < 0.5 ? -1 : 1) * RA; else a += l > r ? -RA : RA;
      a += (rnd() - 0.5) * JIT;   // a little wander: side branches and faint tendrils
      const nx = x + Math.cos(a) * STEP, ny = y + Math.sin(a) * STEP;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) { spawn(k); continue; }
      ax[k] = nx; ay[k] = ny; aa[k] = a; Tr[(ny | 0) * W + (nx | 0)] += 1;
    }
    // 3x3 diffusion with decay (separable: rows then columns)
    for (let j = 0; j < H; j++) {
      const row = j * W;
      for (let i = 0; i < W; i++) T2[row + i] = (Tr[row + Math.max(0, i - 1)] + Tr[row + i] + Tr[row + Math.min(W - 1, i + 1)]) / 3;
    }
    for (let j = 0; j < H; j++) {
      const up = Math.max(0, j - 1) * W, dn = Math.min(H - 1, j + 1) * W, row = j * W;
      for (let i = 0; i < W; i++) Tr[row + i] = ((T2[up + i] + T2[row + i] + T2[dn + i]) / 3) * decay[row + i];
    }
  }

  // soft tone map: 1 - exp(-k * trail / ref)
  const sorted = Float32Array.from(Tr).sort(), ref = sorted[Math.floor(N * 0.997)] || 1;
  const L = new Float32Array(N);
  for (let o = 0; o < N; o++) L[o] = 1 - Math.exp(-1.5 * Tr[o] / ref);

  // gas glow: wide and faint. The crisp structure comes from the dust particles.
  const core = blur(L, W, H, Math.max(1, Math.round(S)), 1), halo = blur(L, W, H, Math.round(5 * S), 3);
  const rgba = new Uint8ClampedArray(N * 4);
  const EDGE = 14 * S;
  const edgeF = (o) => { const i = o % W, j = (o / W) | 0, e = Math.min(1, Math.min(i, W - 1 - i, j, H - 1 - j) / EDGE); return e * e * (3 - 2 * e); };
  const colorAt = (o, v) => {
    const c = ramp(v);
    if (tint[o * 4 + 3]) { const m = 0.22 * (1 - v); for (let q = 0; q < 3; q++) c[q] += (tint[o * 4 + q] - c[q]) * m; }
    return c;
  };
  for (let o = 0; o < N; o++) {
    const k = core[o], h = halo[o];
    const I = Math.min(1, Math.max(0, k * 0.45 + h * 0.4 - 0.015)) * edgeF(o);
    if (I < 0.004) continue;
    const c = colorAt(o, Math.min(1, k * 0.9 + h * 0.3));
    rgba[o * 4] = c[0]; rgba[o * 4 + 1] = c[1]; rgba[o * 4 + 2] = c[2]; rgba[o * 4 + 3] = 255 * Math.pow(I, 0.9);
  }

  // dust: particles sampled from the trail density, aligned with the filament direction (Hessian ridge)
  const sm = blur(L, W, H, Math.max(1, Math.round(1.5 * S)), 2);
  const wgt = new Float32Array(N);
  let wSum = 0;
  for (let o = 0; o < N; o++) { const v = L[o]; const w = v > 0.02 ? Math.pow(v, 0.9) * (1 - 0.6 * F[o] / (F[o] + 0.5)) * edgeF(o) : 0; wSum += w; wgt[o] = wSum; }
  const ND = wSum > 0 ? 70000 : 0;
  const dust = new Float32Array(ND * 4);
  const at = (i, j) => sm[Math.min(H - 1, Math.max(0, j)) * W + Math.min(W - 1, Math.max(0, i))];
  for (let n = 0; n < ND; n++) {
    // binary search in the cumulative weights
    const u = rnd() * wSum;
    let lo = 0, hi = N - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (wgt[mid] < u) lo = mid + 1; else hi = mid; }
    const i = lo % W, j = (lo / W) | 0;
    const hxx = at(i + 1, j) - 2 * at(i, j) + at(i - 1, j);
    const hyy = at(i, j + 1) - 2 * at(i, j) + at(i, j - 1);
    const hxy = (at(i + 1, j + 1) - at(i - 1, j + 1) - at(i + 1, j - 1) + at(i - 1, j - 1)) / 4;
    const th = 0.5 * Math.atan2(2 * hxy, hxx - hyy);   // direction of the larger eigenvalue = along the ridge
    const gx = i + rnd(), gy = j + rnd();
    dust[n * 4] = x0 + gx * cell;
    dust[n * 4 + 1] = y1 - gy * cell;
    dust[n * 4 + 2] = -th;                             // grid rows go down, world y goes up
    dust[n * 4 + 3] = L[lo];
  }
  self.postMessage({ key, W, H, rgba, dust }, [rgba.buffer, dust.buffer]);
};

// separable box blur; 3 passes are close to a gaussian; r in cells
function blur(src, W, H, r, passes) {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let pass = 0; pass < passes; pass++) {
    for (let j = 0; j < H; j++) {
      const row = j * W;
      let s = 0;
      for (let i = -r; i <= r; i++) s += a[row + Math.min(W - 1, Math.max(0, i))];
      for (let i = 0; i < W; i++) {
        b[row + i] = s / n;
        s += a[row + Math.min(W - 1, i + r + 1)] - a[row + Math.max(0, i - r)];
      }
    }
    for (let i = 0; i < W; i++) {
      let s = 0;
      for (let j = -r; j <= r; j++) s += b[Math.min(H - 1, Math.max(0, j)) * W + i];
      for (let j = 0; j < H; j++) {
        a[j * W + i] = s / n;
        s += b[Math.min(H - 1, j + r + 1) * W + i] - b[Math.max(0, j - r) * W + i];
      }
    }
  }
  return a;
}
