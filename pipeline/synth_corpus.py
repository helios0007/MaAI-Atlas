"""
Stage 00-03 stand-in: synthetic MaAI corpus.

Real projects are not available yet, so this module produces records in exactly
the schema the real pipeline will output (see docs/PIPELINE.md). Everything
downstream (citations, repos, embeddings, layout, branches, gaps, basilica)
runs on these records unchanged, and will run the same way on real data.

Design of the synthetic corpus (so the pipeline has something real to find):
  * five latent research themes with their own vocabulary, methods and data;
  * ~12% cross-over projects that bridge two themes;
  * theme shares drift across cohorts (urban fades, knowledge/LLM grows);
  * some method x domain combinations never occur (e.g. RL for urban climate);
  * an "external literature" sample that covers topics MaAI never touched
    (causal inference for retrofit, world models for construction, post-occupancy).

The pipeline is never told the latent theme: branches must be re-discovered.
Every record carries "synthetic": true.
"""

from __future__ import annotations

import numpy as np

from . import taxonomy as tx

PLACES = [
    "Barcelona", "Poblenou", "Eixample", "Gràcia", "Sant Martí", "El Raval", "Badalona",
    "L'Hospitalet", "Valldaura", "Milan", "Lisbon", "Bogotá", "Mumbai", "Cairo", "Nairobi",
    "Rotterdam", "Athens", "Mexico City", "Santiago", "Istanbul",
]

COHORTS = ["24/25", "25/26", "26/27"]
COHORT_SIZES = [62, 78, 52]
COHORT_THEME_WEIGHTS = [
    {"urban": .28, "generative": .20, "climate": .24, "fabrication": .18, "knowledge": .10},
    {"urban": .22, "generative": .24, "climate": .22, "fabrication": .16, "knowledge": .16},
    {"urban": .14, "generative": .28, "climate": .20, "fabrication": .14, "knowledge": .24},
]
CROSSOVER_RATE = 0.12
BRIDGES = [("generative", "climate"), ("urban", "climate"), ("knowledge", "generative"),
           ("fabrication", "generative"), ("urban", "knowledge")]

