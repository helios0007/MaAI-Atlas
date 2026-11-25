"""
Stage 00-03 for real data: IAAC Blog connector.

Fetches MaAI posts from blog.iaac.net through the public WordPress REST API,
converts them to the Atlas project schema, tags methods/data/tools/domains with
evidence (extract.py) and collects GitHub links for Stage 05.

    python -m pipeline.ingest_iaac_blog --dry-run          # list categories and post counts only
    python -m pipeline.ingest_iaac_blog --limit 10         # fetch 10 posts
    python -m pipeline.ingest_iaac_blog                    # fetch all MaAI posts

Output:
    data/raw/iaac_blog/<post_id>.json      raw API response (never edited)
    data/curated/projects_blog.json        records in the Atlas schema, review status "pending"

Be polite: one request per second, a generic User-Agent, and stop if the site asks you to.
Check with IAAC before publishing anything derived from these posts.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import time
from html.parser import HTMLParser
from pathlib import Path

import requests

from .extract import extract_fields, find_github_links

API = "https://blog.iaac.net/wp-json/wp/v2"
HEADERS = {"User-Agent": "maai-atlas-prototype/0.2 (research prototype)"}
ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "iaac_blog"
OUT = ROOT / "data" / "curated" / "projects_blog.json"

# Category slug -> cohort label. These are assumptions: confirm with the programme.
COHORT_BY_CATEGORY_SUFFIX = {"-01": "24/25", "-02": "25/26"}
DEFAULT_COHORT = "unknown"


class _TextAndLinks(HTMLParser):
    """Minimal HTML -> text converter that keeps paragraph breaks and hrefs."""

    BLOCK = {"p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6", "tr", "figcaption", "blockquote"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self.links: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style"}:
            self._skip += 1
        if tag == "a":
            href = dict(attrs).get("href")
            if href:
                self.links.append(href)
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style"} and self._skip:
            self._skip -= 1
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)

    def text(self) -> str:
        t = html.unescape("".join(self.parts))
        t = re.sub(r"[ \t\xa0]+", " ", t)
        return re.sub(r"\n\s*\n+", "\n\n", t).strip()


def html_to_text(raw_html: str) -> tuple[str, list[str]]:
    p = _TextAndLinks()
    p.feed(raw_html or "")
    return p.text(), p.links


def get(session: requests.Session, path: str, params: dict) -> requests.Response:
    r = session.get(f"{API}/{path}", params=params, headers=HEADERS, timeout=30)
    if r.status_code == 429:
        raise SystemExit("The blog asked us to slow down (HTTP 429). Stopping.")
    r.raise_for_status()
    time.sleep(1.0)
    return r


def maai_categories(session: requests.Session) -> list[dict]:
    r = get(session, "categories", {"search": "Master in AI for Architecture", "per_page": 50,
                                     "_fields": "id,name,slug,count"})
    return [c for c in r.json() if c["slug"].startswith("maai-")]


def cohort_for(categories: list[int], cat_by_id: dict[int, dict]) -> str:
    for cid in categories:
        slug = cat_by_id.get(cid, {}).get("slug", "")
        for suffix, label in COHORT_BY_CATEGORY_SUFFIX.items():
            if slug.endswith(suffix):
                return label
    return DEFAULT_COHORT


PEOPLE_RE = {
    "students": re.compile(r"(?:Students?|Authors?|Team)\s*[:\-–]\s*(.+)", re.IGNORECASE),
    "faculty": re.compile(r"(?:Faculty|Tutors?|Supervisors?|Advisors?)\s*[:\-–]\s*(.+)", re.IGNORECASE),
}
REF_HEAD = re.compile(r"^\s*(References|Bibliography|Sources)\s*:?\s*$", re.IGNORECASE | re.MULTILINE)


def split_people(line: str) -> list[str]:
    names = re.split(r",|;|&| and ", line)
    return [n.strip(" .") for n in names if 2 < len(n.strip()) < 60][:8]


def post_to_record(post: dict, cat_by_id: dict[int, dict]) -> dict:
    text, links = html_to_text(post.get("content", {}).get("rendered", ""))
    title = html.unescape(re.sub("<[^>]+>", "", post["title"]["rendered"])).strip()
    excerpt, _ = html_to_text(post.get("excerpt", {}).get("rendered", ""))

    people = {k: [] for k in PEOPLE_RE}
    for line in text.splitlines()[:60] + text.splitlines()[-40:]:
        for k, rx in PEOPLE_RE.items():
            m = rx.match(line.strip())
            if m and not people[k]:
                people[k] = split_people(m.group(1))

    paragraphs = [p.strip() for p in text.split("\n\n") if len(p.strip()) > 160]
    abstract = " ".join(paragraphs[:2]) if paragraphs else excerpt

    refs = []
    m = REF_HEAD.search(text)
    if m:
        refs = [ln.strip() for ln in text[m.end():].splitlines() if len(ln.strip()) > 25][:80]

    fields = extract_fields(f"{title}. {text}")
    repos = find_github_links(" ".join(links)) or fields["github"]

    return {
        "id": f"blog-{post['id']}",
        "synthetic": False,
        "title": title,
        "students": people["students"],
        "faculty": people["faculty"],
        "cohort": cohort_for(post.get("categories", []), cat_by_id),
        "work_type": None,  # set during review: thesis | studio | seminar | workshop
        "abstract": abstract[:2000],
        "full_text": text,
        "methods": [t["id"] for t in fields["methods"][:4]],
        "data": [t["id"] for t in fields["data"][:4]],
        "tools": [t["id"] for t in fields["tools"][:6]],
        "scale": fields["scale"],
        "domains": [t["id"] for t in fields["domains"]],
        "evidence": {k: fields[k] for k in ("methods", "data", "tools", "domains")},
        "raw_references": refs,
        "repo": {"url": repos[0]} if repos else None,
        "all_repo_links": repos,
        "sources": [{"type": "blog", "url": post["link"], "date": post["date"]}],
        "consent": {"public": None, "show_names": None},
        "review": {"status": "pending"},
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Fetch MaAI posts from the IAAC blog.")
    ap.add_argument("--limit", type=int, default=0, help="Stop after this many posts (0 = all).")
    ap.add_argument("--dry-run", action="store_true", help="Only list categories and post counts.")
    args = ap.parse_args()

    s = requests.Session()
    cats = maai_categories(s)
    cat_by_id = {c["id"]: c for c in cats}
    for c in cats:
        print(f"  category {c['id']:>6}  {c['count']:>4} posts  {c['slug']}")
    if args.dry_run or not cats:
        return

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    records, page = [], 1
    ids = ",".join(str(c["id"]) for c in cats)
    while True:
        r = get(s, "posts", {"categories": ids, "per_page": 20, "page": page,
                             "_fields": "id,date,link,title,content,excerpt,categories,tags"})
        posts = r.json()
        for post in posts:
            (RAW_DIR / f"{post['id']}.json").write_text(json.dumps(post, ensure_ascii=False, indent=1), encoding="utf-8")
            records.append(post_to_record(post, cat_by_id))
            print(f"  [{len(records):>3}] {records[-1]['cohort']:>7}  {records[-1]['title'][:70]}")
            if args.limit and len(records) >= args.limit:
                break
        total_pages = int(r.headers.get("X-WP-TotalPages", page))
        if (args.limit and len(records) >= args.limit) or page >= total_pages:
            break
        page += 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"projects": records}, ensure_ascii=False, indent=1), encoding="utf-8")
    with_repo = sum(1 for r in records if r["repo"])
    print(f"Wrote {len(records)} records ({with_repo} with a GitHub link) -> {OUT}")


if __name__ == "__main__":
    main()
