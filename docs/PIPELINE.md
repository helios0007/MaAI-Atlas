# MaAI Atlas pipeline

How the data is built, what each stage assumes, and how to add a cohort.

## Schema (one project, after Stage 05)

```json
{
  "id": "blog-170222",
  "synthetic": false,
  "title": "…",
  "students": ["…"], "faculty": ["…"],
  "cohort": "25/26",
  "work_type": "thesis | studio | seminar | workshop",
  "abstract": "…",
  "methods": ["gnn"], "data": ["osm"], "tools": ["pytorch"],
  "scale": "object | building | block | city | region",
  "domains": ["urban-mobility"],
  "evidence": {"methods": [{"id": "gnn", "evidence": "sentence it came from", "hits": 2}]},
  "raw_references": ["Kipf et al. (2017). Semi-Supervised…"],
  "repo": {"url": "…", "signals": {"readme": true, "dependencies": true, "pinned_versions": false,
           "data_available": false, "licence": true, "entry_point": true}, "languages": ["Python"], "last_commit": "2025-06-01"},
  "sources": [{"type": "blog", "url": "…", "date": "…"}],
  "consent": {"public": null, "show_names": null},
  "review": {"status": "pending | approved"}
}
```

All list values are ids from `pipeline/taxonomy.py`. Adding a term means adding it there (with synonyms) and re-running.

## Stage notes

**00–01 Ingest and parse (`ingest_iaac_blog.py`).** WordPress REST API, MaAI categories found by slug prefix `maai-`. HTML is converted with the standard library, keeping links. Students and faculty are read from lines starting with "Students:", "Faculty:" etc. A "References" heading starts the reference list. Thesis PDFs will need GROBID (not built yet).

**02 Resolve (not built).** One project can appear as a blog post, a PDF and a repo. Merge by cohort + student-name overlap + title and text similarity, with uncertain merges sent to review.

**03 Extract (`extract.py`).** Baseline: taxonomy synonyms matched sentence by sentence; each tag keeps the sentence it came from. Short acronyms (RAG, GAN, OSM, ROS) match only in capitals. In the offline test on 40 blog-shaped records, 38 got at least one correct method. Domains are over-tagged; the review step fixes them. An LLM extractor with structured output can replace this if it returns the same shape.

**04 Cite.** References are parsed into author, year, title and venue (four common styles), then merged when they share a year and ≥80% of their content words. The cleanest rendering becomes canonical. On the synthetic corpus, 1,467 raw strings in four styles collapse to exactly the 50 underlying works. Real pipeline: resolve to DOIs through OpenAlex.

**05 Repos (`repos.py`).** GitHub REST API: languages, root files, README, licence, requirements pins. Rubric: README, dependencies, pinned versions, data available, licence, entry point (0–6).

**06 Embed.** TF-IDF (unigrams + bigrams, English stop words, sublinear tf), then 64-dimensional truncated SVD, L2-normalised. Chosen because the browser can reproduce it exactly (verified: cosine 1.0000 between JS and Python vectors). A neural embedding model would need transformers.js in the browser for search; compare both with a faculty-written query set before switching.

**07 Layout and branches.** UMAP 2D (cosine, 12 neighbours) for the map. HDBSCAN on an 8D UMAP for branches. Outliers become "Bridging & Frontier Projects". Stability = mean adjusted Rand index against 4 other seeds (0.96 on the synthetic corpus). On synthetic data the hidden themes are recovered with ARI 0.93. Names are drafts for faculty to approve.

**08 Gaps.** Four detectors, each with evidence:
- *Sparse region:* kernel density on the 2D map; low-density cells 1.4–3.2 bandwidths from the nearest project, with at least two branches (≥2 projects each) nearby. One per branch pair.
- *Untested combination:* method family × domain counts; empty cells whose independence expectation is ≥1.
- *External topic:* external abstracts embedded in the same space; low-coverage ones clustered (agglomerative, cosine). Synthetic external sample now; OpenAlex later.
- *Fading branch:* share of the latest cohort below 65% of the first.

**10 Basilica rules.**
1. Core branches ranked by size → zones 0–4 ranked by point capacity; extra branches share zones.
2. Frontier projects and between-branch gaps → zone 5 (Glory Façade & Tower of Jesus Christ).
3. Zone built share = projects ÷ (projects + gap weight). Gap weights in project-equivalents: sparse region 4, untested 1.5 × expected (max 4), external 0.5 per paper (max 8), fading 3.
4. Built points laid bottom-up in cohort order; equal share per project, +8% per rubric point.
5. In 2D, stones sit at their project's map position and scaffold sits on its gap.

## Adding a cohort

1. Run the blog connector (or collect the submission JSON exported from the Atlas's "Add project" drawer).
2. Review `data/curated/projects_blog.json`: work type, cohort, tags, consent. Set `review.status` to `approved`.
3. `python -m pipeline.run --source blog --fetch-repos`.
4. Check `reports/gap_report.md` and the branch names with faculty.

Note: the layout is currently re-fit on every run, so positions can shift between cohorts. Before real use, save the UMAP model and place new projects with `transform()`, re-fitting once a year.

## Not built yet

- Stage 02 merging, GROBID for thesis PDFs, OpenAlex for DOIs and the external literature sample
- LLM extraction and LLM-written branch descriptions
- A shared submission backend (today: browser storage + JSON export)
- Saved UMAP model for stable positions across cohorts