THEMES = {
    "urban": {
        "domains": {"urban-mobility": .45, "urban-morphology": .30, "public-space": .25},
        "methods": {"gnn": .30, "gradient-boosting": .20, "random-forest": .15, "spatial-clustering": .15,
                    "agent-based-model": .10, "computer-vision": .10},
        "data": ["osm", "gtfs", "street-view", "mobile-telemetry", "cadastre"],
        "tools": ["python", "qgis", "pytorch", "scikit-learn"],
        "scales": {"city": .5, "block": .4, "region": .1},
        "title_a": ["Walkable", "Transit", "Curbside", "Isochrone", "Street", "Block", "Mobility", "Pedestrian", "Parcel", "Network"],
        "title_b": ["Graphs", "Atlas", "Flows", "Metrics", "Pulse", "Equity", "Permeability", "Vitality"],
        "outcomes": [
            "The model maps where street interventions would most improve accessibility, and results are shown in an interactive dashboard for planners.",
            "Predictions are compared with observed pedestrian and transit counts and reveal neighbourhoods that are underserved.",
            "Street segments are ranked by predicted footfall and service access, giving the municipality an evidence base for superblock decisions.",
        ],
    },
    "generative": {
        "domains": {"floor-plan-layout": .40, "facade-design": .30, "massing": .30},
        "methods": {"diffusion": .30, "controlnet": .15, "gan": .20, "graph-generation": .20,
                    "gaussian-splatting": .10, "llm-agent": .05},
        "data": ["floorplan-corpus", "synthetic-rhino", "objaverse"],
        "tools": ["pytorch", "comfyui", "grasshopper", "rhino"],
        "scales": {"building": .8, "block": .2},
        "title_a": ["Latent", "Generative", "Diffused", "Prompted", "Adjacency", "Courtyard", "Facade", "Tectonic", "Modular", "Vernacular"],
        "title_b": ["Layouts", "Typologies", "Envelopes", "Grammars", "Massing", "Plans", "Skins", "Variants"],
        "outcomes": [
            "The generator produces design options that respect the programme and is evaluated against area, adjacency and circulation metrics.",
            "Designers steer the outputs with sketches and text prompts inside Rhino and Grasshopper, keeping the architect in the loop.",
            "Generated layouts are compared with the training plans for diversity and validity, and the best are developed into 3D massing.",
        ],
    },
    "climate": {
        "domains": {"urban-climate": .45, "building-energy": .35, "air-quality": .20},
        "methods": {"surrogate-model": .30, "cnn": .25, "pinn": .10, "time-series-transformer": .15, "gradient-boosting": .20},
        "data": ["era5", "landsat", "sentinel-2", "epw", "energy-sims", "air-quality-sensors"],
        "tools": ["python", "grasshopper", "pytorch", "qgis"],
        "scales": {"block": .4, "city": .35, "building": .25},
        "title_a": ["Cooling", "Heat", "Canyon", "Solar", "Thermal", "Airflow", "Albedo", "Canopy", "Exposure", "Retrofit"],
        "title_b": ["Surrogates", "Predictors", "Maps", "Comfort", "Resilience", "Downscaling", "Twins", "Envelopes"],
        "outcomes": [
            "The surrogate reproduces simulation results in milliseconds, enabling real-time feedback on heat, energy and comfort while designing.",
            "Maps of predicted heat and exposure highlight priority streets for shading, greening and cool materials.",
            "Validated against measured temperatures, the model supports early-stage decisions on envelope, orientation and vegetation.",
        ],
    },
    "fabrication": {
        "domains": {"robotic-fabrication": .50, "materials": .25, "construction-monitoring": .25},
        "methods": {"reinforcement-learning": .30, "computer-vision": .30, "pointnet": .20, "imitation-learning": .20},
        "data": ["robot-toolpaths", "3d-scans", "depth-sensors"],
        "tools": ["ros", "python", "grasshopper", "pytorch"],
        "scales": {"object": .85, "building": .15},
        "title_a": ["Adaptive", "Robotic", "Clay", "Timber", "Mycelium", "Stereotomic", "Force-Aware", "Vision-Guided", "Reclaimed", "Printed"],
        "title_b": ["Toolpaths", "Assembly", "Extrusion", "Carving", "Inspection", "Joinery", "Curing", "Masonry"],
        "outcomes": [
            "The robot adapts its toolpath in a closed loop, reducing material waste and fabrication errors in physical prototypes.",
            "Experiments in the IAAC robotics lab show better geometric accuracy than fixed toolpaths across several material batches.",
            "A scanned digital record of each fabricated piece is kept so deviations can be traced back to process parameters.",
        ],
    },
    "knowledge": {
        "domains": {"building-codes": .30, "design-knowledge": .45, "education": .25},
        "methods": {"rag": .30, "knowledge-graph": .20, "llm-agent": .20, "vlm": .15, "embeddings": .10, "fine-tuning": .05},
        "data": ["bim-ifc", "building-codes", "iaac-archive", "scholarly"],
        "tools": ["python", "langchain", "neo4j", "threejs"],
        "scales": {"building": .6, "city": .4},
        "title_a": ["Precedent", "Code", "Ontology", "Studio", "Brief", "Archive", "Jury", "Citation", "Regulation", "Sketch"],
        "title_b": ["Retrieval", "Assistants", "Graphs", "Copilots", "Critique", "Search", "Parsers", "Lineage"],
        "outcomes": [
            "The system answers questions with links to the original sources and was evaluated with architects and students.",
            "A knowledge base connects documents, projects and regulations so they can be searched by meaning rather than by keyword.",
            "In a studio test, students found relevant precedents faster and with more diverse references than with web search.",
        ],
    },
}

