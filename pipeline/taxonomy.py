"""
Controlled vocabularies for the MaAI Atlas metadata schema.

Every extracted or submitted value must map to one of these ids. Synonyms are
used by the keyword extractor (extract.py) to tag free text such as blog posts.
New terms proposed by students or by an LLM go to review before being added here.
"""

from __future__ import annotations

# id: (label, family, synonyms)
METHODS: dict[str, tuple[str, str, list[str]]] = {
    "gnn": ("Graph Neural Network", "Graph learning", ["graph neural network", "gnn", "graph convolution", "gcn", "graph attention", "graphsage"]),
    "random-forest": ("Random Forest", "Classical ML", ["random forest"]),
    "gradient-boosting": ("Gradient Boosting", "Classical ML", ["xgboost", "lightgbm", "gradient boosting", "catboost"]),
    "spatial-clustering": ("Spatial Clustering", "Classical ML", ["dbscan", "k-means", "kmeans", "spatial clustering", "hdbscan"]),
    "agent-based-model": ("Agent-Based Model", "Simulation", ["agent-based", "agent based model", "multi-agent simulation"]),
    "diffusion": ("Diffusion Model", "Generative models", ["diffusion model", "stable diffusion", "latent diffusion", "ddpm"]),
    "controlnet": ("ControlNet", "Generative models", ["controlnet"]),
    "gan": ("GAN", "Generative models", ["gan", "generative adversarial", "pix2pix", "stylegan", "cyclegan"]),
    "graph-generation": ("Graph-to-Layout Generation", "Generative models", ["graph-to-plan", "house-gan", "layout graph", "graph2plan"]),
    "gaussian-splatting": ("3D Gaussian Splatting", "3D vision", ["gaussian splatting", "3dgs", "nerf", "neural radiance"]),
    "llm-agent": ("LLM Agent", "Language models", ["llm agent", "agentic", "tool-using llm", "autogen", "langchain agent"]),
    "rag": ("Retrieval-Augmented Generation", "Language models", ["retrieval-augmented", "retrieval augmented", "rag"]),
    "fine-tuning": ("Fine-Tuning / LoRA", "Language models", ["fine-tuning", "fine tuning", "lora"]),
    "vlm": ("Vision-Language Model", "Language models", ["vision-language", "vlm", "clip", "multimodal model", "gpt-4v"]),
    "embeddings": ("Semantic Embeddings", "Language models", ["embedding", "sentence-transformer", "semantic search"]),
    "knowledge-graph": ("Knowledge Graph", "Knowledge representation", ["knowledge graph", "ontology", "rdf", "neo4j"]),
    "surrogate-model": ("Physics Surrogate Model", "Scientific ML", ["surrogate model", "surrogate", "emulator"]),
    "pinn": ("Physics-Informed NN", "Scientific ML", ["physics-informed", "pinn"]),
    "cnn": ("CNN / U-Net", "Computer vision", ["cnn", "convolutional neural", "u-net", "unet", "resnet"]),
    "time-series-transformer": ("Time-Series Transformer", "Sequence models", ["time-series transformer", "temporal fusion", "lstm", "forecasting transformer"]),
    "computer-vision": ("Object Detection / Segmentation", "Computer vision", ["yolo", "object detection", "segmentation", "mask r-cnn", "segment anything", "sam"]),
    "reinforcement-learning": ("Reinforcement Learning", "Control & robotics", ["reinforcement learning", "ppo", "soft actor-critic", "deep q"]),
    "imitation-learning": ("Imitation Learning", "Control & robotics", ["imitation learning", "learning from demonstration", "behaviour cloning", "behavior cloning"]),
    "pointnet": ("Point Cloud Networks", "3D vision", ["pointnet", "point cloud network", "point transformer"]),
    "causal-inference": ("Causal Inference", "Causal & reasoning", ["causal inference", "causal model", "counterfactual", "difference-in-differences"]),
    "world-model": ("World Model", "Control & robotics", ["world model", "dreamer", "model-based reinforcement"]),
}

