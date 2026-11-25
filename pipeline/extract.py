"""
Stage 03 (baseline): taxonomy keyword extraction with evidence.

Tags free text (blog posts, abstracts) with methods, data, tools and domains
from taxonomy.py and keeps the sentence each tag came from, so a reviewer can
confirm it quickly. This is the no-API baseline. An LLM extractor with
structured output can replace it later; it must return the same shape.
"""

from __future__ import annotations

import re

from . import taxonomy as tx

DOMAIN_KEYWORDS = {
    "urban-mobility": ["mobility", "transit", "transport", "bike", "walkab", "accessibility", "15-minute", "isochrone", "traffic"],
    "urban-morphology": ["morpholog", "urban form", "block", "parcel", "density", "informal settlement", "street network"],
    "public-space": ["public space", "square", "streetscape", "pedestrian", "plaza", "vitality"],
    "floor-plan-layout": ["floor plan", "floorplan", "layout", "apartment", "room adjacency"],
    "facade-design": ["facade", "façade", "envelope design", "elevation"],
    "massing": ["massing", "form-finding", "form finding", "volumetric", "zoning envelope"],
    "urban-climate": ["heat island", "urban heat", "thermal comfort", "utci", "microclimate", "land surface temperature", "heatwave", "cooling"],
    "building-energy": ["energy demand", "energy consumption", "energy performance", "retrofit", "heating and cooling", "operational energy", "embodied carbon"],
    "air-quality": ["air quality", "pm2.5", "pollution", "no2"],
    "robotic-fabrication": ["robotic fabrication", "robot arm", "toolpath", "3d printing", "additive manufacturing", "milling", "kuka", "abb"],
    "materials": ["mycelium", "timber", "earth", "clay", "bio-based", "reclaimed", "biomaterial", "material"],
    "construction-monitoring": ["construction site", "defect", "inspection", "progress monitoring"],
    "building-codes": ["building code", "regulation", "compliance", "zoning law", "permit"],
    "design-knowledge": ["precedent", "knowledge base", "archive", "ontology", "design knowledge"],
    "education": ["education", "studio teaching", "students learn", "pedagog"],
    "post-occupancy": ["post-occupancy", "occupant", "building operation"],
}

SCALE_KEYWORDS = {
    "region": ["region", "metropolitan", "territor", "national"],
    "city": ["city", "urban", "municipal", "district"],
    "block": ["block", "neighbourhood", "neighborhood", "street", "superblock"],
    "building": ["building", "apartment", "floor plan", "facade", "façade", "house"],
    "object": ["prototype", "component", "brick", "panel", "joint", "robot", "furniture", "pavilion"],
}

GITHUB_RE = re.compile(r"https?://(?:www\.)?github\.com/([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)")
SENT_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _pattern(syn: str) -> re.Pattern:
    # Short acronyms (RAG, GAN, OSM, ROS...) only match in upper case to avoid names and common words.
    if len(syn) <= 4 and syn.isalpha():
        return re.compile(rf"\b{re.escape(syn.upper())}\b")
    return re.compile(rf"\b{re.escape(syn)}", re.IGNORECASE)


_METHOD_PATTERNS = {k: [_pattern(s) for s in v[2]] for k, v in tx.METHODS.items()}
_DATA_PATTERNS = {k: [_pattern(s) for s in v[1]] for k, v in tx.DATA.items()}
_TOOL_PATTERNS = {k: [_pattern(s) for s in v[1]] for k, v in tx.TOOLS.items()}
_DOMAIN_PATTERNS = {k: [re.compile(re.escape(s), re.IGNORECASE) for s in v] for k, v in DOMAIN_KEYWORDS.items()}


def _tag(sentences: list[str], patterns: dict[str, list[re.Pattern]], min_hits: int = 1) -> list[dict]:
    out = []
    for key, pats in patterns.items():
        hits = [s for s in sentences if any(p.search(s) for p in pats)]
        if len(hits) >= min_hits:
            out.append({"id": key, "evidence": hits[0][:240], "hits": len(hits)})
    return sorted(out, key=lambda d: -d["hits"])


def extract_fields(text: str) -> dict:
    """Return tagged fields with evidence sentences and a heuristic scale."""
    sentences = [s.strip() for s in SENT_SPLIT.split(text) if len(s.strip()) > 20]
    methods = _tag(sentences, _METHOD_PATTERNS)
    data = _tag(sentences, _DATA_PATTERNS)
    tools = _tag(sentences, _TOOL_PATTERNS)
    domains = _tag(sentences, _DOMAIN_PATTERNS, min_hits=1)[:3]

    low = text.lower()
    scale_scores = {s: sum(low.count(k) for k in kws) for s, kws in SCALE_KEYWORDS.items()}
    scale = max(scale_scores, key=scale_scores.get) if any(scale_scores.values()) else None

    return {
        "methods": methods,
        "data": data,
        "tools": tools,
        "domains": domains,
        "scale": scale,
        "github": find_github_links(text),
    }


def find_github_links(text: str) -> list[str]:
    seen = []
    for owner, repo in GITHUB_RE.findall(text):
        repo = re.sub(r"\.git$", "", repo).rstrip(".")
        if owner.lower() in {"features", "about", "orgs", "topics", "sponsors"}:
            continue
        url = f"https://github.com/{owner}/{repo}"
        if url not in seen:
            seen.append(url)
    return seen