PROBLEMS = {
    "urban-mobility": [
        "Short car trips and fragmented transit dominate {place}, and planners lack fast tools to test street-network changes.",
        "Micro-mobility and bike-share flows in {place} are poorly understood at the level of individual street segments.",
        "Access to daily services within a fifteen-minute walk is unevenly distributed across the neighbourhoods of {place}.",
    ],
    "urban-morphology": [
        "Urban block morphology in {place} shapes density, permeability and land-use mix, yet it is rarely measured at parcel resolution.",
        "Informal growth at the edge of {place} changes street patterns faster than official cadastral maps can record.",
    ],
    "public-space": [
        "Street vitality and pedestrian comfort in {place} vary sharply between adjacent streets and squares.",
        "Public squares in {place} are redesigned with little evidence of how people actually use them through the day.",
    ],
    "floor-plan-layout": [
        "Residential floor plan design repeats a few typologies and rarely explores the full space of room adjacencies.",
        "Early-stage apartment layouts are drawn by hand, which makes it slow to compare daylight, circulation and area trade-offs.",
    ],
    "facade-design": [
        "Facade design in early phases is driven by imagery rather than by performance or local material culture.",
        "Designers need quick ways to explore facade patterns that respond to street context and style references.",
    ],
    "massing": [
        "Massing studies for mid-rise housing are constrained by zoning envelopes that are tedious to explore by hand.",
        "Form-finding for shells and courtyard typologies requires many iterations between geometry and analysis.",
    ],
    "urban-climate": [
        "Extreme heat in {place} concentrates in dense districts with little shade and high land surface temperatures.",
        "Outdoor thermal comfort (UTCI) in the street canyons of {place} is expensive to simulate at city scale.",
    ],
    "building-energy": [
        "Building energy simulation is too slow to guide early design decisions on envelope, glazing and orientation.",
        "Retrofit planning for the housing stock of {place} needs fast estimates of heating and cooling demand.",
    ],
    "air-quality": [
        "PM2.5 and NO2 exposure in {place} varies street by street, but monitoring stations are sparse.",
    ],
    "robotic-fabrication": [
        "Robotic fabrication with clay, timber and stone needs toolpaths that adapt to material behaviour during the process.",
        "Industrial robot arms follow fixed toolpaths and cannot react to deviations in the printed or milled part.",
    ],
    "materials": [
        "Bio-based and reclaimed materials such as mycelium, rammed earth and salvaged timber vary from piece to piece, which complicates design with them.",
    ],
    "construction-monitoring": [
        "Defects in 3D-printed concrete and masonry are found late, after layers have already cured.",
        "Construction progress on site is still tracked manually from photos and drawings.",
    ],
    "building-codes": [
        "Checking BIM models against building codes and zoning regulations is manual and error-prone.",
        "Planning regulations are long documents that designers struggle to query while designing.",
    ],
    "design-knowledge": [
        "Architectural precedents and design knowledge are scattered across books, archives and studio projects.",
        "Students repeat research that earlier cohorts already explored because past work is hard to search.",
    ],
    "education": [
        "Design studios are adopting generative AI tools without shared methods for critique and evaluation.",
    ],
    "post-occupancy": [
        "Buildings are rarely evaluated after occupancy, so designers do not learn how their spaces actually perform.",
    ],
}

