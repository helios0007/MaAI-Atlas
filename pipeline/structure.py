"""
08b structure: cosmic-web analysis of the project cloud.

The tools come from cosmology (they find structure in a cloud of galaxies). They need only points and a
distance, not gravity, so they work on projects in the LSA embedding.

    density     k-nearest-neighbour density in the 64D LSA space (not on the 2D UMAP picture)
    corridors   minimum spanning tree (MST) in 64D; distance = cosine distance x (1 - 0.5 x shared-reference Jaccard).
                Two branches are joined when the MST links them directly or through bridging (frontier) projects.
                The corridor is the MST path between the densest projects (cores) of the two branches,
                like a filament between two nodes.
                Support = share of bootstrap runs (15% of projects removed) that join the same two branches.
    voids       largest empty circles of the 2D Delaunay triangulation (DIVE void finder), merged, with bootstrap
                support. Each void is checked in 64D: the mean of its rim projects must be farther from every
                project than a typical neighbour distance. (A watershed on the density finds nothing here: in a
                UMAP map the space between branches opens to the outside.)
    field       Hessian of the 2D log density: node (two negative eigenvalues), filament (one), void (low density).
                Display only, because UMAP changes distances.
    timeline    the same analysis on the cumulative cohorts (01, 01+02, ...): structure formation over time.
    cohorts     MST mean edge and two-point correlation xi(r) of each cohort against the whole programme.

References: Zel'dovich 1970; Sousbie 2011 (DisPerSE, arXiv:1009.4015); Naidoo et al. 2019 (MST, arXiv:1907.00989);
Cautun et al. 2014 (NEXUS); Zhao et al. 2016 (DIVE); Burchett et al. 2020 (Physarum, arXiv:2003.04393).
"""

from __future__ import annotations

from collections import Counter

import numpy as np

K_DENS = 8
BOOT_RUNS = 40
BOOT_DROP = 0.15
VOID_MIN_R = 3.0  # empty-circle radius in median 2D neighbour distances
VOID_MAX = 8
GRID_W, GRID_H = 120, 80


def _weights(Z: np.ndarray, refsets: list[set]) -> tuple[np.ndarray, np.ndarray]:
    D = np.clip(1.0 - Z @ Z.T, 0.0, 2.0)
    n = len(Z)
    J = np.zeros((n, n))
    for i in range(n):
        for j in range(i + 1, n):
            u = len(refsets[i] | refsets[j])
            if u:
                J[i, j] = J[j, i] = len(refsets[i] & refsets[j]) / u
    return D, D * (1.0 - 0.5 * J)


def _mst(W: np.ndarray, idx: np.ndarray) -> list[tuple[int, int, float]]:
    from scipy.sparse.csgraph import minimum_spanning_tree

    sub = W[np.ix_(idx, idx)] + 1e-9  # scipy treats 0 as "no edge"
    np.fill_diagonal(sub, 0)
    T = minimum_spanning_tree(sub).tocoo()
    return [(int(idx[a]), int(idx[b]), float(w)) for a, b, w in zip(T.row, T.col, T.data)]


def _adj(edges) -> dict[int, list[int]]:
    adj: dict[int, list[int]] = {}
    for a, b, _ in edges:
        adj.setdefault(a, []).append(b)
        adj.setdefault(b, []).append(a)
    return adj


def _bridges(edges, branch_of, frontier_idx) -> dict[tuple[int, int], list[int]]:
    """MST paths that join two core branches, with only bridging projects in between."""
    adj = _adj(edges)
    found: dict[tuple[int, int], list[int]] = {}
    for u in adj:
        bu = branch_of[u]
        if bu == frontier_idx:
            continue
        for v in adj[u]:
            if branch_of[v] == bu:
                continue
            stack = [(v, u, [u, v])]
            while stack:
                x, parent, path = stack.pop()
                bx = branch_of[x]
                if bx != frontier_idx:
                    if bx != bu:
                        key = (min(u, x), max(u, x))
                        found.setdefault(key, path if u < x else path[::-1])
                    continue
                for y in adj[x]:
                    if y != parent:
                        stack.append((y, x, path + [y]))
    return found


def _pairs(found, branch_of) -> set[tuple[int, int]]:
    return {tuple(sorted((int(branch_of[p[0]]), int(branch_of[p[-1]])))) for p in found.values()}


