"""
Stages 04-10 of the MaAI Atlas pipeline.

    04 cite      parse raw references, de-duplicate into a shared bibliography
    05 repos     reproducibility rubric and stack summary
    06 embed     TF-IDF + truncated SVD (LSA) project vectors
    07 layout    UMAP 2D map, HDBSCAN branches, c-TF-IDF naming, stability check
    08 gaps      density holes, untested method x domain cells, external coverage, fading branches
    09 search    export the vector space so the browser can embed queries
    10 publish   allocate basilica points from documented rules, write web files

Run through pipeline/run.py.
"""

from __future__ import annotations

import csv
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

from . import taxonomy as tx
from .basilica_geometry import FRONTIER_ZONE, ZONES
from .repos import RUBRIC, score as repo_score, summarize as repo_summary
from .structure import stage_structure, structure_report

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CURATED = DATA / "curated"
REPORTS = ROOT / "reports"

BRANCH_COLORS = ["#2DD4BF", "#FB923C", "#A3E635", "#A78BFA", "#38BDF8", "#F472B6", "#F87171", "#FDE68A", "#60A5FA", "#E879F9"]
FRONTIER_COLOR = "#FACC15"

# Gap weights in "project equivalents": how much unbuilt scaffold each gap adds to its zone.
GAP_WEIGHT = {"density": 4.0, "untested": 1.5, "external": 0.5, "fading": 3.0}


def log(msg: str) -> None:
    print(f"  {msg}")


# ---------------------------------------------------------------------------
# 04 Citations
# ---------------------------------------------------------------------------
STOP = {"a", "an", "the", "of", "for", "and", "in", "on", "with", "to", "from", "using", "via", "et", "al", "by", "is", "are", "all"}


def _norm_tokens(s: str) -> set[str]:
    s = s.lower().replace("++", "pp")
    toks = re.findall(r"[a-z0-9]+", s)
    return {t for t in toks if t not in STOP and not re.fullmatch(r"(19|20)\d\d", t) and len(t) > 1}


def parse_reference(raw: str) -> dict:
    """Best-effort split of a free-form reference into author, year, title, venue.
    Real theses go through GROBID instead; this handles blog and synthetic styles."""
    year_m = re.search(r"\b(19|20)\d{2}\b", raw)
    year = int(year_m.group(0)) if year_m else None
    author = re.split(r",| et al| \(|\s\d{4}", raw.strip(), maxsplit=1)[0].strip().title()
    title, venue, quality = None, None, 0
    if m := re.search(r"\(\d{4}\)\.\s*(.+?)\.\s+(.+?)\.?$", raw):
        title, venue, quality = m.group(1), m.group(2), 3
    elif m := re.search(r"\b\d{4}\.\s*(.+?)\.\s*In:\s*(.+)$", raw):
        title, venue, quality = m.group(1), m.group(2), 3
    elif m := re.search(r'"(.+?)"', raw):
        title, quality = m.group(1), 1
    else:
        parts = [p.strip() for p in raw.split(",")]
        if len(parts) >= 4:
            title, venue, quality = ", ".join(parts[1:-2]), parts[-2], 2
        else:
            title, quality = raw, 0
    return {"author": author, "year": year, "title": title.strip(), "venue": venue, "quality": quality}


def stage_cite(projects: list[dict]) -> list[dict]:
    sources: list[dict] = []
    by_year: dict[int | None, list[int]] = defaultdict(list)
    n_raw = 0
    for p_i, p in enumerate(projects):
        p["references"] = []
        for raw in p.get("raw_references", []):
            n_raw += 1
            ref = parse_reference(raw)
            toks = _norm_tokens(raw)
            match = None
            for s_i in by_year[ref["year"]]:
                s = sources[s_i]
                overlap = len(toks & s["_tokens"]) / max(1, min(len(toks), len(s["_tokens"])))
                if overlap >= 0.8:
                    match = s_i
                    break
            if match is None:
                match = len(sources)
                sources.append({**ref, "_tokens": toks, "variants": [], "cited_by": []})
                by_year[ref["year"]].append(match)
            s = sources[match]
            if raw not in s["variants"]:
                s["variants"].append(raw)
            if ref["quality"] > s["quality"]:  # keep the cleanest rendering as canonical
                s.update({k: ref[k] for k in ("author", "title", "venue", "quality")})
            if p_i not in s["cited_by"]:
                s["cited_by"].append(p_i)
                p["references"].append(match)
    for i, s in enumerate(sources):
        s["id"] = f"src-{i:04d}"
        s.pop("_tokens")
    log(f"04 cite: {n_raw} raw references -> {len(sources)} unique sources "
        f"({n_raw - sum(len(s['cited_by']) for s in sources)} duplicates within projects removed)")
    return sources