# ---------------------------------------------------------------------------
# Illustrative bibliography: well-known works, real titles, authors and years.
# No DOIs are invented; resolution against OpenAlex happens in the real pipeline.
# ---------------------------------------------------------------------------
BIB = {
    "general": [
        ("Vaswani", 2017, "Attention Is All You Need", "NeurIPS"),
        ("He", 2016, "Deep Residual Learning for Image Recognition", "CVPR"),
        ("Kingma", 2015, "Adam: A Method for Stochastic Optimization", "ICLR"),
        ("McInnes", 2018, "UMAP: Uniform Manifold Approximation and Projection for Dimension Reduction", "arXiv"),
        ("Pedregosa", 2011, "Scikit-learn: Machine Learning in Python", "JMLR"),
        ("Paszke", 2019, "PyTorch: An Imperative Style, High-Performance Deep Learning Library", "NeurIPS"),
    ],
    "urban": [
        ("Jacobs", 1961, "The Death and Life of Great American Cities", "Random House"),
        ("Hillier", 1984, "The Social Logic of Space", "Cambridge University Press"),
        ("Kipf", 2017, "Semi-Supervised Classification with Graph Convolutional Networks", "ICLR"),
        ("Veličković", 2018, "Graph Attention Networks", "ICLR"),
        ("Hamilton", 2017, "Inductive Representation Learning on Large Graphs", "NeurIPS"),
        ("Breiman", 2001, "Random Forests", "Machine Learning"),
        ("Chen", 2016, "XGBoost: A Scalable Tree Boosting System", "KDD"),
        ("Boeing", 2017, "OSMnx: New Methods for Acquiring, Constructing, Analyzing, and Visualizing Complex Street Networks", "Computers, Environment and Urban Systems"),
        ("Moreno", 2021, "Introducing the 15-Minute City: Sustainability, Resilience and Place Identity in Future Post-Pandemic Cities", "Smart Cities"),
    ],
    "generative": [
        ("Goodfellow", 2014, "Generative Adversarial Nets", "NeurIPS"),
        ("Ho", 2020, "Denoising Diffusion Probabilistic Models", "NeurIPS"),
        ("Rombach", 2022, "High-Resolution Image Synthesis with Latent Diffusion Models", "CVPR"),
        ("Zhang", 2023, "Adding Conditional Control to Text-to-Image Diffusion Models", "ICCV"),
        ("Nauata", 2020, "House-GAN: Relational Generative Adversarial Networks for Graph-Constrained House Layout Generation", "ECCV"),
        ("Hu", 2020, "Graph2Plan: Learning Floorplan Generation from Layout Graphs", "ACM TOG"),
        ("Wu", 2019, "Data-Driven Interior Plan Generation for Residential Buildings", "ACM TOG"),
        ("Kerbl", 2023, "3D Gaussian Splatting for Real-Time Radiance Field Rendering", "ACM TOG"),
        ("Mildenhall", 2020, "NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis", "ECCV"),
        ("Alexander", 1977, "A Pattern Language", "Oxford University Press"),
        ("Isola", 2017, "Image-to-Image Translation with Conditional Adversarial Networks", "CVPR"),
    ],
    "climate": [
        ("Raissi", 2019, "Physics-Informed Neural Networks: A Deep Learning Framework for Solving Forward and Inverse Problems Involving Nonlinear Partial Differential Equations", "Journal of Computational Physics"),
        ("Hersbach", 2020, "The ERA5 Global Reanalysis", "Quarterly Journal of the Royal Meteorological Society"),
        ("Ronneberger", 2015, "U-Net: Convolutional Networks for Biomedical Image Segmentation", "MICCAI"),
        ("Crawley", 2001, "EnergyPlus: Creating a New-Generation Building Energy Simulation Program", "Energy and Buildings"),
        ("Oke", 1982, "The Energetic Basis of the Urban Heat Island", "Quarterly Journal of the Royal Meteorological Society"),
        ("Stewart", 2012, "Local Climate Zones for Urban Temperature Studies", "Bulletin of the American Meteorological Society"),
        ("Hochreiter", 1997, "Long Short-Term Memory", "Neural Computation"),
        ("Lim", 2021, "Temporal Fusion Transformers for Interpretable Multi-Horizon Time Series Forecasting", "International Journal of Forecasting"),
    ],
    "fabrication": [
        ("Schulman", 2017, "Proximal Policy Optimization Algorithms", "arXiv"),
        ("Mnih", 2015, "Human-Level Control through Deep Reinforcement Learning", "Nature"),
        ("Qi", 2017, "PointNet: Deep Learning on Point Sets for 3D Classification and Segmentation", "CVPR"),
        ("Qi", 2017, "PointNet++: Deep Hierarchical Feature Learning on Point Sets in a Metric Space", "NeurIPS"),
        ("He", 2017, "Mask R-CNN", "ICCV"),
        ("Redmon", 2016, "You Only Look Once: Unified, Real-Time Object Detection", "CVPR"),
        ("Gramazio", 2008, "Digital Materiality in Architecture", "Lars Müller Publishers"),
        ("Haarnoja", 2018, "Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning with a Stochastic Actor", "ICML"),
    ],
    "knowledge": [
        ("Lewis", 2020, "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", "NeurIPS"),
        ("Devlin", 2019, "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding", "NAACL"),
        ("Brown", 2020, "Language Models are Few-Shot Learners", "NeurIPS"),
        ("Radford", 2021, "Learning Transferable Visual Models From Natural Language Supervision", "ICML"),
        ("Reimers", 2019, "Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks", "EMNLP"),
        ("Hogan", 2021, "Knowledge Graphs", "ACM Computing Surveys"),
        ("Yao", 2023, "ReAct: Synergizing Reasoning and Acting in Language Models", "ICLR"),
        ("Eastman", 2008, "BIM Handbook", "Wiley"),
    ],
}