DATA: dict[str, tuple[str, list[str]]] = {
    "osm": ("OpenStreetMap", ["openstreetmap", "osm", "osmnx"]),
    "gtfs": ("GTFS Transit Feeds", ["gtfs", "transit feed"]),
    "street-view": ("Street-Level Imagery", ["street view", "mapillary", "street-level imagery"]),
    "mobile-telemetry": ("Mobility Telemetry", ["mobile phone data", "telemetry", "bike-share trips", "gps traces"]),
    "cadastre": ("Cadastre / Parcels", ["cadastre", "cadastral", "parcel data"]),
    "floorplan-corpus": ("Floor Plan Corpus (RPLAN etc.)", ["rplan", "floor plan dataset", "floorplan corpus", "cubicasa"]),
    "synthetic-rhino": ("Synthetic Rhino/Grasshopper Data", ["synthetic dataset", "grasshopper-generated", "parametric dataset"]),
    "objaverse": ("3D Model Repositories", ["objaverse", "shapenet", "3d model repository"]),
    "era5": ("ERA5 Reanalysis", ["era5", "reanalysis"]),
    "landsat": ("Landsat / LST", ["landsat", "land surface temperature", "lst"]),
    "sentinel-2": ("Sentinel-2", ["sentinel-2", "sentinel 2", "copernicus"]),
    "epw": ("EPW Weather Files", ["epw", "weather file"]),
    "energy-sims": ("Simulated Energy Data", ["energyplus", "honeybee", "simulation results", "ladybug"]),
    "air-quality-sensors": ("Air Quality Sensors", ["pm2.5", "air quality sensor", "no2"]),
    "robot-toolpaths": ("Robot Toolpaths & Logs", ["toolpath", "robot logs", "kuka", "abb robot"]),
    "3d-scans": ("3D Scans / Point Clouds", ["3d scan", "photogrammetry", "lidar", "point cloud"]),
    "depth-sensors": ("Depth / Force Sensors", ["depth camera", "realsense", "force sensor"]),
    "bim-ifc": ("BIM / IFC Models", ["ifc", "bim model", "revit"]),
    "building-codes": ("Building Codes & Regulations", ["building code", "zoning regulation", "planning regulation"]),
    "iaac-archive": ("IAAC Archive / Student Work", ["iaac archive", "student projects", "thesis archive"]),
    "scholarly": ("Scholarly Metadata (OpenAlex)", ["openalex", "semantic scholar", "crossref"]),
    "post-occupancy": ("Post-Occupancy Sensor Data", ["post-occupancy", "occupant feedback", "indoor comfort sensors"]),
}

TOOLS: dict[str, tuple[str, list[str]]] = {
    "python": ("Python", ["python"]),
    "pytorch": ("PyTorch", ["pytorch", "torch"]),
    "tensorflow": ("TensorFlow", ["tensorflow", "keras"]),
    "scikit-learn": ("scikit-learn", ["scikit-learn", "sklearn"]),
    "grasshopper": ("Grasshopper", ["grasshopper"]),
    "rhino": ("Rhino", ["rhino", "rhinocommon"]),
    "comfyui": ("ComfyUI", ["comfyui"]),
    "qgis": ("QGIS", ["qgis"]),
    "ros": ("ROS", ["ros", "ros2"]),
    "unity": ("Unity", ["unity"]),
    "blender": ("Blender", ["blender"]),
    "langchain": ("LangChain / LlamaIndex", ["langchain", "llamaindex"]),
    "neo4j": ("Neo4j", ["neo4j"]),
    "threejs": ("Three.js / Web", ["three.js", "threejs", "react"]),
}

# id: (label, group)
DOMAINS: dict[str, tuple[str, str]] = {
    "urban-mobility": ("Urban Mobility", "Urban Analytics"),
    "urban-morphology": ("Urban Morphology", "Urban Analytics"),
    "public-space": ("Public Space & Streetscape", "Urban Analytics"),
    "floor-plan-layout": ("Floor Plan Layout", "Generative Design"),
    "facade-design": ("Facade Design", "Generative Design"),
    "massing": ("Massing & Form-Finding", "Generative Design"),
    "urban-climate": ("Urban Climate & Heat", "Climate & Energy"),
    "building-energy": ("Building Energy", "Climate & Energy"),
    "air-quality": ("Air Quality", "Climate & Energy"),
    "robotic-fabrication": ("Robotic Fabrication", "Fabrication & Materials"),
    "materials": ("Bio-based & Reclaimed Materials", "Fabrication & Materials"),
    "construction-monitoring": ("Construction Monitoring", "Fabrication & Materials"),
    "building-codes": ("Codes & Compliance", "Knowledge & Tools"),
    "design-knowledge": ("Design Knowledge & Precedents", "Knowledge & Tools"),
    "education": ("AI in Design Education", "Knowledge & Tools"),
    "post-occupancy": ("Post-Occupancy & Operation", "Building Operation"),
}

SCALES = ["object", "building", "block", "city", "region"]

WORK_TYPES = ["thesis", "studio", "seminar", "workshop"]
WORK_TYPE_LABELS = {"thesis": "Thesis", "studio": "Studio", "seminar": "Seminar", "workshop": "Workshop"}


def method_label(mid: str) -> str:
    return METHODS[mid][0] if mid in METHODS else mid


def method_family(mid: str) -> str:
    return METHODS[mid][1] if mid in METHODS else "Other"


def data_label(did: str) -> str:
    return DATA[did][0] if did in DATA else did


def tool_label(tid: str) -> str:
    return TOOLS[tid][0] if tid in TOOLS else tid


def domain_label(did: str) -> str:
    return DOMAINS[did][0] if did in DOMAINS else did


def domain_group(did: str) -> str:
    return DOMAINS[did][1] if did in DOMAINS else "Other"
