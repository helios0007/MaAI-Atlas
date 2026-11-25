// ---------------------------------------------------------------------------
// In-browser semantic search (Stage 09).
// Rebuilds the pipeline's TF-IDF -> LSA projection for any text, so queries and
// new uploads land in the same vector space as the map. No server, no model download.
// Mirrors sklearn's TfidfVectorizer(stop_words='english', ngram_range=(1,2),
// sublinear_tf=True, norm='l2') followed by TruncatedSVD and L2 normalisation.
// ---------------------------------------------------------------------------

export class SemanticSearch {
  constructor(index, vectorBuffer, nProjects) {
    this.dim = index.dim;
    this.V = index.vocab.length;
    this.col = new Map(index.vocab.map((t, i) => [t, i]));
    this.idf = Float32Array.from(index.idf);
    this.stop = new Set(index.stop_words);
    this.nProjects = nProjects;
    const all = new Float32Array(vectorBuffer);
    this.components = all.subarray(0, this.dim * this.V); // dim x V, row-major
    this.projectVecs = all.subarray(this.dim * this.V, this.dim * this.V + nProjects * this.dim);
    this.extra = []; // vectors of projects added in this browser
  }

  static async load(meta) {
    const [index, buf] = await Promise.all([
      fetch(meta.search.index).then((r) => r.json()),
      fetch(meta.search.vectors).then((r) => r.arrayBuffer()),
    ]);
    return new SemanticSearch(index, buf, meta.search.n_projects);
  }

  terms(text) {
    const toks = (text.toLowerCase().match(/[\p{L}\p{N}_]{2,}/gu) || []).filter((t) => !this.stop.has(t));
    const out = [...toks];
    for (let i = 0; i < toks.length - 1; i++) out.push(`${toks[i]} ${toks[i + 1]}`);
    return out;
  }

  /** Text -> unit vector in LSA space, or null when no term is in the vocabulary. */
  embed(text) {
    const tf = new Map();
    for (const t of this.terms(text)) {
      const j = this.col.get(t);
      if (j !== undefined) tf.set(j, (tf.get(j) || 0) + 1);
    }
    if (!tf.size) return null;
    let norm = 0;
    const w = [];
    for (const [j, c] of tf) {
      const v = (1 + Math.log(c)) * this.idf[j];
      w.push([j, v]);
      norm += v * v;
    }
    norm = Math.sqrt(norm);
    const q = new Float32Array(this.dim);
    for (let d = 0; d < this.dim; d++) {
      const row = d * this.V;
      let s = 0;
      for (const [j, v] of w) s += v * this.components[row + j];
      q[d] = s / norm;
    }
    let qn = 0;
    for (let d = 0; d < this.dim; d++) qn += q[d] * q[d];
    qn = Math.sqrt(qn) || 1;
    for (let d = 0; d < this.dim; d++) q[d] /= qn;
    return q;
  }

  vectorOf(idx) {
    if (idx < this.nProjects) return this.projectVecs.subarray(idx * this.dim, (idx + 1) * this.dim);
    return this.extra[idx - this.nProjects] || null;
  }

  cosine(q, idx) {
    const v = this.vectorOf(idx);
    if (!v) return 0;
    let s = 0;
    for (let d = 0; d < this.dim; d++) s += q[d] * v[d];
    return s;
  }

  addProjectVector(q) {
    this.extra.push(q || new Float32Array(this.dim));
  }

  /**
   * Rank projects for a query. Score = cosine in LSA space plus a small bonus
   * for exact word hits in title / methods / data, so acronyms like "PINN" still match.
   */
  search(text, projects, k = 10) {
    const q = this.embed(text);
    const words = (text.toLowerCase().match(/[\p{L}\p{N}+]{2,}/gu) || []).filter((t) => !this.stop.has(t));
    const res = [];
    for (const p of projects) {
      let s = q ? this.cosine(q, p.idx) : 0;
      if (words.length) {
        if (!p._words) {
          const hay = `${p.title} ${p.methods.join(' ')} ${p.data.join(' ')} ${p.domains.join(' ')} ${(p.tags || []).join(' ')}`;
          p._words = new Set(hay.toLowerCase().match(/[\p{L}\p{N}+]{2,}/gu) || []);
        }
        const hits = words.filter((w) => p._words.has(w)).length;
        s += 0.18 * (hits / words.length);
      }
      if (s > 0.05) res.push({ p, score: s });
    }
    res.sort((a, b) => b.score - a.score);
    return { results: res.slice(0, k), all: res, embedded: !!q };
  }
}