def bibtex(sources: list[dict]) -> str:
    out = []
    for s in sources:
        key = re.sub(r"[^A-Za-z]", "", s["author"] or "anon") + str(s["year"] or "")
        key += "".join(w[0] for w in re.findall(r"[A-Za-z]+", s["title"])[:3]).lower()
        fields = [f"  title = {{{s['title']}}}", f"  author = {{{s['author']}}}"]
        if s["year"]:
            fields.append(f"  year = {{{s['year']}}}")
        if s["venue"]:
            fields.append(f"  howpublished = {{{s['venue']}}}")
        fields.append(f"  note = {{Cited by {len(s['cited_by'])} MaAI projects; atlas id {s['id']}}}")
        out.append("@misc{" + key + ",\n" + ",\n".join(fields) + "\n}")
    return "\n\n".join(out) + "\n"


# ---------------------------------------------------------------------------
# 05 Repositories
# ---------------------------------------------------------------------------
def stage_repos(projects: list[dict]) -> None:
    n = 0
    for p in projects:
        if p.get("repo") and p["repo"].get("signals") is not None:
            p["repo"]["score"] = repo_score(p["repo"]["signals"])
            p["repo"]["summary"] = repo_summary(p)
            n += 1
    scores = [p["repo"]["score"] for p in projects if p.get("repo") and "score" in p["repo"]]
    log(f"05 repos: {n}/{len(projects)} projects have a scored repo, mean rubric {np.mean(scores):.1f}/6" if scores else "05 repos: none")


# ---------------------------------------------------------------------------
# 06 Embeddings
# ---------------------------------------------------------------------------
def project_text(p: dict) -> str:
    meta = " ".join(
        [tx.method_label(m) for m in p.get("methods", [])]
        + [tx.data_label(d) for d in p.get("data", [])]
        + [tx.domain_label(d) for d in p.get("domains", [])]
    )
    return f"{p['title']}. {p.get('abstract', '')} {meta}"


def stage_embed(projects: list[dict], external: list[dict], dim: int = 64):
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.preprocessing import normalize

    texts = [project_text(p) for p in projects]
    ext_texts = [e["text"] for e in external]
    vec = TfidfVectorizer(stop_words="english", sublinear_tf=True, ngram_range=(1, 2), min_df=2, max_df=0.6,
                          token_pattern=r"(?u)\b\w\w+\b", lowercase=True)
    X_all = vec.fit_transform(texts + ext_texts)
    dim = min(dim, X_all.shape[1] - 1)
    svd = TruncatedSVD(n_components=dim, random_state=0)
    Z_all = normalize(svd.fit_transform(X_all))
    Z, Z_ext = Z_all[: len(texts)], Z_all[len(texts):]
    log(f"06 embed: vocabulary {X_all.shape[1]} terms, LSA dim {dim}, "
        f"explained variance {svd.explained_variance_ratio_.sum():.2f}")
    return vec, svd, Z, Z_ext, X_all[: len(texts)]