def _tree_path(adj, a, b) -> list[int]:
    prev = {a: None}
    stack = [a]
    while stack:
        x = stack.pop()
        if x == b:
            break
        for y in adj[x]:
            if y not in prev:
                prev[y] = x
                stack.append(y)
    out = [b]
    while prev[out[-1]] is not None:
        out.append(prev[out[-1]])
    return out[::-1]


def _status(sup):
    return "robust" if sup is None or sup >= 0.6 else "tentative" if sup >= 0.3 else "weak"


def _analyse_corridors(idx, W, D, branch_of, frontier_idx, refsets, cohort_of, dz, rng, boot=True):
    edges = _mst(W, idx)
    found = _bridges(edges, branch_of, frontier_idx)
    adj = _adj(edges)
    ew = {(min(a, b), max(a, b)): w for a, b, w in edges}
    intra = [w for a, b, w in edges if branch_of[a] == branch_of[b] != frontier_idx]
    scale = float(np.median(intra)) if intra else 1.0
    core: dict[int, int] = {}
    for i in idx:
        b = int(branch_of[i])
        if b != frontier_idx and (b not in core or dz[i] > dz[core[b]]):
            core[b] = int(i)

    support: Counter = Counter()
    if boot:
        for _ in range(BOOT_RUNS):
            keep = idx[rng.random(len(idx)) > BOOT_DROP]
            if len(keep) >= 4:
                support.update(_pairs(_bridges(_mst(W, keep), branch_of, frontier_idx), branch_of))

    best: dict[tuple, list[int]] = {}
    for bridge in sorted(found.values(), key=len):
        best.setdefault(tuple(sorted((int(branch_of[bridge[0]]), int(branch_of[bridge[-1]])))), bridge)
    w_of = lambda a, b: ew[(min(a, b), max(a, b))]
    out = []
    for pair, bridge in best.items():
        path = _tree_path(adj, core[pair[0]], core[pair[1]])
        shared = Counter(s for a, b in zip(path, path[1:]) for s in refsets[a] & refsets[b])
        sup = round(support[pair] / BOOT_RUNS, 2) if boot else None
        out.append({
            "branches": list(pair),
            "path": [int(p) for p in path],
            "bridge": [int(p) for p in bridge],
            "length": round(float(sum(w_of(a, b) for a, b in zip(path, path[1:]))), 3),
            # the jump between the two branches / median step inside a branch
            "separation": round(max(w_of(a, b) for a, b in zip(bridge, bridge[1:])) / scale, 2),
            "similarity": round(float(1 - np.mean([D[a, b] for a, b in zip(path, path[1:])])), 3),
            "support": sup,
            "status": _status(sup),
            "shared_sources": [int(s) for s, _ in shared.most_common(3)],
            "cohorts": sorted({int(cohort_of[p]) for p in path}),
        })
    # branch pairs that bootstrap runs join but the full tree does not: other possible corridors
    alt = [{"branches": list(pr), "support": round(c / BOOT_RUNS, 2)} for pr, c in support.most_common()
           if pr not in best and c / BOOT_RUNS >= 0.15 and frontier_idx not in pr]
    out.sort(key=lambda c: (-(c["support"] or 0), c["separation"]))
    return out, alt, edges, scale


def _empty_circles(pts):
    """Delaunay circumcircles: each one touches 3 projects and holds none inside (DIVE, Zhao et al. 2016)."""
    from scipy.spatial import Delaunay

    tri = Delaunay(pts)
    A = pts[tri.simplices]
    ax, ay, bx, by, cx, cy = A[:, 0, 0], A[:, 0, 1], A[:, 1, 0], A[:, 1, 1], A[:, 2, 0], A[:, 2, 1]
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    d = np.where(np.abs(d) < 1e-12, 1e-12, d)
    a2, b2, c2 = ax * ax + ay * ay, bx * bx + by * by, cx * cx + cy * cy
    ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
    uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
    R = np.hypot(ax - ux, ay - uy)
    inside = tri.find_simplex(np.column_stack([ux, uy])) >= 0  # centre inside the hull: no open bays
    return ux[inside], uy[inside], R[inside], tri.simplices[inside]