# Topics present in the external literature sample. "covered" maps to a MaAI theme;
# the others are deliberately absent from the MaAI corpus.
EXTERNAL_TOPICS = {
    "covered": 0.42,
    "causal-retrofit": 0.14,
    "world-model-construction": 0.12,
    "post-occupancy": 0.14,
    "participatory-llm": 0.10,
    "heat-equity": 0.08,
}
EXTERNAL_TEXT = {
    "causal-retrofit": (
        ["Energy savings from building retrofit programmes are usually estimated with engineering models rather than measured outcomes.",
         "It is unclear which retrofit measures actually cause reductions in household energy use once occupant behaviour is considered."],
        ["We apply causal inference with difference-in-differences and counterfactual models to smart meter data from retrofitted dwellings.",
         "Using causal models on metered consumption, we separate the effect of insulation from weather and behaviour."],
        ["Measured savings are lower than predicted, and the causal estimates identify which measures deliver.",
         "The causal framework supports retrofit policy with evidence on real energy savings."],
        ["causal-inference"], ["building-energy"],
    ),
    "world-model-construction": (
        ["Construction robots operate in unstructured, changing sites where hand-written controllers fail.",
         "On-site robotic assembly must anticipate how materials and structures respond before acting."],
        ["We train a world model of the construction site from robot experience and plan assembly actions inside the learned model.",
         "A model-based reinforcement learning agent with a learned world model predicts the consequences of placement actions."],
        ["The world model enables safer and more sample-efficient robotic assembly on site.",
         "Planning in the learned world model reduces failed placements in long-horizon assembly tasks."],
        ["world-model"], ["construction-monitoring", "robotic-fabrication"],
    ),
    "post-occupancy": (
        ["Buildings are rarely evaluated after occupancy, so designers do not learn how their spaces actually perform.",
         "Occupant comfort and space use drift from design assumptions once buildings are in operation."],
        ["We use machine learning on post-occupancy sensor data and occupant feedback to model comfort and space use over time.",
         "Indoor comfort sensors and occupant surveys are combined in a model of building performance in use."],
        ["Post-occupancy evaluation feeds back into design guidelines and adaptive facade control.",
         "The results show large gaps between designed and measured comfort, and how operation can close them."],
        ["time-series-transformer", "gradient-boosting"], ["post-occupancy"],
    ),
    "participatory-llm": (
        ["Participatory planning processes reach few residents and are slow to synthesise their input.",
         "Public consultation produces large volumes of resident comments that planners cannot read in full."],
        ["We deploy LLM agents that interview residents, summarise consultation input and negotiate between stakeholder positions.",
         "Multi-agent language models simulate stakeholder negotiation over urban plans and support participatory planning."],
        ["The agents broaden participation and give planners traceable summaries of resident priorities.",
         "Simulated negotiation reveals compromises that were later discussed in real workshops."],
        ["llm-agent"], ["public-space", "urban-morphology"],
    ),
    "heat-equity": (
        ["Heat vulnerability is concentrated in low-income neighbourhoods with older housing and few green spaces.",
         "Urban heat exposure is unequally distributed, and cooling interventions rarely target the most vulnerable residents."],
        ["We combine land surface temperature, census vulnerability indicators and machine learning to map heat inequity.",
         "Gradient boosting on satellite heat data and socio-economic indicators predicts heat vulnerability at block level."],
        ["The maps support equitable targeting of cooling centres, trees and shade.",
         "Results show that heat exposure and social vulnerability overlap in the same districts."],
        ["gradient-boosting", "cnn"], ["urban-climate"],
    ),
}

