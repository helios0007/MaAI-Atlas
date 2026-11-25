// ---------------------------------------------------------------------------
// Citation network (Stage 04 view).
// Bipartite graph: projects (circles, branch colour) <-> sources (squares, size by
// citations). Projects are pulled toward their semantic-map position, so the
// network reads as a second layer on the same map: shared sources sit between branches.
// ---------------------------------------------------------------------------
import { forceSimulation, forceLink, forceManyBody, forceCollide, forceX, forceY } from 'd3-force';

export class CitationNetwork {
  constructor(canvas, tip, meta, { onProject, onSource }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tip = tip;
    this.meta = meta;
    this.onProject = onProject;
    this.onSource = onSource;
    this.view = { k: 1, x: 0, y: 0 };
    this.hover = null;
    this.sim = null;
    this._bind();
  }

  _bind() {
    const c = this.canvas;
    let drag = null;
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * 0.0015);
      const r = c.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      this.view.x = mx - (mx - this.view.x) * f;
      this.view.y = my - (my - this.view.y) * f;
      this.view.k *= f;
      this.draw();
    }, { passive: false });
    c.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y, moved: false }; });
    window.addEventListener('pointerup', (e) => {
      if (drag && !drag.moved && e.target === c) this._click(e);
      drag = null;
    });
    c.addEventListener('pointermove', (e) => {
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.hypot(dx, dy) > 3) drag.moved = true;
        this.view.x = drag.vx + dx;
        this.view.y = drag.vy + dy;
        this.draw();
        return;
      }
      const n = this._pick(e);
      if (n !== this.hover) {
        this.hover = n;
        this.draw();
      }
      if (n) {
        const r = c.getBoundingClientRect();
        this.tip.hidden = false;
        this.tip.style.left = `${e.clientX - r.left + 14}px`;
        this.tip.style.top = `${e.clientY - r.top + 10}px`;
        this.tip.textContent = n.kind === 'p'
          ? `${n.ref.title} · ${this.meta.branches[n.ref.branch_idx].name}`
          : `${n.ref.title} (${n.ref.author}, ${n.ref.year}) · cited by ${n.ref.cited_by.length}`;
      } else {
        this.tip.hidden = true;
      }
    });
    c.addEventListener('pointerleave', () => { this.tip.hidden = true; this.hover = null; this.draw(); });
  }

  _world(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - this.view.x) / this.view.k, y: (e.clientY - r.top - this.view.y) / this.view.k };
  }

  _pick(e) {
    if (!this.nodes) return null;
    const w = this._world(e);
    let best = null, bd = 12 / this.view.k;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - w.x, n.y - w.y) - n.r;
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  _click(e) {
    const n = this._pick(e);
    if (!n) return;
    if (n.kind === 'p') this.onProject(n.ref);
    else this.onSource(n.ref);
  }

  open({ minCites = 3, branch = -1, visibleProjects = null } = {}) {
    const c = this.canvas;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const r = c.parentElement.getBoundingClientRect();
    c.width = r.width * dpr;
    c.height = r.height * dpr;
    c.style.width = `${r.width}px`;
    c.style.height = `${r.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = r.width;
    this.h = r.height;

    const projects = this.meta.projects.filter((p) =>
      (branch < 0 || p.branch_idx === branch) && (!visibleProjects || visibleProjects.has(p.idx)));
    const pset = new Set(projects.map((p) => p.idx));
    const sources = this.meta.sources.filter((s) =>
      s.cited_by.length >= minCites && s.cited_by.some((i) => pset.has(i)));
    const sset = new Set(sources.map((s) => s.idx));

    // map coordinates -> canvas coordinates (map spans about 124 x 76 units)
    const sx = (this.w * 0.86) / 104, sy = (this.h * 0.84) / 66;
    const s = Math.min(sx, sy);
    const toX = (x) => this.w / 2 + x * s;
    const toY = (y) => this.h / 2 - (y - 8) * s;

    const pNodes = projects.filter((p) => p.refs.some((i) => sset.has(i))).map((p) => ({
      kind: 'p', ref: p, r: 3.2, tx: toX(p.xy[0]), ty: toY(p.xy[1]), x: toX(p.xy[0]), y: toY(p.xy[1]),
      color: this.meta.branches[p.branch_idx].color,
    }));
    const byIdx = new Map(pNodes.map((n) => [n.ref.idx, n]));
    const sNodes = sources.map((src) => {
      const citing = src.cited_by.map((i) => byIdx.get(i)).filter(Boolean);
      const mx = citing.reduce((a, n) => a + n.tx, 0) / Math.max(1, citing.length);
      const my = citing.reduce((a, n) => a + n.ty, 0) / Math.max(1, citing.length);
      return { kind: 's', ref: src, r: 2.5 + Math.sqrt(citing.length) * 1.3, tx: mx, ty: my, x: mx, y: my, n: citing.length };
    });
    const sByIdx = new Map(sNodes.map((n) => [n.ref.idx, n]));
    const links = [];
    for (const n of pNodes) for (const si of n.ref.refs) if (sByIdx.has(si)) links.push({ source: n, target: sByIdx.get(si) });

    this.nodes = [...sNodes, ...pNodes];
    this.links = links;
    this.view = { k: 1, x: 0, y: 0 };
    this.stats = { projects: pNodes.length, sources: sNodes.length, links: links.length };

    if (this.sim) this.sim.stop();
    this.sim = forceSimulation(this.nodes)
      .force('link', forceLink(links).distance(26).strength(0.08))
      .force('charge', forceManyBody().strength((n) => (n.kind === 's' ? -40 : -6)))
      .force('collide', forceCollide((n) => n.r + 1.2))
      .force('x', forceX((n) => n.tx).strength((n) => (n.kind === 'p' ? 0.12 : 0.02)))
      .force('y', forceY((n) => n.ty).strength((n) => (n.kind === 'p' ? 0.12 : 0.02)))
      .alphaDecay(0.035)
      .on('tick', () => this.draw());
    return this.stats;
  }

  close() {
    if (this.sim) this.sim.stop();
    this.tip.hidden = true;
  }

  draw() {
    const g = this.ctx;
    if (!this.nodes) return;
    g.save();
    g.clearRect(0, 0, this.w, this.h);
    g.translate(this.view.x, this.view.y);
    g.scale(this.view.k, this.view.k);
    const h = this.hover;
    const linked = new Set();
    if (h) for (const l of this.links) if (l.source === h || l.target === h) { linked.add(l.source); linked.add(l.target); }

    g.lineWidth = 0.6 / this.view.k;
    for (const l of this.links) {
      const on = h && (l.source === h || l.target === h);
      g.strokeStyle = on ? 'rgba(255,224,125,0.85)' : `${l.source.color}1f`;
      if (h && !on) g.strokeStyle = 'rgba(255,255,255,0.025)';
      g.beginPath();
      g.moveTo(l.source.x, l.source.y);
      g.lineTo(l.target.x, l.target.y);
      g.stroke();
    }
    for (const n of this.nodes) {
      const dim = h && !linked.has(n) && n !== h;
      g.globalAlpha = dim ? 0.18 : 1;
      if (n.kind === 'p') {
        g.fillStyle = n.color;
        g.beginPath();
        g.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        g.fill();
      } else {
        g.fillStyle = n === h ? '#ffe07d' : '#e6e9ef';
        g.strokeStyle = '#080a0f';
        g.lineWidth = 0.8 / this.view.k;
        g.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
        g.strokeRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      }
    }
    g.globalAlpha = 1;
    // label the most cited sources
    g.font = `${10.5 / this.view.k}px Inter, system-ui, sans-serif`;
    g.fillStyle = 'rgba(243,245,248,0.85)';
    const top = this.nodes.filter((n) => n.kind === 's').sort((a, b) => b.n - a.n).slice(0, 10);
    for (const n of top) {
      if (h && !linked.has(n) && n !== h) continue;
      const t = n.ref.title.length > 34 ? `${n.ref.title.slice(0, 32)}…` : n.ref.title;
      g.fillText(t, n.x + n.r + 3 / this.view.k, n.y + 3 / this.view.k);
    }
    g.restore();
  }
}