def _find_voids(pts, nn2):
    ux, uy, R, simp = _empty_circles(pts)
    voids: list[dict] = []
    for k in np.argsort(-R):
        if R[k] < VOID_MIN_R * nn2:
            break
        c = np.array([ux[k], uy[k]])
        host = next((v for v in voids if np.hypot(*(c - v["c"])) < v["R"]), None)
        if host is None:
            voids.append({"c": c, "R": float(R[k]), "circles": [[float(ux[k]), float(uy[k]), float(R[k])]],
                          "verts": set(simp[k].tolist())})
        else:
            host["circles"].append([float(ux[k]), float(uy[k]), float(R[k])])
            host["verts"] |= set(simp[k].tolist())
    return voids


def _voids(P2, idx, Z, branch_of, frontier_idx, nn_scale, rng, boot=True):
    from scipy.spatial import cKDTree

    pts = P2[idx]
    nn2 = float(np.median(cKDTree(pts).query(pts, 2)[0][:, 1]))
    found = _find_voids(pts, nn2)[:VOID_MAX]
    hits = np.zeros(len(found))
    if boot:
        for _ in range(BOOT_RUNS):
            keep = rng.random(len(pts)) > BOOT_DROP
            run = _find_voids(pts[keep], nn2)
            for k, v in enumerate(found):
                hits[k] += any(np.hypot(*(r["c"] - v["c"])) < 0.5 * v["R"] for r in run)
    voids = []
    for k, v in enumerate(found):
        rim = sorted({int(idx[j]) for j in v["verts"]}, key=lambda j: float(np.hypot(*(P2[j] - v["c"]))))[:8]
        m = Z[rim].mean(0)
        m /= np.linalg.norm(m) or 1.0
        empt = float(np.clip(1 - Z[idx] @ m, 0, 2).min()) / nn_scale
        sides = Counter(int(branch_of[r]) for r in rim if branch_of[r] != frontier_idx)
        sup = round(float(hits[k] / BOOT_RUNS), 2) if boot else None
        voids.append({
            "xy": [round(float(v["c"][0]), 2), round(float(v["c"][1]), 2)],
            "radius": round(v["R"], 2),
            "size_nn": round(v["R"] / nn2, 1),
            "support": sup,
            "emptiness_64d": round(empt, 2),
            "confirmed_64d": bool(empt >= 1.2),
            "status": (_status(sup) if empt >= 1.2 else "map only"),
            "rim": rim,
            "branches": [b for b, _ in sides.most_common(3)],
            "circles": [[round(x, 2) for x in c] for c in v["circles"][:12]],
        })
    return voids


def _field(P2, bounds, h=4.5) -> dict:
    """Hessian classification of the 2D log density (display layer only)."""
    from scipy.spatial import Delaunay

    x0, x1, y0, y1 = bounds
    gx, gy = np.linspace(x0, x1, GRID_W), np.linspace(y0, y1, GRID_H)
    X, Y = np.meshgrid(gx, gy)
    G = np.column_stack([X.ravel(), Y.ravel()])
    dens = np.exp(-((G[:, None, :] - P2[None, :, :]) ** 2).sum(-1) / (2 * h * h)).sum(1).reshape(GRID_H, GRID_W)
    mask = (Delaunay(P2).find_simplex(G) >= 0).reshape(GRID_H, GRID_W)
    L = np.log(dens + 0.1 * np.median(dens[mask]))
    sigma = float(L[mask].std()) or 1.0
    dx, dy = gx[1] - gx[0], gy[1] - gy[0]
    Ly, Lx = np.gradient(L, dy, dx)
    Lyy, Lyx = np.gradient(Ly, dy, dx)
    _, Lxx = np.gradient(Lx, dy, dx)
    tr, det = Lxx + Lyy, Lxx * Lyy - Lyx * Lyx
    disc = np.sqrt(np.maximum(tr * tr / 4 - det, 0))
    l1, l2 = tr / 2 - disc, tr / 2 + disc  # l1 <= l2
    t = 0.15 * sigma / (h * h)
    z = (L - L[mask].mean()) / sigma
    cls = np.full(L.shape, ".", dtype="<U1")
    cls[mask & (z < -0.8)] = "v"
    cls[mask & (l1 < -t) & (l2 >= -t) & (z >= -0.8)] = "f"
    cls[mask & (l2 < -t) & (z > 0)] = "n"
    return {"x0": round(float(x0), 3), "y0": round(float(y0), 3), "dx": round(float(dx), 4), "dy": round(float(dy), 4),
            "w": GRID_W, "h": GRID_H, "cls": "".join(cls.ravel()), "counts": dict(Counter(cls.ravel().tolist()))}