TOOL_FOR_METHOD = {
    "gnn": "pytorch", "diffusion": "comfyui", "controlnet": "comfyui", "gan": "pytorch", "graph-generation": "pytorch",
    "gaussian-splatting": "pytorch", "llm-agent": "langchain", "rag": "langchain", "knowledge-graph": "neo4j",
    "reinforcement-learning": "ros", "imitation-learning": "ros", "pointnet": "pytorch", "surrogate-model": "scikit-learn",
    "gradient-boosting": "scikit-learn", "random-forest": "scikit-learn", "agent-based-model": "unity",
}

WORK_TYPE_P = {"thesis": .30, "studio": .40, "seminar": .22, "workshop": .08}


def _pick(rng: np.random.Generator, weights: dict[str, float]) -> str:
    keys = list(weights)
    p = np.array([weights[k] for k in keys], dtype=float)
    return str(rng.choice(keys, p=p / p.sum()))


def _ref_string(rng: np.random.Generator, author: str, year: int, title: str, venue: str) -> str:
    """Render a reference in one of several citation styles, as students do."""
    style = int(rng.integers(0, 4))
    if style == 0:
        return f"{author} et al. ({year}). {title}. {venue}."
    if style == 1:
        return f"{author}, {title}, {venue}, {year}"
    if style == 2:
        return f'{author.upper()} ({year}) "{title.lower()}"'
    return f"{author}, A. {year}. {title.rstrip('.')}. In: {venue}"


def _abstract(rng, theme_key, domain, method, data, scale, place, work_type, bridge_key=None):
    th = THEMES[theme_key]
    parts = [str(rng.choice(PROBLEMS[domain])).format(place=place)]
    d_txt = " and ".join(tx.data_label(d) for d in data)
    verbs = ["develops", "trains", "proposes", "builds", "tests"]
    parts.append(
        f"This {tx.WORK_TYPE_LABELS[work_type].lower()} {rng.choice(verbs)} a {tx.method_label(method).lower()} "
        f"({tx.method_family(method).lower()}) using {d_txt}."
    )
    parts.append(f"The work is set at the {scale} scale, with {place} as the case study.")
    parts.append(str(rng.choice(th["outcomes"])))
    if bridge_key:
        parts.append(str(rng.choice(THEMES[bridge_key]["outcomes"])))
    return " ".join(parts)