# ---------------------------------------------------------------------------
# 07 Layout and branches
# ---------------------------------------------------------------------------
def cluster_once(Z: np.ndarray, seed: int) -> np.ndarray:
    import umap
    from sklearn.cluster import HDBSCAN

    emb = umap.UMAP(n_components=8, n_neighbors=min(12, len(Z) - 1), min_dist=0.0, metric="cosine", random_state=seed).fit_transform(Z)
    return HDBSCAN(min_cluster_size=max(3, min(9, len(Z) // 12)), min_samples=min(4, max(2, len(Z) // 30))).fit_predict(emb)


def c_tfidf_keywords(X, labels: np.ndarray, vocab: np.ndarray, top: int = 6) -> dict[int, list[str]]:
    out = {}
    classes = sorted(set(labels) - {-1})
    tf = np.vstack([np.asarray(X[labels == c].sum(axis=0)).ravel() for c in classes])
    avg = tf.sum() / max(1, len(classes))
    idf = np.log(1 + avg / (tf.sum(axis=0) + 1e-9))
    w = (tf / (tf.sum(axis=1, keepdims=True) + 1e-9)) * idf
    for i, c in enumerate(classes):
        idx = np.argsort(-w[i])
        kws = []
        for j in idx:
            term = vocab[j]
            toks = set(term.split())
            if any(toks & set(k.split()) for k in kws):
                continue
            kws.append(term)
            if len(kws) == top:
                break
        out[c] = kws
    return out


def name_branch(members: list[dict]) -> tuple[str, str]:
    groups = Counter(tx.domain_group(d) for p in members for d in p["domains"][:1])
    if not groups:
        return "Unlabelled branch", "no domain tags yet"
    domains = Counter(d for p in members for d in p["domains"])
    families = Counter(tx.method_family(m) for p in members for m in p["methods"])
    (g1, c1), *rest = groups.most_common(2)
    name = g1 if c1 / max(1, sum(groups.values())) >= 0.6 or not rest else f"{g1} × {rest[0][0]}"
    top_dom = ", ".join(tx.domain_label(d) for d, _ in domains.most_common(2))
    top_fam = ", ".join(f for f, _ in families.most_common(2))
    return name, f"{top_dom} · {top_fam}"


def stage_layout(projects, Z, Z_ext, X, vec):
    import umap
    from sklearn.metrics import adjusted_rand_score

    reducer = umap.UMAP(n_components=2, n_neighbors=min(12, len(Z) - 1), min_dist=0.3, spread=1.2, metric="cosine", random_state=42)
    xy = reducer.fit_transform(Z)
    xy_ext = reducer.transform(Z_ext) if len(Z_ext) else np.zeros((0, 2))

    labels = cluster_once(Z, 42)
    runs = [cluster_once(Z, s) for s in (1, 2, 3, 4)]
    stability = float(np.mean([adjusted_rand_score(labels, r) for r in runs]))
    n_clusters = len(set(labels) - {-1})
    noise = int((labels == -1).sum())
    log(f"07 layout: {n_clusters} branches, {noise} bridging/frontier projects, stability ARI {stability:.2f} over 4 seeds")

    latent = [p.get("_latent_theme") for p in projects]
    synth_ari = None
    if all(latent):
        synth_ari = float(adjusted_rand_score(latent, labels))
        log(f"    synthetic check: ARI vs hidden themes {synth_ari:.2f} (pipeline never sees them)")

    vocab = np.array(vec.get_feature_names_out())
    kw = c_tfidf_keywords(X, labels, vocab)

    # order branches by size so colours and zones are stable between runs
    sizes = Counter(int(l) for l in labels if l != -1)
    order = [c for c, _ in sizes.most_common()]
    remap = {c: i for i, c in enumerate(order)}
    frontier_idx = len(order)
    branch_of = np.array([remap.get(int(l), frontier_idx) for l in labels])

    branches = []
    drafts = {}
    for c in order:
        members = [p for p, b in zip(projects, branch_of) if b == remap[c]]
        doms = Counter(d for p in members for d in p["domains"]).most_common(1)
        drafts[c] = (*name_branch(members), doms[0][0] if doms else "")
    name_counts = Counter(n for n, _, _ in drafts.values())
    for c in order + [-1]:
        b_idx = remap.get(c, frontier_idx)
        members = [p for p, b in zip(projects, branch_of) if b == b_idx]
        if c == -1:
            name, sub = "Bridging & Frontier Projects", "Projects that sit between branches (HDBSCAN outliers)"
        else:
            name, sub, top_dom = drafts[c]
            if name_counts[name] > 1 and top_dom:
                name = f"{name}: {tx.domain_label(top_dom)}"
        branches.append({
            "idx": b_idx,
            "id": "frontier" if c == -1 else f"b{b_idx:02d}",
            "name": name,
            "subtitle": sub,
            "keywords": kw.get(c, []),
            "is_frontier": c == -1,
            "count": len(members),
        })
    for p, b in zip(projects, branch_of):
        p["branch_idx"] = int(b)
    return xy, xy_ext, branches, {"stability_ari": stability, "synthetic_theme_ari": synth_ari,
                                   "n_branches": n_clusters, "n_frontier": noise}


def to_scene(xy: np.ndarray, xy_ext: np.ndarray):
    """Fit the 2D layout into the free area of the 2D view (about 104 x 66 units, centred at y=8)."""
    lo, hi = xy.min(axis=0), xy.max(axis=0)
    centre = (lo + hi) / 2
    s = min(104 / (hi[0] - lo[0]), 66 / (hi[1] - lo[1]))
    f = lambda a: np.column_stack([(a[:, 0] - centre[0]) * s, (a[:, 1] - centre[1]) * s + 8.0])
    return f(xy), f(xy_ext), s


# ---------------------------------------------------------------------------
# 08 Gaps
# ---------------------------------------------------------------------------
def kde(points: np.ndarray, grid: np.ndarray, h: float) -> np.ndarray:
    d2 = ((grid[:, None, :] - points[None, :, :]) ** 2).sum(-1)
    return np.exp(-d2 / (2 * h * h)).sum(axis=1)


def stage_gaps(projects, branches, P2, E2, Z, Z_ext, external, cohorts):
    from sklearn.cluster import AgglomerativeClustering

    gaps = []
    frontier_idx = next(b["idx"] for b in branches if b["is_frontier"])
    core = [b for b in branches if not b["is_frontier"]]
    b_of = np.array([p["branch_idx"] for p in projects])
    centroids = {b["idx"]: P2[b_of == b["idx"]].mean(axis=0) for b in branches if (b_of == b["idx"]).any()}
    radius = {b: float(np.median(np.linalg.norm(P2[b_of == b] - c, axis=1))) for b, c in centroids.items()}
    bname = {b["idx"]: b["name"] for b in branches}

    def nearest_branch(pt):
        best = min((np.linalg.norm(pt - centroids[b["idx"]]) / max(radius[b["idx"]], 1e-6), b["idx"]) for b in core)
        return best[1] if best[0] < 1.6 else frontier_idx

    # (a) sparse regions between branches -----------------------------------
    h = 5.0
    gx = np.linspace(P2[:, 0].min(), P2[:, 0].max(), 90)
    gy = np.linspace(P2[:, 1].min(), P2[:, 1].max(), 60)
    G = np.array([[x, y] for y in gy for x in gx])
    dens = kde(P2, G, h)
    dens_at_p = kde(P2, P2, h)
    thr = np.percentile(dens_at_p, 15) * 0.3
    dists = np.linalg.norm(G[:, None, :] - P2[None, :, :], axis=-1)
    cand = []
    for gi in range(len(G)):
        if dens[gi] >= thr:
            continue
        dmin = dists[gi].min()
        if not (1.4 * h <= dmin <= 3.2 * h):
            continue
        near = np.where(dists[gi] < 4.5 * h)[0]
        counts = Counter(int(b_of[j]) for j in near if b_of[j] != frontier_idx)
        sides = [b for b, c in counts.items() if c >= 2]
        if len(sides) >= 2:
            cand.append((len(sides) * (1 - dens[gi] / thr), gi, sides, near))
    cand.sort(key=lambda t: -t[0])
    picked, pairs = [], set()
    for sc, gi, sides, near in cand:
        sides = tuple(sorted(sorted(sides, key=lambda b: np.linalg.norm(G[gi] - centroids[b]))[:2]))
        if sides in pairs or any(np.linalg.norm(G[gi] - G[pj]) < 4 * h for pj, _, _ in picked):
            continue
        pairs.add(sides)
        picked.append((gi, sides, near))
        if len(picked) == 5:
            break
    for gi, sides, near in picked:
        by_side = [sorted([j for j in near if b_of[j] == b], key=lambda j: dists[gi][j])[:3] for b in sides]
        rel = [j for pair in zip(*by_side) for j in pair] or list(near[:4])
        gaps.append({
            "type": "density",
            "title": f"Between {bname[sides[0]]} and {bname[sides[1]]}",
            "description": "An empty region of the semantic map bordered by two branches. Projects here would combine the "
                           "concerns of both sides.",
            "evidence": [f"Nearest: {projects[j]['title']} ({bname[projects[j]['branch_idx']]})" for j in rel[:6]],
            "xy": G[gi].tolist(),
            "zone_branch": frontier_idx,
            "weight": GAP_WEIGHT["density"],
            "score": round(float(len(sides) * (1 - dens[gi] / thr)), 2),
            "related": [int(j) for j in rel],
        })

    # (b) untested method-family x domain combinations -----------------------
    fams = sorted({tx.method_family(m) for p in projects for m in p["methods"]})
    doms = sorted({d for p in projects for d in p["domains"]}, key=lambda d: (tx.domain_group(d), d))
    O = np.zeros((len(fams), len(doms)))
    for p in projects:
        for f in {tx.method_family(m) for m in p["methods"]}:
            for d in set(p["domains"]):
                O[fams.index(f), doms.index(d)] += 1
    E = O.sum(axis=1, keepdims=True) * O.sum(axis=0, keepdims=True) / max(O.sum(), 1)
    combos = [(E[i, j], i, j) for i in range(len(fams)) for j in range(len(doms)) if O[i, j] == 0 and E[i, j] >= 1.0]
    combos.sort(reverse=True)
    for e, i, j in combos[:8]:
        f_proj = [k for k, p in enumerate(projects) if any(tx.method_family(m) == fams[i] for m in p["methods"])]
        d_proj = [k for k, p in enumerate(projects) if doms[j] in p["domains"]]
        pt = 0.5 * P2[f_proj].mean(axis=0) + 0.5 * P2[d_proj].mean(axis=0)
        home = Counter(projects[k]["branch_idx"] for k in d_proj).most_common(1)[0][0]
        gaps.append({
            "type": "untested",
            "title": f"{fams[i]} × {tx.domain_label(doms[j])}",
            "description": f"No MaAI project applies {fams[i].lower()} methods to {tx.domain_label(doms[j]).lower()}, "
                           f"although both are common ({int(O[i].sum())} and {int(O[:, j].sum())} uses). "
                           f"Expected about {e:.1f} projects if they combined at random. Check whether the pairing makes sense.",
            "evidence": [f"Uses {fams[i].lower()}: {projects[k]['title']}" for k in f_proj[:2]]
                        + [f"Works on {tx.domain_label(doms[j]).lower()}: {projects[k]['title']}" for k in d_proj[:2]],
            "xy": pt.tolist(),
            "zone_branch": int(home),
            "weight": round(min(4.0, e * GAP_WEIGHT["untested"]), 2),
            "score": round(float(e), 2),
            "related": [int(k) for k in (f_proj[:3] + d_proj[:3])],
        })

    # (c) external literature with low MaAI coverage -------------------------
    coverage = (Z_ext @ Z.T).max(axis=1) if len(Z_ext) else np.zeros(0)
    low = np.where(coverage < np.percentile(coverage, 45))[0] if len(coverage) else np.zeros(0, int)
    if len(low) >= 6:
        agg = AgglomerativeClustering(n_clusters=None, distance_threshold=0.75, metric="cosine", linkage="average")
        lab = agg.fit_predict(Z_ext[low])
        for c in Counter(lab):
            members = low[lab == c]
            if len(members) < 5:
                continue
            docs = [external[k] for k in members]
            m_top = Counter(m for d in docs for m in d["methods"]).most_common(2)
            d_top = Counter(x for d in docs for x in d["domains"]).most_common(2)
            pt = E2[members].mean(axis=0)
            title = f"{' / '.join(tx.method_label(m) for m, _ in m_top)} for {' / '.join(tx.domain_label(x).lower() for x, _ in d_top)}"
            near = np.argsort(-(Z @ Z_ext[members].mean(axis=0)))[:4]
            gaps.append({
                "type": "external",
                "title": title,
                "description": f"{len(members)} papers in the external literature sample cover this topic, but the closest "
                               f"MaAI projects only reach a similarity of {coverage[members].mean():.2f}.",
                "evidence": [f"External: {docs[0]['text'][:150]}…"] + [f"Closest MaAI: {projects[k]['title']}" for k in near[:3]],
                "xy": pt.tolist(),
                "zone_branch": int(nearest_branch(pt)),
                "weight": round(min(8.0, len(members) * GAP_WEIGHT["external"]), 2),
                "score": round(float(len(members) * (1 - coverage[members].mean())), 2),
                "related": [int(k) for k in near],
                "n_external": int(len(members)),
            })

    # (d) fading branches ----------------------------------------------------
    sizes = np.array([sum(1 for p in projects if p["cohort_idx"] == c) for c in range(len(cohorts))], dtype=float)
    for b in core:
        counts = np.array([sum(1 for p in projects if p["cohort_idx"] == c and p["branch_idx"] == b["idx"]) for c in range(len(cohorts))])
        share = counts / np.maximum(sizes, 1)
        b["cohort_counts"] = counts.tolist()
        if share[0] > 0 and share[-1] < share[0] * 0.65:
            gaps.append({
                "type": "fading",
                "title": f"Fading: {b['name']}",
                "description": f"Share of projects fell from {share[0]:.0%} in {cohorts[0]} to {share[-1]:.0%} in {cohorts[-1]}. "
                               "Open questions in this branch may be left unfinished.",
                "evidence": [f"{cohorts[c]}: {int(counts[c])} projects ({share[c]:.0%})" for c in range(len(cohorts))],
                "xy": centroids[b["idx"]].tolist(),
                "zone_branch": b["idx"],
                "weight": GAP_WEIGHT["fading"],
                "score": round(float(share[0] - share[-1]), 3),
                "related": [],
            })
    for b in branches:
        if b["is_frontier"]:
            b["cohort_counts"] = [sum(1 for p in projects if p["cohort_idx"] == c and p["branch_idx"] == b["idx"]) for c in range(len(cohorts))]

    for i, g in enumerate(gaps):
        g["idx"] = i
        g["id"] = f"gap-{i:02d}"
    log("08 gaps: " + ", ".join(f"{n} {t}" for t, n in Counter(g["type"] for g in gaps).items()))
    matrix = {"rows": fams, "cols": [tx.domain_label(d) for d in doms], "col_groups": [tx.domain_group(d) for d in doms],
              "observed": O.astype(int).tolist(), "expected": np.round(E, 2).tolist()}
    return gaps, matrix, centroids


# ---------------------------------------------------------------------------
# 10 Basilica allocation
# ---------------------------------------------------------------------------
def hex_to_rgb(h: str) -> np.ndarray:
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)], dtype=np.float32)