def _xi(sub_pairs: np.ndarray, all_pairs: np.ndarray, bins: np.ndarray) -> list:
    dd, _ = np.histogram(sub_pairs, bins)
    rr, _ = np.histogram(all_pairs, bins)
    dd = dd / max(dd.sum(), 1)
    rr = rr / max(rr.sum(), 1)
    return [round(float(a / b - 1), 3) if b > 0 else None for a, b in zip(dd, rr)]


def stage_structure(projects, branches, Z, P2, cohorts, gaps, log):
    rng = np.random.default_rng(7)
    n = len(projects)
    frontier_idx = next(b["idx"] for b in branches if b["is_frontier"])
    branch_of = np.array([p["branch_idx"] for p in projects])
    cohort_of = np.array([p["cohort_idx"] for p in projects])
    refsets = [set(p["references"]) for p in projects]
    D, W = _weights(Z, refsets)
    all_idx = np.arange(n)

    # 64D k-NN density
    k = min(K_DENS, n - 1)
    Ds = np.sort(D + np.eye(n) * 9, axis=1)[:, :k]
    nn_scale = float(np.median(Ds[:, 0]))
    logd = -np.log(Ds.mean(1) + 1e-9)
    dz = (logd - logd.mean()) / (logd.std() or 1)

    pad = 14
    bounds = (P2[:, 0].min() - pad, P2[:, 0].max() + pad, P2[:, 1].min() - pad, P2[:, 1].max() + pad)
    corridors, alt, edges, _ = _analyse_corridors(all_idx, W, D, branch_of, frontier_idx, refsets, cohort_of, dz, rng)
    voids = _voids(P2, all_idx, Z, branch_of, frontier_idx, nn_scale, rng)
    field = _field(P2, bounds)

    # link each void to a "density" gap from stage 08 when they are near each other
    for v in voids:
        near = [(float(np.hypot(g["xy"][0] - v["xy"][0], g["xy"][1] - v["xy"][1])), g["id"]) for g in gaps if g["type"] == "density"]
        near = [x for x in near if x[0] < max(9.0, v["radius"])]
        v["gap"] = min(near)[1] if near else None

    # per-project role (64D density, corridor membership)
    on_corridor = {p for c in corridors if c["status"] != "weak" for p in c["path"]}
    roles = []
    for i in range(n):
        if branch_of[i] != frontier_idx and dz[i] > 0.3:
            roles.append("node")
        elif i in on_corridor:
            roles.append("filament")
        elif dz[i] < -1.3:
            roles.append("isolated")
        else:
            roles.append("field")
    for b in branches:
        members = np.where(branch_of == b["idx"])[0]
        b["core_project"] = int(members[np.argmax(dz[members])]) if len(members) and not b["is_frontier"] else None

    # cumulative cohorts: structure formation
    timeline = []
    for c in range(len(cohorts)):
        idx = np.where(cohort_of <= c)[0]
        if len(idx) < 8:
            continue
        cor, alt_c, _, _ = _analyse_corridors(idx, W, D, branch_of, frontier_idx, refsets, cohort_of, dz, rng)
        vd = _voids(P2, idx, Z, branch_of, frontier_idx, nn_scale, rng)
        timeline.append({
            "upto": c, "label": " + ".join(cohorts[: c + 1]), "n": int(len(idx)),
            "corridors": [{k_: x[k_] for k_ in ("branches", "path", "support", "status")} for x in cor],
            "voids": [{k_: x[k_] for k_ in ("xy", "radius", "support", "status", "circles")} for x in vd],
        })

    # per-cohort clustering against the whole programme
    iu = np.triu_indices(n, 1)
    D_all = D[iu]
    bins = np.linspace(0, float(np.percentile(D_all, 99)), 9)
    cstats = []
    for c, name in enumerate(cohorts):
        idx = np.where(cohort_of == c)[0]
        if len(idx) < 4:
            continue
        mst_mean = float(np.mean([w for _, _, w in _mst(D, idx)]))
        null = [np.mean([w for _, _, w in _mst(D, rng.choice(n, len(idx), replace=False))]) for _ in range(60)]
        sub = D[np.ix_(idx, idx)][np.triu_indices(len(idx), 1)]
        cstats.append({
            "cohort": name, "n": int(len(idx)),
            "mst_mean_edge": round(mst_mean, 4),
            "mst_z": round(float((mst_mean - np.mean(null)) / (np.std(null) or 1)), 2),
            "xi": _xi(sub, D_all, bins),
            "branches": int(len(set(branch_of[idx].tolist()) - {frontier_idx})),
        })

    robust_c = sum(c["status"] == "robust" for c in corridors)
    robust_v = sum(v["status"] == "robust" for v in voids)
    log(f"08b structure: {len(corridors)} corridors ({robust_c} robust over {BOOT_RUNS} bootstrap runs, {len(alt)} alternative), "
        f"{len(voids)} voids ({robust_v} robust and empty in 64D), roles {dict(Counter(roles))}")
    return {
        "method": {"k": k, "boot_runs": BOOT_RUNS, "boot_drop": BOOT_DROP, "void_min_radius_nn": VOID_MIN_R,
                   "distance": "cosine x (1 - 0.5 x shared-reference Jaccard)", "nn_scale": round(nn_scale, 4)},
        "density_z": [round(float(x), 2) for x in dz],
        "roles": roles,
        "mst": [[a, b, round(w, 4)] for a, b, w in edges],
        "corridors": corridors,
        "alt_corridors": alt,
        "voids": voids,
        "field": field,
        "timeline": timeline,
        "cohorts": cstats,
        "xi_bins": [round(float(b), 3) for b in bins],
    }