def build_synthetic_corpus(seed: int = 7) -> dict:
    rng = np.random.default_rng(seed)
    projects: list[dict] = []
    used_titles: set[str] = set()
    pid = 0

    for c_idx, (cohort, n) in enumerate(zip(COHORTS, COHORT_SIZES)):
        for _ in range(n):
            theme = _pick(rng, COHORT_THEME_WEIGHTS[c_idx])
            bridge = None
            if rng.random() < CROSSOVER_RATE:
                options = [b for pair in BRIDGES if theme in pair for b in pair if b != theme]
                if options:
                    bridge = str(rng.choice(options))
            th = THEMES[theme]
            domain = _pick(rng, th["domains"])
            # cross-over: method borrowed from the bridging theme
            method = _pick(rng, THEMES[bridge]["methods"]) if bridge else _pick(rng, th["methods"])
            methods = [method]
            if rng.random() < 0.35:
                m2 = _pick(rng, th["methods"])
                if m2 != method:
                    methods.append(m2)
            data_pool = th["data"] + (THEMES[bridge]["data"] if bridge else [])
            data = list(dict.fromkeys(rng.choice(data_pool, size=int(rng.integers(1, 3)), replace=False).tolist()))
            scale = _pick(rng, th["scales"])
            place = str(rng.choice(PLACES))
            work_type = _pick(rng, WORK_TYPE_P if c_idx < 2 else {"studio": .55, "seminar": .35, "workshop": .10})
            domains = [domain]
            if bridge and rng.random() < 0.6:
                domains.append(_pick(rng, THEMES[bridge]["domains"]))

            tools = {"python"} | {TOOL_FOR_METHOD.get(m, "python") for m in methods}
            tools |= set(rng.choice(th["tools"], size=2, replace=False).tolist())

            title = f"{rng.choice(th['title_a'])} {rng.choice(th['title_b'])}"
            if title in used_titles:
                title = f"{title} in {place}"
            k = 2
            base = title
            while title in used_titles:
                title = f"{base} {k}"
                k += 1
            used_titles.add(title)

            abstract = _abstract(rng, theme, domain, method, data, scale, place, work_type, bridge)

            # references: theme pool + general + bridge + a little noise
            refs = []
            pools = [(theme, int(rng.integers(4, 8))), ("general", int(rng.integers(1, 3)))]
            if bridge:
                pools.append((bridge, int(rng.integers(2, 4))))
            if rng.random() < 0.3:
                pools.append((str(rng.choice(list(THEMES))), 1))
            for pool, k_ref in pools:
                items = BIB[pool]
                for i in rng.choice(len(items), size=min(k_ref, len(items)), replace=False):
                    refs.append(_ref_string(rng, *items[int(i)]))

            # repository and reproducibility signals
            p_repo = {"thesis": .85, "studio": .7, "seminar": .5, "workshop": .4}[work_type]
            repo = None
            if rng.random() < p_repo:
                boost = 0.12 if work_type == "thesis" else 0.0
                signals = {
                    "readme": bool(rng.random() < .80 + boost),
                    "dependencies": bool(rng.random() < .62 + boost),
                    "pinned_versions": bool(rng.random() < .30 + boost),
                    "data_available": bool(rng.random() < .42 + boost),
                    "licence": bool(rng.random() < .38 + boost),
                    "entry_point": bool(rng.random() < .52 + boost),
                }
                slug = title.lower().replace(" ", "-").replace("'", "")
                repo = {
                    "url": f"https://github.com/example-maai/{slug}",
                    "signals": signals,
                    "languages": sorted({"Python"} | ({"C#"} if "grasshopper" in tools else set()) | ({"JavaScript"} if "threejs" in tools else set())),
                    "last_commit": f"20{24 + c_idx}-{int(rng.integers(3, 12)):02d}-{int(rng.integers(1, 28)):02d}",
                }

            projects.append({
                "id": f"syn-{cohort.replace('/', '')}-{pid:03d}",
                "synthetic": True,
                "title": title,
                "students": [],
                "cohort": cohort,
                "cohort_idx": c_idx,
                "work_type": work_type,
                "abstract": abstract,
                "methods": methods,
                "data": data,
                "tools": sorted(tools),
                "scale": scale,
                "domains": domains,
                "raw_references": refs,
                "repo": repo,
                "sources": [{"type": "synthetic", "url": None}],
                "_latent_theme": theme,  # kept only to evaluate clustering; never used by the pipeline
            })
            pid += 1

    external = build_external_sample(rng)
    return {"projects": projects, "cohorts": COHORTS, "external": external}


def build_external_sample(rng: np.random.Generator, n: int = 180) -> list[dict]:
    """Stand-in for an OpenAlex query on AI + architecture/urbanism literature."""
    docs = []
    for i in range(n):
        topic = _pick(rng, EXTERNAL_TOPICS)
        if topic == "covered":
            theme = str(rng.choice(list(THEMES)))
            th = THEMES[theme]
            domain = _pick(rng, th["domains"])
            method = _pick(rng, th["methods"])
            data = [str(rng.choice(th["data"]))]
            text = _abstract(rng, theme, domain, method, data, _pick(rng, th["scales"]), str(rng.choice(PLACES)), "thesis")
            text = text.replace("This thesis", "This paper")
            methods, domains = [method], [domain]
        else:
            probs, meths, outs, methods, domains = EXTERNAL_TEXT[topic]
            text = " ".join([str(rng.choice(probs)), str(rng.choice(meths)), str(rng.choice(outs))])
        docs.append({"id": f"ext-{i:03d}", "topic": topic, "text": text, "methods": methods, "domains": domains,
                     "year": int(rng.integers(2019, 2027))})
    return docs
