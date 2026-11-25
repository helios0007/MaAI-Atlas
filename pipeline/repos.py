"""
Stage 05: repository analysis and reproducibility rubric.

For real projects, `fetch_repo_signals` reads a GitHub repository through the
REST API (set GITHUB_TOKEN to avoid the 60 requests/hour anonymous limit).
For synthetic projects, signals are already present on the record.

Rubric (one point each, 0-6):
  readme           README with more than a title
  dependencies     requirements.txt / environment.yml / pyproject.toml / package.json / setup.py
  pinned_versions  dependency file pins versions (==, lock file)
  data_available   data folder, data link in README, or download script
  licence          a licence GitHub recognises
  entry_point      main script, notebook or documented run command
"""

from __future__ import annotations

import os
import re

import requests

from . import taxonomy as tx

RUBRIC = [
    ("readme", "README"),
    ("dependencies", "Dependencies"),
    ("pinned_versions", "Pinned versions"),
    ("data_available", "Data available"),
    ("licence", "Licence"),
    ("entry_point", "Entry point"),
]

DEP_FILES = {"requirements.txt", "environment.yml", "environment.yaml", "pyproject.toml", "package.json", "setup.py", "pipfile"}
LOCK_FILES = {"poetry.lock", "package-lock.json", "pipfile.lock", "uv.lock", "conda-lock.yml"}
ENTRY_RE = re.compile(r"^(main|app|run|train|demo)\.(py|ipynb|js)$|\.ipynb$|\.gh$|\.ghx$", re.IGNORECASE)


def score(signals: dict) -> int:
    return int(sum(bool(signals.get(k)) for k, _ in RUBRIC))


def summarize(project: dict) -> str:
    """Three-line stack / data / status summary. Template baseline; an LLM can replace it."""
    repo = project.get("repo") or {}
    sig = repo.get("signals", {})
    stack = ", ".join(tx.tool_label(t) for t in project.get("tools", [])[:5]) or "unknown stack"
    data = ", ".join(tx.data_label(d) for d in project.get("data", [])) or "data not stated"
    s = score(sig)
    status = "likely reproducible" if s >= 5 else "partly reproducible" if s >= 3 else "hard to reproduce"
    missing = [label for key, label in RUBRIC if not sig.get(key)]
    tail = f" Missing: {', '.join(missing).lower()}." if missing else ""
    return f"Stack: {stack}. Data: {data}. Status: {status} ({s}/6).{tail}"


def fetch_repo_signals(url: str, token: str | None = None) -> dict:
    m = re.match(r"https?://github\.com/([^/]+)/([^/#?]+)", url)
    if not m:
        raise ValueError(f"Not a GitHub repo URL: {url}")
    owner, name = m.groups()
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "maai-atlas-prototype"}
    token = token or os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    api = f"https://api.github.com/repos/{owner}/{name}"

    info = requests.get(api, headers=headers, timeout=30)
    info.raise_for_status()
    info = info.json()
    langs = requests.get(f"{api}/languages", headers=headers, timeout=30).json()
    contents = requests.get(f"{api}/contents", headers=headers, timeout=30)
    files = [c["name"] for c in contents.json()] if contents.ok else []
    lower = {f.lower() for f in files}

    readme_text = ""
    r = requests.get(f"{api}/readme", headers={**headers, "Accept": "application/vnd.github.raw"}, timeout=30)
    if r.ok:
        readme_text = r.text

    pinned = bool(lower & LOCK_FILES)
    if "requirements.txt" in lower:
        req = requests.get(f"{api}/contents/requirements.txt", headers={**headers, "Accept": "application/vnd.github.raw"}, timeout=30)
        if req.ok:
            lines = [ln for ln in req.text.splitlines() if ln.strip() and not ln.startswith("#")]
            pinned = pinned or (bool(lines) and sum("==" in ln for ln in lines) / len(lines) > 0.6)

    signals = {
        "readme": len(readme_text.strip()) > 200,
        "dependencies": bool(lower & DEP_FILES),
        "pinned_versions": pinned,
        "data_available": "data" in lower or bool(re.search(r"(dataset|download|zenodo|kaggle|drive\.google)", readme_text, re.I)),
        "licence": bool(info.get("license")),
        "entry_point": any(ENTRY_RE.search(f) for f in files) or bool(re.search(r"```(bash|sh|shell)?\s*\n\s*(python|npm|conda|pip)", readme_text)),
    }
    return {
        "url": url,
        "signals": signals,
        "languages": sorted(langs, key=lambda k: -langs[k])[:5],
        "last_commit": (info.get("pushed_at") or "")[:10],
        "stars": info.get("stargazers_count", 0),
    }