def structure_report(meta: dict) -> list[str]:
    s = meta.get("structure")
    if not s:
        return []
    bn = {b["idx"]: b["name"] for b in meta["branches"]}
    P = meta["projects"]
    L = ["## Structure (cosmic-web analysis)", "",
         "Tools from cosmology that find structure in a cloud of points. Corridors and densities use the 64D embedding, not the 2D map.", "",
         "### Corridors between branches", "", "| Branches | Bridge projects | Support | Separation | Status |", "|---|---|---|---|---|"]
    for c in s["corridors"]:
        mid = "; ".join(P[i]["title"] for i in c["bridge"])
        L.append(f"| {bn[c['branches'][0]]} ↔ {bn[c['branches'][1]]} | {mid} | {c['support']:.0%} | {c['separation']} | {c['status']} |")
    for a in s.get("alt_corridors", []):
        L.append(f"| {bn[a['branches'][0]]} ↔ {bn[a['branches'][1]]} | (only in some bootstrap runs) | {a['support']:.0%} | — | alternative |")
    L += ["", "Separation = the jump between the two branches ÷ the median step inside a branch. Support = share of 40 bootstrap runs "
          "(15% of projects removed) that join the same two branches.", "",
          "### Voids", "", "| Between | Radius (× neighbour distance) | Support | 64D emptiness | Status | Linked gap |", "|---|---|---|---|---|---|"]
    for v in s["voids"]:
        near = " / ".join(bn[b] for b in v["branches"]) or "frontier"
        L.append(f"| {near} | {v['size_nn']} | {v['support']:.0%} | {v['emptiness_64d']} | {v['status']} | {v['gap'] or '—'} |")
    L += ["", "A void is the largest empty circle between projects (Delaunay). 64D emptiness = distance from the mean of its rim projects "
          "to the nearest project ÷ the median neighbour distance. At 1.2 or more the hole is also empty in meaning, not only on the map.", "",
          "### Cohorts", "", "| Cohort | Projects | MST mean edge | z vs programme | Branches |", "|---|---|---|---|---|"]
    for c in s["cohorts"]:
        L.append(f"| {c['cohort']} | {c['n']} | {c['mst_mean_edge']} | {c['mst_z']} | {c['branches']} |")
    L += ["", "A negative z means the cohort is more clustered than a random set of the same size from the whole programme.", ""]
    return L
