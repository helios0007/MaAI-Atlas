"""
MaAI Atlas pipeline entry point.

    python -m pipeline.run                         # synthetic demo corpus (default)
    python -m pipeline.run --source blog           # records from data/curated/projects_blog.json
    python -m pipeline.run --mesh model.glb        # sample a real Sagrada Família mesh instead of the parametric one
    python -m pipeline.run --points 60000          # lighter point cloud
"""

from __future__ import annotations

import argparse
import json
import time
import warnings
from pathlib import Path

from .basilica_geometry import build_parametric_sagrada_familia, load_external_mesh_points
from .build_atlas import CURATED, build
from .synth_corpus import build_synthetic_corpus


def load_blog_corpus(fetch_repos: bool = False) -> dict:
    path = CURATED / "projects_blog.json"
    if not path.exists():
        raise SystemExit(f"{path} not found. Run: python -m pipeline.ingest_iaac_blog")
    projects = json.loads(path.read_text(encoding="utf-8"))["projects"]
    approved = [p for p in projects if p.get("review", {}).get("status") in ("approved", "pending")]
    cohorts = sorted({p["cohort"] for p in approved if p["cohort"] != "unknown"}) or ["unknown"]
    for p in approved:
        p.setdefault("work_type", "studio")
        if p["cohort"] == "unknown":
            p["cohort"] = cohorts[-1]
    if fetch_repos:
        from .repos import fetch_repo_signals
        for p in approved:
            if p.get("repo") and "signals" not in p["repo"]:
                try:
                    p["repo"] = fetch_repo_signals(p["repo"]["url"])
                    print(f"  repo ok  {p['repo']['url']}")
                except Exception as exc:  # private, deleted or rate-limited
                    print(f"  repo skip {p['repo']['url']} ({exc.__class__.__name__})")
    print(f"  loaded {len(approved)} blog records (external literature sample is empty until OpenAlex is connected)")
    return {"projects": approved, "cohorts": cohorts, "external": []}


def main() -> None:
    warnings.filterwarnings("ignore")
    ap = argparse.ArgumentParser(description="Build the MaAI Atlas data files.")
    ap.add_argument("--source", choices=["synthetic", "blog"], default="synthetic")
    ap.add_argument("--mesh", type=Path, default=None, help="Optional .glb/.obj/.stl/.ply to sample (needs trimesh).")
    ap.add_argument("--points", type=int, default=80000)
    ap.add_argument("--fetch-repos", action="store_true", help="With --source blog: score linked GitHub repos via the API (set GITHUB_TOKEN).")
    args = ap.parse_args()

    t0 = time.time()
    print("Geometry")
    if args.mesh:
        pts, zones = load_external_mesh_points(args.mesh, args.points)
        geo = f"mesh:{args.mesh.name}"
    else:
        pts, zones = build_parametric_sagrada_familia(args.points)
        geo = "parametric_gaudi_v2"
    print(f"  {len(pts):,} points ({geo})")

    print("Corpus")
    corpus = build_synthetic_corpus() if args.source == "synthetic" else load_blog_corpus(args.fetch_repos)
    print(f"  {len(corpus['projects'])} projects, {len(corpus.get('external', []))} external docs, cohorts {corpus['cohorts']}")

    print("Pipeline")
    build(corpus, pts, zones, f"{args.source}+{geo}")
    print(f"Done in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()
