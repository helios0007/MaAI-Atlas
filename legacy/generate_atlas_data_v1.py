"""
MaAI Atlas — High-Detail Sagrada Família Point Cloud & Synthetic Corpus Generator
=================================================================================
Generates an ~80,000-point architectural point cloud of Antoni Gaudí's
Sagrada Família with articulated towers, trencadís pinnacles, louver bands,
Nativity cypress gables, Passion slanted portico columns, Glory portal arches,
scalloped nave vaults, clerestory bays, branching tree columns, 7 radiating apse
chapels, skybridges, Virgin Mary star, and the 172.5m Tower of Jesus Christ.

Also supports sampling any external .glb / .obj / .stl / .ply mesh via --mesh.

Outputs (written to ./data/):
  data/atlas_meta.json  -- branches, projects, cohort stats
  data/points.bin       -- Float32Array (N * 13 floats):
                           [bx, by, bz, ux, uy, uz, r, g, b, cohort_id, built, proj_idx, branch_idx]

Usage:
  python generate_atlas_data.py
  python generate_atlas_data.py --points 80000
  python generate_atlas_data.py --mesh path/to/sagrada_familia.glb --points 60000
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import numpy as np

RNG = np.random.default_rng(42)

# ---------------------------------------------------------------------------
# 1. MaAI Research Branches (mapped to Sagrada Família architectural zones)
# ---------------------------------------------------------------------------
BRANCHES = [
    {
        "id": "urban",
        "name": "Urban Analytics & Mobility",
        "zone": "Nativity Façade & East Transept",
        "color": "#2DD4BF",
        "umap_center": [-38.0, 22.0],
        "methods": ["GNN", "Random Forest", "XGBoost", "Spatial Clustering", "Agent-Based Model"],
        "datasets": ["OSM", "Copernicus Urban Atlas", "Mobile Telemetry", "GTFS", "Street View"],
    },
    {
        "id": "generative",
        "name": "Generative Design & Spatial AI",
        "zone": "Passion Façade & West Transept",
        "color": "#FB923C",
        "umap_center": [36.0, 18.0],
        "methods": ["Diffusion Model", "ControlNet", "3D Gaussian Splatting", "GAN", "LLM Agent"],
        "datasets": ["Floorplan Corpus", "RPLAN", "Objaverse", "Synthetic Rhino", "Architectural Plans"],
    },
    {
        "id": "climate",
        "name": "Climate, Energy & Environment",
        "zone": "Evangelist Towers & Crossing",
        "color": "#34D399",
        "umap_center": [-24.0, -26.0],
        "methods": ["Physics Surrogate", "PINN", "CNN", "Time-Series Transformer", "EnergyPlus + ML"],
        "datasets": ["ERA5-Land", "Landsat LST", "EPW Weather", "Sentinel-2", "Open Buildings 2.5D"],
    },
    {
        "id": "fabrication",
        "name": "Robotics, Materiality & Fabrication",
        "zone": "Central Nave, Vaults & Tree Columns",
        "color": "#A78BFA",
        "umap_center": [24.0, -24.0],
        "methods": ["Reinforcement Learning", "Computer Vision", "Inverse Kinematics", "PointNet++"],
        "datasets": ["Robotic Toolpaths", "3D Clay Scans", "Timber Scans", "Depth Sensors"],
    },
    {
        "id": "foundations",
        "name": "AI Methods, Knowledge & Theory",
        "zone": "Apse & Tower of the Virgin Mary",
        "color": "#38BDF8",
        "umap_center": [0.0, 42.0],
        "methods": ["RAG", "Knowledge Graph", "Semantic Embeddings", "Multimodal VLM", "Fine-Tuning"],
        "datasets": ["IAAC Archive", "OpenAlex", "Building Codes", "BIM / IFC Graphs"],
    },
    {
        "id": "frontier",
        "name": "Research Gaps & Emerging Frontier",
        "zone": "Glory Façade & Tower of Jesus Christ",
        "color": "#FACC15",
        "umap_center": [2.0, -4.0],
        "methods": ["Causal Inference", "World Models", "Embodied AI", "Neuro-Symbolic"],
        "datasets": ["Post-Occupancy Sensors", "Longitudinal Urban Twins", "Open Embodied Logs"],
    },
]

TITLE_PREFIXES = {
    "urban": [
        "Curbside Intensification", "Walkability Surrogates", "15-Minute Isochrones",
        "Transit Equity Graph", "Micro-Mobility Flows", "Heat-Aware Routing",
        "Streetscape Vitality", "Parcel Land-Use Drift", "Pedestrian Canopy Atlas",
        "Informal Settlement Morphometrics", "Nighttime Urban Pulse", "Block Permeability",
    ],
    "generative": [
        "Parametric Massing Diffusion", "Plan-to-Section VLM", "Adaptive Reuse Layouts",
        "Daylight-Guided Floorplans", "Tectonic Grammar Agents", "Facade LoRA Synthesis",
        "Courtyard Typology Latent Space", "Spatial Graph to BIM", "Zero-Shot Zoning",
        "Modular Timber Configurator", "Acoustic Shell Generator", "Vernacular Prompting",
    ],
    "climate": [
        "SURROUND PM2.5", "OASIS Heat Resilience", "Urban Canyon UTCI",
        "Passive Cooling Surrogate", "Roof Albedo Microclimate", "Flood-Resilient Blocks",
        "Solar Envelope Predictor", "Night-Ventilation Optimizer", "Tree Canopy Cooling",
        "Building-Scale LST Downscaling", "Embodied Carbon Estimator", "Wind Comfort GNN",
    ],
    "fabrication": [
        "Robotic Clay Extrusion CV", "Adaptive Timber Milling", "Stone Stereotomy RL",
        "Vision-Guided Assembly", "Mycelium Growth Tracking", "3D Concrete Defect Net",
        "Reclaimed Steel Sorting", "Drone Masonry Inspection", "Biopolymer Toolpathing",
        "Kuka Force-Feedback Carving", "Tensegrity Form-Finding", "Bio-Brick Curing Model",
    ],
    "foundations": [
        "MaAI Semantic Knowledge Graph", "IFC Code-Compliance RAG", "Architectural Ontology",
        "Multimodal Jury Critique", "Design Precedent Retrieval", "Sketch-to-Query Search",
        "Zoning Law Extractor", "Open-Source AEC Benchmarks", "Citation Lineage Mapper",
        "Prompt-to-Grasshopper Compiler", "Spatial Reasoning Eval", "Design Brief Parser",
    ],
    "frontier": [
        "Causal Passive Cooling Twins", "Embodied Construction World Model",
        "Neuro-Symbolic Structural Code", "Post-Occupancy Adaptive Facades",
        "Longitudinal Neighbourhood Drift", "Multi-Agent Urban Negotiation",
    ],
}

COHORTS = ["24/25", "25/26", "26/27"]
WORK_TYPES = ["Thesis (MaAI-02)", "Studio", "Seminar", "Hackathon"]


def hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4))


# ---------------------------------------------------------------------------
# 2. High-Detail Parametric Gaudí Architectural Primitives (meters, Y = up)
# ---------------------------------------------------------------------------
def sample_segment(p0: np.ndarray, p1: np.ndarray, n: int, radius: float = 0.25) -> np.ndarray:
    """Sample a cylindrical/ribbed structural element between p0 and p1."""
    t = RNG.random(n)[:, None]
    pts = p0[None, :] * (1.0 - t) + p1[None, :] * t
    if radius > 0:
        pts += RNG.normal(0, radius, pts.shape)
    return pts


def sample_parabolic_arch(
    p0: np.ndarray, p1: np.ndarray, apex_h: float, n: int, thickness: float = 0.35
) -> np.ndarray:
    """Sample a Gaudí catenary/parabolic arch rib spanning between p0 and p1."""
    t = RNG.random(n)
    pts = p0[None, :] * (1.0 - t[:, None]) + p1[None, :] * t[:, None]
    pts[:, 1] += 4.0 * t * (1.0 - t) * apex_h
    pts += RNG.normal(0, thickness, pts.shape)
    return pts


def sample_gaudi_tower(
    cx: float, cz: float, y0: float, height: float, r_base: float, r_top: float, n: int,
    flutes: int = 12, pinnacle_h: float = 15.0, louver_bands: int = 24,
    twist: float = 0.0, lattice: bool = False, crown: str = "trencadis"
) -> np.ndarray:
    """
    Articulated Gaudí parabolic tower:
      - Vertical structural ribs (edge-concentrated for crisp silhouette)
      - Perforated louver/window bands along the parabolic shell
      - Horizontal cornice rings & lantern gallery
      - Sculptural finial crown (trencadis / tetramorph / lantern)
    """
    body_h = height - pinnacle_h
    n_ribs = int(n * 0.34)
    n_shell = int(n * 0.44)
    n_rings = int(n * 0.08)
    n_crown = n - n_ribs - n_shell - n_rings
    chunks = []

    def profile_r(t: np.ndarray) -> np.ndarray:
        # Authentic Gaudí parabolic-catenary taper
        return r_base * (1.0 - 0.85 * t) ** 0.56 + r_top * (t ** 1.15) * 0.55

    # 1. Crisp vertical ribs (flutes)
    rib_idx = RNG.integers(0, flutes, size=n_ribs)
    t_r = RNG.random(n_ribs) ** 0.92
    y_r = y0 + t_r * body_h
    th_r = (2 * math.pi * rib_idx / flutes) + twist * t_r + RNG.normal(0, 0.025, n_ribs)
    rad_r = profile_r(t_r) * (1.06 + RNG.normal(0, 0.015, n_ribs))
    chunks.append(np.column_stack([cx + rad_r * np.cos(th_r), y_r, cz + rad_r * np.sin(th_r)]))

    # 2. Perforated stone shell with Gaudí acoustic louver slots or diamond lattice
    t_s = RNG.random(int(n_shell * 1.45)) ** 0.90
    th_s = RNG.uniform(0, 2 * math.pi, len(t_s))
    if lattice:
        # Open hyperboloid diamond lattice (Virgin Mary & Jesus Christ towers)
        u = (th_s * flutes / (2 * math.pi)) + t_s * louver_bands * 0.5
        v = (th_s * flutes / (2 * math.pi)) - t_s * louver_bands * 0.5
        keep = (np.abs(np.sin(math.pi * u)) < 0.34) | (np.abs(np.sin(math.pi * v)) < 0.34) | (t_s < 0.14)
    else:
        # Slotted acoustic louver bands between ribs (Bell towers)
        band = np.sin(t_s * louver_bands * math.pi)
        rib_phase = np.abs(np.sin(th_s * flutes * 0.5))
        keep = (band > -0.18) | (rib_phase < 0.32) | (t_s < 0.16)
    t_s = t_s[keep][:n_shell]
    th_s = th_s[keep][:n_shell]
    y_s = y0 + t_s * body_h
    rad_s = profile_r(t_s) * (1.0 + 0.045 * np.cos(flutes * th_s)) * RNG.uniform(0.96, 1.01, len(t_s))
    chunks.append(np.column_stack([cx + rad_s * np.cos(th_s), y_s, cz + rad_s * np.sin(th_s)]))

    # 3. Horizontal cornice rings & lantern transition collars
    ring_levels = np.array([0.04, 0.25, 0.52, 0.78, 0.94, 1.0])
    chosen_ring = ring_levels[RNG.integers(0, len(ring_levels), size=n_rings)]
    th_c = RNG.uniform(0, 2 * math.pi, n_rings)
    rad_c = profile_r(chosen_ring) * 1.12 * RNG.uniform(0.96, 1.04, n_rings)
    y_c = y0 + chosen_ring * body_h + RNG.normal(0, 0.25, n_rings)
    chunks.append(np.column_stack([cx + rad_c * np.cos(th_c), y_c, cz + rad_c * np.sin(th_c)]))

    # 4. Sculptural finial crown
    tf = RNG.random(n_crown)
    thf = RNG.uniform(0, 2 * math.pi, n_crown)
    yf = y0 + body_h + tf * pinnacle_h
    if crown == "trencadis":
        # Two stacked Venetian-mosaic bulbs + cross/sphere finial
        bulb = (
            1.15 * np.exp(-((tf - 0.22) / 0.16) ** 2)
            + 0.92 * np.exp(-((tf - 0.58) / 0.15) ** 2)
            + 0.48 * np.exp(-((tf - 0.86) / 0.10) ** 2)
            + 0.22 * (1.0 - tf)
        )
        rf = r_top * bulb * (1.0 + 0.18 * np.cos(6 * thf))
    elif crown == "tetramorph":
        # Evangelist lantern + winged halo crown
        wing = np.where(tf > 0.55, 1.0 + 0.55 * np.abs(np.cos(2 * thf)) * np.sin((tf - 0.55) / 0.45 * math.pi), 1.0)
        rf = r_top * (0.95 * (1.0 - 0.55 * tf) + 0.35 * np.sin(tf * math.pi)) * wing
    else:
        # Tapered lantern collar
        rf = r_top * (1.05 * (1.0 - 0.5 * tf) + 0.25 * np.sin(tf * math.pi))
    chunks.append(np.column_stack([cx + rf * np.cos(thf), yf, cz + rf * np.sin(thf)]))

    return np.vstack(chunks)


def sample_faceted_wall_with_windows(
    x0: float, z0: float, x1: float, z1: float, y0: float, y1: float,
    bays: int, n: int, buttress_out: np.ndarray
) -> np.ndarray:
    """
    Articulated nave/transept wall with:
      - Stepped vertical buttress piers between bays
      - Tall pointed lancet clerestory windows (cutouts + tracery mullions)
      - Upper triangular gablet + twin pinnacles per bay
    """
    p0 = np.array([x0, 0.0, z0], dtype=np.float32)
    p1 = np.array([x1, 0.0, z1], dtype=np.float32)
    vec = p1 - p0
    length = float(np.linalg.norm(vec))
    h = y1 - y0
    chunks = []

    n_wall = int(n * 0.56)
    n_but = int(n * 0.24)
    n_gables = n - n_wall - n_but

    # 1. Wall plane with lancet window cutouts
    u = RNG.random(int(n_wall * 1.45))
    v = RNG.random(len(u))
    bay_u = (u * bays) % 1.0  # 0..1 within each bay
    # Lancet window opening in center of each bay (0.28..0.72, height 0.26..0.82)
    win_arch = 0.82 - 0.16 * ((bay_u - 0.5) / 0.22) ** 2
    in_window = (bay_u > 0.28) & (bay_u < 0.72) & (v > 0.26) & (v < win_arch)
    # Keep central rose/mullion rib inside window
    mullion = (np.abs(bay_u - 0.5) < 0.035) | (np.abs(v - 0.54) < 0.025)
    keep = (~in_window) | mullion
    u, v = u[keep][:n_wall], v[keep][:n_wall]
    wall_pts = p0[None, :] + vec[None, :] * u[:, None]
    wall_pts[:, 1] = y0 + v * h
    wall_pts += buttress_out[None, :] * RNG.normal(0, 0.28, (len(u), 1))
    chunks.append(wall_pts)

    # 2. Stepped buttress piers at bay divisions + pinnacle tips
    pier_u = np.linspace(0.0, 1.0, bays + 1)
    per_pier = max(15, n_but // len(pier_u))
    for pu in pier_u:
        base = p0 + vec * pu
        t = RNG.random(per_pier)
        y = y0 + t * (h + 6.5)
        # Buttress steps inward as it rises
        depth = (2.8 * (1.0 - 0.55 * t)) * RNG.random(per_pier)
        spread = RNG.normal(0, 0.55, per_pier)
        tang = vec / max(length, 1e-5)
        pts = base[None, :] + tang[None, :] * spread[:, None] + buttress_out[None, :] * depth[:, None]
        pts[:, 1] = y
        chunks.append(pts)

    # 3. Triangular gablets crowning each bay along the roofline
    per_bay = max(20, n_gables // bays)
    for b in range(bays):
        u_mid = (b + 0.5) / bays
        u_l = (b + 0.08) / bays
        u_r = (b + 0.92) / bays
        pl = p0 + vec * u_l; pl[1] = y1
        pr = p0 + vec * u_r; pr[1] = y1
        pa = p0 + vec * u_mid + buttress_out * 0.4; pa[1] = y1 + 8.5
        # Sample triangular gable shell + crisp edges
        k_edge = per_bay // 2
        chunks.append(sample_segment(pl, pa, k_edge // 2, 0.22))
        chunks.append(sample_segment(pr, pa, k_edge - k_edge // 2, 0.22))
        r1 = np.sqrt(RNG.random(per_bay - k_edge))
        r2 = RNG.random(per_bay - k_edge)
        tri = (1 - r1)[:, None] * pl + (r1 * (1 - r2))[:, None] * pr + (r1 * r2)[:, None] * pa
        chunks.append(tri + RNG.normal(0, 0.2, tri.shape))

    return np.vstack(chunks)


def sample_scalloped_roof(
    x0: float, x1: float, z0: float, z1: float, y_eave: float, ridge_h: float,
    bays: int, n: int, along: str = "z"
) -> np.ndarray:
    """Undulating Gaudí hyperbolic-paraboloid nave/transept roof with ridge pinnacles."""
    u = RNG.random(n)
    v = RNG.random(n)
    if along == "z":
        x = x0 + u * (x1 - x0)
        z = z0 + v * (z1 - z0)
        across = 1.0 - np.abs(u - 0.5) * 2.0
        wave = 1.0 + 0.16 * np.cos(v * bays * 2 * math.pi)
    else:
        x = x0 + v * (x1 - x0)
        z = z0 + u * (z1 - z0)
        across = 1.0 - np.abs(u - 0.5) * 2.0
        wave = 1.0 + 0.16 * np.cos(v * bays * 2 * math.pi)
    y = y_eave + (across ** 0.85) * ridge_h * wave + RNG.normal(0, 0.18, n)
    return np.column_stack([x, y, z])


def sample_nativity_portico(x_face: float, n: int) -> np.ndarray:
    """East Nativity Façade: 3 sculpted cypress gables + central Tree of Life pinnacle."""
    chunks = []
    # Three pointed portals (Hope, Charity center-tallest, Faith)
    gables = [
        (-8.2, 34.0, 5.2),
        (0.0, 48.0, 6.8),
        (8.2, 34.0, 5.2),
    ]
    per_g = n // 4
    for cz, gh, hw in gables:
        pl = np.array([x_face + 2.5, 0.0, cz - hw], dtype=np.float32)
        pr = np.array([x_face + 2.5, 0.0, cz + hw], dtype=np.float32)
        pa = np.array([x_face + 3.2, gh, cz], dtype=np.float32)
        # Parabolic entry arch + tall triangular cypress gable
        chunks.append(sample_parabolic_arch(pl, pr, gh * 0.44, per_g // 3, 0.35))
        chunks.append(sample_segment(pl + [0, 14, 0], pa, per_g // 3, 0.32))
        chunks.append(sample_segment(pr + [0, 14, 0], pa, per_g // 3, 0.32))
        # Sculptural façade relief fill
        r1 = np.sqrt(RNG.random(per_g // 2))
        r2 = RNG.random(per_g // 2)
        tri = (1 - r1)[:, None] * (pl + [0, 10, 0]) + (r1 * (1 - r2))[:, None] * (pr + [0, 10, 0]) + (r1 * r2)[:, None] * pa
        tri[:, 0] += RNG.normal(0, 0.65, len(tri))
        chunks.append(tri)

    # Central Cypress Tree pinnacle rising above Charity portal
    t = RNG.random(per_g)
    th = RNG.uniform(0, 2 * math.pi, per_g)
    y = 46.0 + t * 18.0
    r = 2.4 * np.sin(t * math.pi) ** 0.7 * (1.0 - 0.35 * t)
    chunks.append(np.column_stack([x_face + 2.8 + r * np.cos(th), y, r * np.sin(th)]))
    return np.vstack(chunks)


def sample_passion_portico(x_face: float, n: int) -> np.ndarray:
    """West Passion Façade: 6 iconic slanted 'bone' columns + angular upper pediment."""
    chunks = []
    n_cols = int(n * 0.45)
    n_ped = n - n_cols

    # 6 inclined double-lean columns spanning Z = -12 to +12
    z_bases = np.linspace(-11.5, 11.5, 6)
    per_c = n_cols // len(z_bases)
    for zb in z_bases:
        p_bot = np.array([x_face - 6.8, 0.0, zb], dtype=np.float32)
        p_top = np.array([x_face - 1.2, 26.0, zb * 0.88], dtype=np.float32)
        chunks.append(sample_segment(p_bot, p_top, int(per_c * 0.72), 0.72))
        # Diagonal secondary V-struts
        p_mid = 0.55 * p_bot + 0.45 * p_top
        p_strut = np.array([x_face - 1.5, 26.0, zb * 0.88 + (2.0 if zb < 0 else -2.0)], dtype=np.float32)
        chunks.append(sample_segment(p_mid, p_strut, int(per_c * 0.28), 0.42))

    # Angular cornice beam + steep triangular pediment gable + upper colonnade
    chunks.append(sample_segment(
        np.array([x_face - 1.8, 26.0, -13.5], dtype=np.float32),
        np.array([x_face - 1.8, 26.0, 13.5], dtype=np.float32),
        n_ped // 5, 0.85,
    ))
    pl = np.array([x_face - 1.8, 26.0, -12.5], dtype=np.float32)
    pr = np.array([x_face - 1.8, 26.0, 12.5], dtype=np.float32)
    pa = np.array([x_face - 1.2, 54.0, 0.0], dtype=np.float32)
    chunks.append(sample_segment(pl, pa, n_ped // 4, 0.45))
    chunks.append(sample_segment(pr, pa, n_ped // 4, 0.45))
    # Colonnade of slender ribs inside the pediment
    for zc in np.linspace(-9.5, 9.5, 9):
        top_y = 26.0 + (1.0 - abs(zc) / 12.5) * 28.0
        chunks.append(sample_segment(
            np.array([x_face - 1.5, 26.0, zc], dtype=np.float32),
            np.array([x_face - 1.5, top_y, zc], dtype=np.float32),
            max(25, n_ped // 22), 0.25,
        ))
    return np.vstack(chunks)


def sample_glory_portico(z_face: float, n: int) -> np.ndarray:
    """South Glory Façade: 7 monumental parabolic portal arches + stepped cloud-gable."""
    chunks = []
    x_pos = np.linspace(-13.5, 13.5, 7)
    per_a = n // 9
    for i, xc in enumerate(x_pos):
        h = 22.0 + (3 - abs(i - 3)) * 5.0
        pl = np.array([xc - 2.0, 0.0, z_face - 2.0], dtype=np.float32)
        pr = np.array([xc + 2.0, 0.0, z_face - 2.0], dtype=np.float32)
        chunks.append(sample_parabolic_arch(pl, pr, h, per_a, 0.35))
        # Slender vertical lantern pier beside each arch
        chunks.append(sample_segment(
            np.array([xc, 0.0, z_face - 2.2], dtype=np.float32),
            np.array([xc, h + 14.0, z_face - 1.6], dtype=np.float32),
            per_a // 2, 0.35,
        ))
    # Monumental upper gable ribs
    pl = np.array([-16.0, 26.0, z_face - 1.0], dtype=np.float32)
    pr = np.array([16.0, 26.0, z_face - 1.0], dtype=np.float32)
    pa = np.array([0.0, 56.0, z_face - 0.5], dtype=np.float32)
    chunks.append(sample_segment(pl, pa, per_a, 0.45))
    chunks.append(sample_segment(pr, pa, per_a, 0.45))
    return np.vstack(chunks)


def sample_apse_detailed(cx: float, cz: float, radius: float, height: float, n: int) -> np.ndarray:
    """7-chapel faceted northern apse with lancet windows, buttress ribs & 14 slender pinnacles."""
    chunks = []
    n_chapels = 7
    n_wall = int(n * 0.48)
    n_ribs = int(n * 0.24)
    n_roof = int(n * 0.16)
    n_pins = n - n_wall - n_ribs - n_roof

    # 1. 7 polygonal chapel walls with tall narrow windows
    theta = RNG.uniform(0.0, math.pi, int(n_wall * 1.4))
    y = RNG.random(len(theta)) * height
    chapel_phase = (theta / math.pi * n_chapels) % 1.0
    # Cutout narrow gothic window in middle of each chapel facet
    in_win = (chapel_phase > 0.34) & (chapel_phase < 0.66) & (y > 9.0) & (y < height * 0.78)
    keep = ~in_win
    theta, y = theta[keep][:n_wall], y[keep][:n_wall]
    lobe = 1.0 + 0.13 * np.abs(np.sin(n_chapels * 0.5 * theta))
    r = radius * lobe * RNG.uniform(0.98, 1.02, len(theta))
    chunks.append(np.column_stack([cx + r * np.cos(theta), y, cz + r * np.sin(theta)]))

    # 2. Radiating buttress ribs + 14 tall slender apse pinnacles
    angles = np.linspace(0.0, math.pi, n_chapels * 2 + 1)
    per_rib = max(25, n_ribs // len(angles))
    per_pin = max(20, n_pins // len(angles))
    for i, a in enumerate(angles):
        lobe_r = radius * (1.0 + 0.13 * abs(math.sin(n_chapels * 0.5 * a)))
        # Vertical rib
        p0 = np.array([cx + (lobe_r + 1.2) * math.cos(a), 0.0, cz + (lobe_r + 1.2) * math.sin(a)], dtype=np.float32)
        p1 = np.array([cx + (lobe_r + 0.3) * math.cos(a), height + 2.0, cz + (lobe_r + 0.3) * math.sin(a)], dtype=np.float32)
        chunks.append(sample_segment(p0, p1, per_rib, 0.32))
        # Tall slender spirelet / pinnacle atop each buttress
        pin_h = 18.0 if i % 2 == 0 else 12.0
        t = RNG.random(per_pin)
        th = RNG.uniform(0, 2 * math.pi, per_pin)
        rp = 1.15 * (1.0 - t) ** 0.75
        chunks.append(np.column_stack([
            p1[0] + rp * np.cos(th),
            height + t * pin_h,
            p1[2] + rp * np.sin(th),
        ]))

    # 3. Ribbed conical apse roof
    tr = RNG.random(n_roof)
    thr = RNG.uniform(0.0, math.pi, n_roof)
    rr = radius * (1.0 - tr)
    yr = height + tr * 14.0
    chunks.append(np.column_stack([cx + rr * np.cos(thr), yr, cz + rr * np.sin(thr)]))

    return np.vstack(chunks)


def sample_tree_columns_and_vaults(n: int) -> np.ndarray:
    """Interior double-twist columns branching into 4 limbs + hyperboloid ceiling rosettes."""
    col_positions = []
    for z in np.linspace(-32, 20, 6):
        for x in (-12.5, -5.8, 5.8, 12.5):
            col_positions.append((x, z))
    chunks = []
    per_col = max(40, n // len(col_positions))
    for cx, cz in col_positions:
        # Trunk (0..26m)
        n_trunk = int(per_col * 0.48)
        t = RNG.random(n_trunk)
        y = t * 26.0
        th = RNG.uniform(0, 2 * math.pi, n_trunk)
        r = (0.95 - 0.15 * t) * (1.0 + 0.08 * np.cos(8 * th + y * 0.3))
        chunks.append(np.column_stack([cx + r * np.cos(th), y, cz + r * np.sin(th)]))

        # 4 branching limbs rising from y=26m to vault ceiling y=43m
        n_limb = (per_col - n_trunk) // 4
        for a in (math.pi * 0.25, math.pi * 0.75, math.pi * 1.25, math.pi * 1.75):
            p0 = np.array([cx, 25.5, cz], dtype=np.float32)
            p1 = np.array([cx + 3.4 * math.cos(a), 43.0, cz + 3.4 * math.sin(a)], dtype=np.float32)
            chunks.append(sample_segment(p0, p1, n_limb, 0.32))
    return np.vstack(chunks)


def sample_star_finial(cx: float, cy: float, cz: float, radius: float, n: int) -> np.ndarray:
    """Crisp 12-pointed Morning Star atop the Tower of the Virgin Mary."""
    golden = (1 + 5 ** 0.5) / 2
    idx = np.arange(12)
    phi = np.arccos(1 - 2 * (idx + 0.5) / 12)
    theta = 2 * math.pi * idx / golden
    dirs = np.column_stack([np.sin(phi) * np.cos(theta), np.cos(phi), np.sin(phi) * np.sin(theta)])
    chosen = dirs[RNG.integers(0, 12, size=n)]
    dist = radius * (RNG.random(n) ** 0.65)
    taper = (1.0 - dist / radius) * 0.65
    return np.array([cx, cy, cz]) + chosen * dist[:, None] + RNG.normal(0, 0.25, (n, 3)) * taper[:, None]


def sample_cross_finial(cx: float, cy: float, cz: float, height: float, arm: float, n: int) -> np.ndarray:
    """Monumental 4-armed 3D cross crowning the 172.5m Tower of Jesus Christ."""
    n_v = int(n * 0.46)
    n_x = int(n * 0.27)
    n_z = n - n_v - n_x
    # Faceted octagonal-prism arms
    v = np.column_stack([
        cx + RNG.normal(0, 0.78, n_v),
        cy + RNG.uniform(0, height, n_v),
        cz + RNG.normal(0, 0.78, n_v),
    ])
    ax = np.column_stack([
        cx + RNG.uniform(-arm, arm, n_x),
        cy + height * 0.56 + RNG.normal(0, 0.78, n_x),
        cz + RNG.normal(0, 0.78, n_x),
    ])
    az = np.column_stack([
        cx + RNG.normal(0, 0.78, n_z),
        cy + height * 0.56 + RNG.normal(0, 0.78, n_z),
        cz + RNG.uniform(-arm, arm, n_z),
    ])
    return np.vstack([v, ax, az])


def build_parametric_sagrada_familia(total_points: int = 80000) -> tuple[np.ndarray, np.ndarray]:
    """
    Build a high-detail, semantically zoned Sagrada Família point cloud.
    Coordinate system: X = East/Nativity(+) / West/Passion(-), Y = Up(+), Z = North/Apse(+) / South/Glory(-).
    """
    parts: list[tuple[np.ndarray, int]] = []
    scale = total_points / 80000.0
    S = lambda k: max(80, int(k * scale))

    # --- Branch 0 (urban): Nativity Façade (East, +X) & East Transept ---
    nat_towers = [
        (33.0, -9.8, 98.0, 4.4),
        (33.0, -3.3, 107.0, 4.7),
        (33.0, 3.3, 107.0, 4.7),
        (33.0, 9.8, 98.0, 4.4),
    ]
    for cx, cz, h, rb in nat_towers:
        parts.append((sample_gaudi_tower(cx, cz, 12.0, h - 12.0, rb, 1.35, S(2400), flutes=16, louver_bands=26, crown="trencadis"), 0))
    # Skybridge between central Nativity towers
    parts.append((sample_parabolic_arch(
        np.array([33.0, 56.0, -3.3], dtype=np.float32),
        np.array([33.0, 56.0, 3.3], dtype=np.float32),
        3.5, S(260), 0.4,
    ), 0))
    # Nativity cypress gables & Tree of Life portico
    parts.append((sample_nativity_portico(33.0, S(3400)), 0))
    # East transept walls + scalloped roof
    parts.append((sample_faceted_wall_with_windows(16.0, 14.0, 34.0, 14.0, 0.0, 40.0, 3, S(1300), np.array([0, 0, 1.0], np.float32)), 0))
    parts.append((sample_faceted_wall_with_windows(16.0, -14.0, 34.0, -14.0, 0.0, 40.0, 3, S(1300), np.array([0, 0, -1.0], np.float32)), 0))
    parts.append((sample_scalloped_roof(16.0, 34.0, -14.0, 14.0, 40.0, 9.0, 3, S(1100), along="x"), 0))

    # --- Branch 1 (generative): Passion Façade (West, -X) & West Transept ---
    pas_towers = [
        (-33.0, -9.8, 107.0, 4.5),
        (-33.0, -3.3, 112.0, 4.8),
        (-33.0, 3.3, 112.0, 4.8),
        (-33.0, 9.8, 107.0, 4.5),
    ]
    for cx, cz, h, rb in pas_towers:
        parts.append((sample_gaudi_tower(cx, cz, 12.0, h - 12.0, rb, 1.35, S(2400), flutes=12, louver_bands=24, crown="trencadis"), 1))
    # High bridge between central Passion towers
    parts.append((sample_segment(
        np.array([-33.0, 62.0, -3.3], dtype=np.float32),
        np.array([-33.0, 62.0, 3.3], dtype=np.float32),
        S(240), 0.55,
    ), 1))
    # Iconic Passion slanted portico columns & pediment
    parts.append((sample_passion_portico(-33.0, S(3400)), 1))
    # West transept walls + scalloped roof
    parts.append((sample_faceted_wall_with_windows(-34.0, 14.0, -16.0, 14.0, 0.0, 40.0, 3, S(1300), np.array([0, 0, 1.0], np.float32)), 1))
    parts.append((sample_faceted_wall_with_windows(-34.0, -14.0, -16.0, -14.0, 0.0, 40.0, 3, S(1300), np.array([0, 0, -1.0], np.float32)), 1))
    parts.append((sample_scalloped_roof(-34.0, -16.0, -14.0, 14.0, 40.0, 9.0, 3, S(1100), along="x"), 1))

    # --- Branch 2 (climate): 4 Evangelist Towers + Crossing Lantern + Skybridges ---
    evang_towers = [
        (11.8, 11.8, 135.0, 5.4),
        (-11.8, 11.8, 135.0, 5.4),
        (11.8, -11.8, 135.0, 5.4),
        (-11.8, -11.8, 135.0, 5.4),
    ]
    for cx, cz, h, rb in evang_towers:
        parts.append((sample_gaudi_tower(
            cx, cz, 26.0, h - 26.0, rb, 1.9, S(2800),
            flutes=10, pinnacle_h=17.0, louver_bands=20, lattice=True, crown="tetramorph"
        ), 2))
        # Flying skybridge linking each Evangelist tower to the Central Tower
        parts.append((sample_parabolic_arch(
            np.array([cx * 0.85, 86.0, cz * 0.85], dtype=np.float32),
            np.array([cx * 0.25, 92.0, cz * 0.25], dtype=np.float32),
            4.0, S(260), 0.45,
        ), 2))
    # Crossing lantern lower galleries
    for x_s, z_s, x_e, z_e, nrm in [
        (-15.5, 15.5, 15.5, 15.5, [0, 0, 1.0]),
        (-15.5, -15.5, 15.5, -15.5, [0, 0, -1.0]),
        (15.5, -15.5, 15.5, 15.5, [1.0, 0, 0]),
        (-15.5, -15.5, -15.5, 15.5, [-1.0, 0, 0]),
    ]:
        parts.append((sample_faceted_wall_with_windows(
            x_s, z_s, x_e, z_e, 34.0, 54.0, 3, S(750), np.array(nrm, np.float32)
        ), 2))

    # --- Branch 3 (fabrication): Central Nave, Side Aisles, Clerestory & Tree Columns ---
    # Upper clerestory nave walls (both sides)
    parts.append((sample_faceted_wall_with_windows(16.5, -42.0, 16.5, 24.0, 18.0, 44.0, 6, S(3400), np.array([1.0, 0, 0], np.float32)), 3))
    parts.append((sample_faceted_wall_with_windows(-16.5, -42.0, -16.5, 24.0, 18.0, 44.0, 6, S(3400), np.array([-1.0, 0, 0], np.float32)), 3))
    # Lower side-aisle outer walls with stepped buttresses
    parts.append((sample_faceted_wall_with_windows(23.0, -38.0, 23.0, 22.0, 0.0, 24.0, 6, S(2200), np.array([1.0, 0, 0], np.float32)), 3))
    parts.append((sample_faceted_wall_with_windows(-23.0, -38.0, -23.0, 22.0, 0.0, 24.0, 6, S(2200), np.array([-1.0, 0, 0], np.float32)), 3))
    # Scalloped hyperbolic-paraboloid nave roof + side aisle roofs
    parts.append((sample_scalloped_roof(-16.5, 16.5, -42.0, 24.0, 44.0, 10.5, 6, S(2800), along="z"), 3))
    parts.append((sample_scalloped_roof(16.5, 23.0, -38.0, 22.0, 24.0, 3.2, 6, S(650), along="z"), 3))
    parts.append((sample_scalloped_roof(-23.0, -16.5, -38.0, 22.0, 24.0, 3.2, 6, S(650), along="z"), 3))
    # Branching interior tree columns
    parts.append((sample_tree_columns_and_vaults(S(3200)), 3))

    # --- Branch 4 (foundations): 7-Chapel Apse + Tower of the Virgin Mary + 12-Pointed Star ---
    parts.append((sample_apse_detailed(0.0, 25.0, 19.5, 38.0, S(5400)), 4))
    parts.append((sample_gaudi_tower(
        0.0, 26.0, 34.0, 96.0, 7.6, 2.3, S(4400),
        flutes=12, pinnacle_h=14.0, louver_bands=18, lattice=True, crown="lantern"
    ), 4))
    parts.append((sample_star_finial(0.0, 136.0, 26.0, 5.2, S(1200)), 4))

    # --- Branch 5 (frontier / gaps): Glory Façade (South, -Z) + Central Tower of Jesus Christ ---
    glory_towers = [
        (-10.8, -45.0, 108.0, 4.5),
        (-3.6, -45.0, 118.0, 4.9),
        (3.6, -45.0, 118.0, 4.9),
        (10.8, -45.0, 108.0, 4.5),
    ]
    for cx, cz, h, rb in glory_towers:
        parts.append((sample_gaudi_tower(cx, cz, 12.0, h - 12.0, rb, 1.45, S(1850), flutes=12, louver_bands=22, crown="trencadis"), 5))
    parts.append((sample_glory_portico(-45.0, S(2400)), 5))
    # Colossal Central Tower of Jesus Christ (172.5m) with open hyperboloid lattice & 4-armed cross
    parts.append((sample_gaudi_tower(
        0.0, 0.0, 42.0, 115.0, 10.8, 3.2, S(6400),
        flutes=12, pinnacle_h=18.0, louver_bands=24, twist=0.35, lattice=True, crown="lantern"
    ), 5))
    parts.append((sample_cross_finial(0.0, 157.0, 0.0, 17.5, 7.2, S(1400)), 5))

    all_pts = np.vstack([p for p, _ in parts]).astype(np.float32)
    all_zones = np.concatenate([np.full(len(p), z, dtype=np.int32) for p, z in parts])
    return all_pts, all_zones


def load_external_mesh_points(mesh_path: Path, total_points: int) -> tuple[np.ndarray, np.ndarray]:
    """Optional path: sample any downloaded .glb / .obj / .stl / .ply via trimesh."""
    try:
        import trimesh
    except ImportError as exc:
        raise SystemExit(
            "Loading an external mesh requires `trimesh` (pip install trimesh)."
        ) from exc

    loaded = trimesh.load(mesh_path, force="mesh")
    if isinstance(loaded, trimesh.Scene):
        loaded = loaded.dump(concatenate=True)
    pts, _ = trimesh.sample.sample_surface(loaded, total_points)
    pts = np.asarray(pts, dtype=np.float32)

    spans = pts.max(axis=0) - pts.min(axis=0)
    up_axis = int(np.argmax(spans))
    if up_axis == 2:
        pts = pts[:, [0, 2, 1]]
    pts[:, 0] -= (pts[:, 0].min() + pts[:, 0].max()) / 2
    pts[:, 2] -= (pts[:, 2].min() + pts[:, 2].max()) / 2
    pts[:, 1] -= pts[:, 1].min()
    pts *= 172.0 / max(pts[:, 1].max(), 1e-5)

    x, y, z = pts[:, 0], pts[:, 1], pts[:, 2]
    zones = np.full(len(pts), 3, dtype=np.int32)
    zones[x > 16.0] = 0
    zones[x < -16.0] = 1
    zones[(np.abs(x) <= 16.0) & (np.abs(z) <= 16.0) & (y > 40.0)] = 2
    zones[z > 20.0] = 4
    zones[(z < -34.0) | ((np.hypot(x, z) < 11.5) & (y > 85.0))] = 5
    return pts, zones


# ---------------------------------------------------------------------------
# 3. Synthetic 250-Project MaAI Corpus + Stone Assignment
# ---------------------------------------------------------------------------
def build_corpus_and_assign(pts: np.ndarray, zones: np.ndarray) -> tuple[list[dict], np.ndarray]:
    """
    Generate 250 MaAI projects across 6 branches (with frontier deliberately sparse
    to show unbuilt research gaps!) and assign every point cloud vertex to either
    a built project 'stone' or an unbuilt ghost scaffold slot.
    """
    branch_counts = [54, 52, 48, 44, 40, 12]
    built_fractions = [0.84, 0.80, 0.78, 0.86, 0.82, 0.28]

    projects: list[dict] = []
    N = len(pts)
    umap_xyz = np.zeros((N, 3), dtype=np.float32)
    colors = np.zeros((N, 3), dtype=np.float32)
    cohort_arr = np.zeros(N, dtype=np.float32)
    built_arr = np.zeros(N, dtype=np.float32)
    proj_idx_arr = np.full(N, -1.0, dtype=np.float32)
    branch_idx_arr = zones.astype(np.float32)

    proj_counter = 0
    for b_idx, branch in enumerate(BRANCHES):
        mask = np.where(zones == b_idx)[0]
        b_pts = pts[mask]
        rgb = np.array(hex_to_rgb(branch["color"]), dtype=np.float32)

        order = np.argsort(b_pts[:, 1] + RNG.normal(0, 1.8, len(b_pts)))
        ordered_indices = mask[order]

        n_proj = branch_counts[b_idx]
        n_built_pts = int(len(ordered_indices) * built_fractions[b_idx])
        built_indices = ordered_indices[:n_built_pts]
        ghost_indices = ordered_indices[n_built_pts:]

        chunks = np.array_split(built_indices, n_proj)
        cx_u, cy_u = branch["umap_center"]
        prefixes = TITLE_PREFIXES[branch["id"]]

        for k, chunk in enumerate(chunks):
            frac = k / max(n_proj - 1, 1)
            if frac < 0.36:
                c_id = 0
            elif frac < 0.74:
                c_id = 1
            else:
                c_id = 2

            angle = RNG.uniform(0, 2 * math.pi)
            rad = abs(RNG.normal(0, 10.5)) + 1.5
            ux = float(cx_u + rad * math.cos(angle))
            uy = float(cy_u + rad * math.sin(angle))

            centroid = pts[chunk].mean(axis=0)
            c_scene = np.array([centroid[0] * 0.55, (centroid[1] - 62.0) * 0.55, centroid[2] * 0.55])

            repro = int(RNG.choice([1, 2, 3, 4], p=[0.20, 0.30, 0.30, 0.20]))
            title_base = prefixes[k % len(prefixes)]
            variant = f" v{1 + k // len(prefixes)}" if k >= len(prefixes) else ""
            projects.append({
                "id": proj_counter,
                "title": f"{title_base}{variant}",
                "branch": branch["id"],
                "branch_idx": b_idx,
                "cohort": COHORTS[c_id],
                "cohort_idx": c_id,
                "work_type": str(RNG.choice(WORK_TYPES, p=[0.30, 0.40, 0.22, 0.08])),
                "method": str(RNG.choice(branch["methods"])),
                "dataset": str(RNG.choice(branch["datasets"])),
                "repro_score": repro,
                "umap": [round(ux, 2), round(uy, 2)],
                "basilica": [round(float(c_scene[0]), 2), round(float(c_scene[1]), 2), round(float(c_scene[2]), 2)],
                "point_count": int(len(chunk)),
            })

            n_c = len(chunk)
            u_r = np.sqrt(RNG.random(n_c)) * 1.15
            u_th = RNG.uniform(0, 2 * math.pi, n_c)
            umap_xyz[chunk, 0] = ux + u_r * np.cos(u_th)
            umap_xyz[chunk, 1] = uy + u_r * np.sin(u_th)
            umap_xyz[chunk, 2] = RNG.normal(0, 0.15, n_c)

            # Subtle height-based warmth + cohort lift for crisp architectural shading
            h_lift = np.clip(pts[chunk, 1] / 172.0, 0.0, 1.0)[:, None] * 0.18
            tint = 0.78 + 0.08 * c_id + 0.025 * repro
            colors[chunk] = np.clip(rgb[None, :] * tint + h_lift, 0.0, 1.0)
            cohort_arr[chunk] = float(c_id)
            built_arr[chunk] = 1.0
            proj_idx_arr[chunk] = float(proj_counter)
            proj_counter += 1

        if len(ghost_indices) > 0:
            n_g = len(ghost_indices)
            g_angle = RNG.uniform(0, 2 * math.pi, n_g)
            g_rad = RNG.uniform(13.0, 24.0, n_g) if b_idx != 5 else RNG.uniform(0.0, 15.0, n_g)
            umap_xyz[ghost_indices, 0] = cx_u + g_rad * np.cos(g_angle)
            umap_xyz[ghost_indices, 1] = cy_u + g_rad * np.sin(g_angle)
            umap_xyz[ghost_indices, 2] = -1.5
            colors[ghost_indices] = np.clip(rgb * 0.55 + 0.28, 0.0, 1.0)
            cohort_arr[ghost_indices] = 3.0
            built_arr[ghost_indices] = 0.0
            proj_idx_arr[ghost_indices] = -1.0

    b_norm = pts.copy()
    b_norm[:, 1] -= 62.0
    b_norm *= 0.55

    packed = np.column_stack([
        b_norm,
        umap_xyz,
        colors,
        cohort_arr,
        built_arr,
        proj_idx_arr,
        branch_idx_arr,
    ]).astype(np.float32)

    return projects, packed


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate high-detail MaAI Atlas Sagrada Família data.")
    parser.add_argument("--mesh", type=Path, default=None, help="Optional .glb/.obj/.stl/.ply file to sample.")
    parser.add_argument("--points", type=int, default=80000, help="Target point count (default: 80000).")
    args = parser.parse_args()

    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.mesh:
        print(f"Sampling external mesh: {args.mesh} ({args.points} points)...")
        pts, zones = load_external_mesh_points(args.mesh, args.points)
        source_label = f"mesh:{args.mesh.name}"
    else:
        print(f"Generating high-detail parametric Sagrada Família point cloud (~{args.points:,} points)...")
        pts, zones = build_parametric_sagrada_familia(args.points)
        source_label = "parametric_gaudi_v2_detailed"

    projects, packed = build_corpus_and_assign(pts, zones)

    bin_path = out_dir / "points.bin"
    packed.tofile(bin_path)

    meta = {
        "source": source_label,
        "point_count": int(len(packed)),
        "floats_per_point": 13,
        "built_points": int((packed[:, 10] > 0.5).sum()),
        "ghost_points": int((packed[:, 10] <= 0.5).sum()),
        "branches": BRANCHES,
        "cohorts": COHORTS,
        "projects": projects,
    }
    meta_path = out_dir / "atlas_meta.json"
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"Done! {len(packed):,} points ({meta['built_points']:,} built, {meta['ghost_points']:,} ghost scaffold)")
    print(f"  -> {bin_path} ({bin_path.stat().st_size / 1024:.0f} KB)")
    print(f"  -> {meta_path} ({len(projects)} projects across {len(BRANCHES)} branches)")


if __name__ == "__main__":
    main()