def stage_basilica(pts, zones, projects, branches, gaps, P2, centroids, rng):
    """Rules (also printed in the legend and docs/PIPELINE.md):
      R1 core branches ranked by size -> zones 0-4 ranked by point capacity; extra branches share zones.
      R2 frontier (bridging) projects and between-branch gaps -> zone 5, Glory Façade & Tower of Jesus Christ.
      R3 zone built fraction = projects / (projects + gap weight attributed to the zone).
      R4 built points are laid bottom-up in cohort order; each project gets an equal share,
         +8% per reproducibility rubric point.
      R5 a stone's 2D position is its project's map position; ghost points sit on their gap's map position.
    """
    N = len(pts)
    core = [b for b in branches if not b["is_frontier"]]
    frontier = next(b for b in branches if b["is_frontier"])
    capacity = {z: int((zones == z).sum()) for z in range(len(ZONES))}
    zone_rank = sorted([z for z in range(len(ZONES)) if z != FRONTIER_ZONE], key=lambda z: -capacity[z])
    for i, b in enumerate(core):
        b["zone_idx"] = zone_rank[i % len(zone_rank)]
    frontier["zone_idx"] = FRONTIER_ZONE
    zone_of_branch = {b["idx"]: b["zone_idx"] for b in branches}
    for i, b in enumerate(core):
        b["color"] = BRANCH_COLORS[i % len(BRANCH_COLORS)]
    frontier["color"] = FRONTIER_COLOR
    color_of = {b["idx"]: hex_to_rgb(b["color"]) for b in branches}

    for g in gaps:
        g["zone_idx"] = zone_of_branch[g["zone_branch"]]

    basilica = pts.copy()
    basilica[:, 1] -= 62.0
    basilica *= 0.55
    umap_xyz = np.zeros((N, 3), np.float32)
    colors = np.zeros((N, 3), np.float32)
    cohort = np.full(N, 99.0, np.float32)
    built = np.zeros(N, np.float32)
    proj = np.full(N, -1.0, np.float32)
    branch = np.zeros(N, np.float32)

    zone_info = []
    for z in range(len(ZONES)):
        idx = np.where(zones == z)[0]
        zb = [b for b in branches if b["zone_idx"] == z]
        zp = [k for k, p in enumerate(projects) if zone_of_branch[p["branch_idx"]] == z]
        zg = [g for g in gaps if g["zone_idx"] == z]
        P = len(zp)
        G = sum(g["weight"] for g in zg)
        frac = 0.0 if P == 0 else float(np.clip(P / (P + G), 0.12, 0.96))
        order = idx[np.argsort(pts[idx, 1] + rng.normal(0, 1.8, len(idx)))]
        n_built = int(len(order) * frac)
        built_idx, ghost_idx = order[:n_built], order[n_built:]

        # R4: projects in cohort order, then left-to-right on the map
        zp.sort(key=lambda k: (projects[k]["cohort_idx"], P2[k, 0]))
        w = np.array([1 + 0.08 * ((projects[k].get("repo") or {}).get("score", 0)) for k in zp])
        cuts = (np.cumsum(w) / w.sum() * n_built).astype(int) if P else []
        start = 0
        for k, end in zip(zp, cuts):
            chunk = built_idx[start:end]
            start = end
            p = projects[k]
            n_c = len(chunk)
            r = np.sqrt(rng.random(n_c)) * 1.1
            th = rng.uniform(0, 2 * math.pi, n_c)
            umap_xyz[chunk, 0] = P2[k, 0] + r * np.cos(th)
            umap_xyz[chunk, 1] = P2[k, 1] + r * np.sin(th)
            umap_xyz[chunk, 2] = rng.normal(0, 0.15, n_c)
            lift = np.clip(pts[chunk, 1] / 172.0, 0, 1)[:, None] * 0.18
            tint = 0.78 + 0.08 * p["cohort_idx"]
            colors[chunk] = np.clip(color_of[p["branch_idx"]] * tint + lift, 0, 1)
            cohort[chunk] = p["cohort_idx"]
            built[chunk] = 1.0
            proj[chunk] = k
            branch[chunk] = p["branch_idx"]
            p["point_count"] = int(n_c)
            p["basilica"] = basilica[chunk].mean(axis=0).round(2).tolist() if n_c else basilica[idx].mean(axis=0).round(2).tolist()
            p["zone_idx"] = z

        # R5: ghost points gather at their gaps on the map
        home_branch = zb[0]["idx"] if zb else frontier["idx"]
        ghost_rgb = np.clip(color_of[home_branch] * 0.55 + 0.28, 0, 1)
        if len(ghost_idx):
            if zg:
                gw = np.array([g["weight"] for g in zg])
                assign = rng.choice(len(zg), size=len(ghost_idx), p=gw / gw.sum())
                centre = np.array([zg[a]["xy"] for a in assign])
                spread = 2.4
            else:
                # zone with no gaps (or no branch yet): a faint ring around the whole map
                ang = rng.uniform(0, 2 * math.pi, len(ghost_idx))
                centre = np.column_stack([70 * np.cos(ang), 8 + 44 * np.sin(ang)])
                spread = 3.0
            umap_xyz[ghost_idx, 0] = centre[:, 0] + rng.normal(0, spread, len(ghost_idx))
            umap_xyz[ghost_idx, 1] = centre[:, 1] + rng.normal(0, spread, len(ghost_idx))
            umap_xyz[ghost_idx, 2] = -1.5
            colors[ghost_idx] = ghost_rgb
            branch[ghost_idx] = home_branch
        zone_info.append({
            "idx": z, "name": ZONES[z], "branch_idxs": [b["idx"] for b in zb], "capacity": capacity[z],
            "projects": P, "gap_weight": round(float(G), 2), "built_fraction": round(frac, 3),
            "built_points": int(n_built), "ghost_points": int(len(ghost_idx)),
        })

    packed = np.column_stack([basilica, umap_xyz, colors, cohort, built, proj, branch, zones.astype(np.float32)]).astype(np.float32)
    log("10 basilica: " + "; ".join(f"{ZONES[z['idx']].split(' ')[0]} {z['built_fraction']:.0%}" for z in zone_info))
    return packed, zone_info


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def build(corpus: dict, pts: np.ndarray, zones: np.ndarray, source_label: str) -> None:
    from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS

    rng = np.random.default_rng(11)
    projects = corpus["projects"]
    external = corpus.get("external", [])
    cohorts = corpus["cohorts"]
    for p in projects:
        p["cohort_idx"] = cohorts.index(p["cohort"]) if p["cohort"] in cohorts else len(cohorts) - 1

    sources = stage_cite(projects)
    stage_repos(projects)
    vec, svd, Z, Z_ext, X = stage_embed(projects, external)
    xy, xy_ext, branches, layout_stats = stage_layout(projects, Z, Z_ext, X, vec)
    P2, E2, _ = to_scene(xy, xy_ext)
    gaps, matrix, centroids = stage_gaps(projects, branches, P2, E2, Z, Z_ext, external, cohorts)
    structure = stage_structure(projects, branches, Z, P2, cohorts, gaps, log)

    # similar projects (embedding) and bibliographic coupling (shared references)
    S = Z @ Z.T
    np.fill_diagonal(S, -1)
    refsets = [set(p["references"]) for p in projects]
    for k, p in enumerate(projects):
        p["similar"] = [int(j) for j in np.argsort(-S[k])[:5]]
        coupled = []
        for j, rs in enumerate(refsets):
            if j != k:
                shared = len(refsets[k] & rs)
                if shared >= 3:
                    coupled.append((shared / len(refsets[k] | rs), shared, j))
        coupled.sort(reverse=True)
        p["coupled"] = [{"idx": j, "shared": s} for _, s, j in coupled[:5]]

    # anchor sources per branch: cited often inside the branch, relative to everywhere else
    total_cites = Counter(s_i for p in projects for s_i in p["references"])
    for b in branches:
        members = [p for p in projects if p["branch_idx"] == b["idx"]]
        inside = Counter(s_i for p in members for s_i in p["references"])
        lift = {s: c / len(members) / (total_cites[s] / len(projects)) for s, c in inside.items() if c >= 3}
        b["anchors"] = [s for s, _ in sorted(lift.items(), key=lambda kv: -(kv[1] * inside[kv[0]]))[:6]]
        b["centroid"] = centroids[b["idx"]].round(2).tolist() if b["idx"] in centroids else [0, 0]
        b["description"] = (f"{b['count']} projects. Common methods: {b['subtitle'].split(' · ')[-1]}. "
                            f"Keywords: {', '.join(b['keywords'][:5])}." if not b["is_frontier"] else
                            f"{b['count']} projects that did not fit a single branch. Many combine two research areas.")

    packed, zone_info = stage_basilica(pts, zones, projects, branches, gaps, P2, centroids, rng)

    # ---------------- write outputs ----------------
    CURATED.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    packed.tofile(DATA / "points.bin")

    # 09 search export: the browser rebuilds TF-IDF -> LSA for any query
    vocab = vec.get_feature_names_out().tolist()
    (DATA / "search_index.json").write_text(json.dumps({
        "vocab": vocab, "idf": np.round(vec.idf_, 5).tolist(), "dim": int(svd.n_components),
        "ngram": [1, 2], "sublinear_tf": True, "stop_words": sorted(ENGLISH_STOP_WORDS),
        "token_pattern": r"\b\w\w+\b",
    }), encoding="utf-8")
    np.concatenate([svd.components_.astype(np.float32).ravel(), Z.astype(np.float32).ravel()]).tofile(DATA / "search_vectors.bin")
    log(f"09 search: {len(vocab)} terms x {svd.n_components} dims exported for in-browser query embedding")

    web_projects = []
    for k, p in enumerate(projects):
        repo = p.get("repo")
        web_projects.append({
            "idx": k, "id": p["id"], "title": p["title"], "synthetic": p.get("synthetic", False),
            "cohort": p["cohort"], "cohort_idx": p["cohort_idx"], "work_type": tx.WORK_TYPE_LABELS.get(p.get("work_type"), p.get("work_type") or "—"),
            "abstract": p.get("abstract", ""),
            "methods": [tx.method_label(m) for m in p["methods"]],
            "families": sorted({tx.method_family(m) for m in p["methods"]}),
            "data": [tx.data_label(d) for d in p["data"]],
            "tools": [tx.tool_label(t) for t in p["tools"]],
            "scale": p.get("scale"),
            "domains": [tx.domain_label(d) for d in p["domains"]],
            "tags": sorted({syn for m in p["methods"] if m in tx.METHODS for syn in tx.METHODS[m][2]}
                           | {syn for d in p["data"] if d in tx.DATA for syn in tx.DATA[d][1]}),
            "repo": None if not repo else {
                "url": repo.get("url"), "score": repo.get("score"), "summary": repo.get("summary"),
                "signals": [[label, bool(repo.get("signals", {}).get(key))] for key, label in RUBRIC],
                "languages": repo.get("languages", []), "last_commit": repo.get("last_commit"),
            },
            "refs": p["references"], "similar": p["similar"], "coupled": p["coupled"],
            "xy": P2[k].round(2).tolist(), "basilica": p.get("basilica", [0, 0, 0]),
            "point_count": p.get("point_count", 0), "branch_idx": p["branch_idx"], "zone_idx": p.get("zone_idx", 5),
        })
    web_sources = [{"idx": i, "id": s["id"], "title": s["title"], "author": s["author"], "year": s["year"],
                    "venue": s["venue"], "variants": len(s["variants"]), "cited_by": s["cited_by"]} for i, s in enumerate(sources)]
    for b in branches:
        b.pop("zone_branch", None)
    meta = {
        "version": 2,
        "source": source_label,
        "synthetic": any(p.get("synthetic") for p in projects),
        "point_count": int(len(packed)),
        "floats_per_point": 14,  # bx by bz ux uy uz r g b cohort built proj branch zone
        "built_points": int((packed[:, 10] > 0.5).sum()),
        "ghost_points": int((packed[:, 10] <= 0.5).sum()),
        "cohorts": cohorts,
        "branches": branches,
        "zones": zone_info,
        "projects": web_projects,
        "sources": web_sources,
        "gaps": [{k: v for k, v in g.items() if k != "zone_branch"} for g in gaps],
        "matrix": matrix,
        "structure": structure,
        "search": {"vectors": "data/search_vectors.bin", "index": "data/search_index.json",
                   "n_projects": len(projects), "dim": int(svd.n_components), "vocab_size": len(vocab)},
        "stats": {**layout_stats, "raw_references": sum(len(p.get("raw_references", [])) for p in projects),
                  "unique_sources": len(sources), "external_docs": len(external)},
        "rules": [
            "Core branches ranked by size are placed on building zones ranked by point capacity.",
            "Bridging projects and between-branch gaps live on the Glory Façade and Tower of Jesus Christ.",
            "A zone's built share = projects ÷ (projects + gap weight attributed to it).",
            "Stones are laid bottom-up in cohort order; each project gets an equal share, +8% per reproducibility point.",
            "In 2D, stones sit at their project's map position and scaffold sits on its gap.",
        ],
    }
    (DATA / "atlas_meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    # curated dataset, bibliography and gap report (expected outputs of the brief)
    curated = [{k: v for k, v in p.items() if not k.startswith("_") and k not in ("full_text",)} for p in projects]
    for c, p in zip(curated, projects):
        c["branch"] = branches[p["branch_idx"]]["name"]
        c["layout"] = {"x": round(float(P2[projects.index(p)][0]), 2), "y": round(float(P2[projects.index(p)][1]), 2)}
        c["references"] = [sources[s]["id"] for s in p["references"]]
    (CURATED / "projects.json").write_text(json.dumps(curated, ensure_ascii=False, indent=1), encoding="utf-8")
    (CURATED / "sources.json").write_text(json.dumps(web_sources, ensure_ascii=False, indent=1), encoding="utf-8")
    (CURATED / "bibliography.bib").write_text(bibtex(sources), encoding="utf-8")
    with open(CURATED / "projects.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "title", "cohort", "work_type", "branch", "methods", "data", "tools", "scale", "domains", "repo_url", "repro_score", "n_references", "synthetic"])
        for c, p in zip(curated, projects):
            w.writerow([p["id"], p["title"], p["cohort"], p.get("work_type"), c["branch"], "; ".join(p["methods"]), "; ".join(p["data"]),
                        "; ".join(p["tools"]), p.get("scale"), "; ".join(p["domains"]), (p.get("repo") or {}).get("url", ""),
                        (p.get("repo") or {}).get("score", ""), len(p["references"]), p.get("synthetic", False)])
    (REPORTS / "gap_report.md").write_text(gap_report(meta), encoding="utf-8")
    (REPORTS / "pipeline_run.json").write_text(json.dumps({"source": source_label, "stats": meta["stats"], "zones": zone_info}, indent=1), encoding="utf-8")
    log(f"wrote data/atlas_meta.json, data/points.bin ({len(packed):,} pts), data/curated/*, reports/gap_report.md")


def gap_report(meta: dict) -> str:
    L = ["# MaAI Atlas: research branches and gap analysis", ""]
    if meta["synthetic"]:
        L += ["> **Synthetic demo corpus.** Every project below is generated. The report shows the format and the method, not findings.", ""]
    st = meta["stats"]
    L += [f"Projects: {len(meta['projects'])} · Cohorts: {', '.join(meta['cohorts'])} · Unique sources: {st['unique_sources']} "
          f"(from {st['raw_references']} raw references) · Branch stability (ARI over 4 seeds): {st['stability_ari']:.2f}", "",
          "## Branches", "", "| Branch | Projects | Per cohort | Keywords | Basilica zone |", "|---|---|---|---|---|"]
    zones = {z["idx"]: z["name"] for z in meta["zones"]}
    for b in meta["branches"]:
        L.append(f"| {b['name']} | {b['count']} | {' / '.join(map(str, b.get('cohort_counts', [])))} | {', '.join(b['keywords'][:5])} | {zones[b['zone_idx']]} |")
    L += ["", "## Gaps", ""]
    labels = {"density": "Sparse region of the map", "untested": "Untested method × domain combination",
              "external": "Strong in external literature, weak in MaAI", "fading": "Fading branch"}
    for t, label in labels.items():
        gs = [g for g in meta["gaps"] if g["type"] == t]
        if not gs:
            continue
        L += [f"### {label}", ""]
        for g in gs:
            L += [f"**{g['title']}** (score {g['score']}, zone: {zones[g['zone_idx']]})  ", g["description"], ""]
            L += [f"- {e}" for e in g["evidence"]] + [""]
    L += structure_report(meta)
    L += ["## Method", "", "- Embeddings: TF-IDF (1-2 grams) reduced with truncated SVD; 2D layout with UMAP (cosine).",
          "- Branches: HDBSCAN on an 8D UMAP; names from the dominant domain group, keywords from class-based TF-IDF.",
          "- Sparse regions: kernel density on the 2D map, low-density cells bordered by two or more branches.",
          "- Untested combinations: method family × domain counts compared with independence expectation.",
          "- External coverage: external abstracts embedded in the same space; topics whose nearest MaAI project is far.",
          "- Fading: branch share in the first vs. latest cohort.",
          "- Structure: MST corridors in 64D with bootstrap support, largest empty Delaunay circles as voids, checked in 64D.", "",
          "All gaps are candidates for faculty review, not conclusions."]
    return "\n".join(L) + "\n"
