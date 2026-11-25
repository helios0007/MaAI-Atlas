# The Cosmic Web and the Slime Mould (Physarum) Method: from astronomy and biology to a map of research

Scope note: This fact sheet follows the story in five steps: (1) cosmic web, (2) Tokyo rail slime mould experiment, (3) Jones 2010 agent model, (4) Burchett/Elek MCPM cosmic-web reconstruction, (5) prior use of these metaphors and methods to map knowledge. Each fact has a source URL. Where sources disagree, this is noted.

## Q1. Exact citations (Tero 2010, Jones 2010, Burchett 2020, Elek 2021/2022)

### Takeaway
All five core papers are confirmed with DOIs. "Elek 2021/2022" is two papers: Polyphorm (IEEE TVCG, vol. 27, 2021) and the Monte Carlo Physarum Machine paper (Artificial Life, vol. 28, 2022).

### Cited Findings
- **Tero et al. 2010**: Atsushi Tero, Seiji Takagi, Tetsu Saigusa, Kentaro Ito, Dan P. Bebber, Mark D. Fricker, Kenji Yumiki, Ryo Kobayashi, Toshiyuki Nakagaki. "Rules for Biologically Inspired Adaptive Network Design." *Science* 327(5964): 439-442, 22 Jan 2010. DOI: 10.1126/science.1177894. Lead author at Hokkaido University. — [PubMed](https://pubmed.ncbi.nlm.nih.gov/20093467/); [Full-text PDF copy](https://pdodds.w3.uvm.edu/files/papers/others/2010/tero2010a.pdf); [ScienceDaily](https://www.sciencedaily.com/releases/2010/01/100121141051.htm)
- **Jones 2010**: Jeff Jones. "Characteristics of Pattern Formation and Evolution in Approximations of Physarum Transport Networks." *Artificial Life* 16(2): 127-153, 2010. DOI: 10.1162/artl.2010.16.2.16202. (Volume/issue/DOI confirmed by search result; page range 127-153 is from my own knowledge and was NOT verified online.) — [UWE repository record](https://uwe-repository.worktribe.com/output/980579); [Sage Jenson's explainer, which credits this paper](https://cargocollective.com/sagejenson/physarum)
- Related follow-up: Jones 2011, "Influences on the formation and evolution of Physarum polycephalum inspired emergent transport networks," *Natural Computing* (online 30 Oct 2010). — [UWE repository](https://uwe-repository.worktribe.com/output/985963/influences-on-the-formation-and-evolution-of-physarum-polycephalum-inspired-emergent-transport-networks)
- **Burchett et al. 2020**: Joseph N. Burchett, Oskar Elek, Nicolas Tejos, J. Xavier Prochaska, Todd M. Tripp, Rongmon Bordoloi, Angus G. Forbes. "Revealing the Dark Threads of the Cosmic Web." *The Astrophysical Journal Letters* 891(2): L35, 2020. DOI: 10.3847/2041-8213/ab700c. arXiv:2003.04393 (submitted 9 Mar 2020). — [arXiv](https://www.arxiv.org/abs/2003.04393); [Papers with Code](https://paperswithcode.com/paper/revealing-the-dark-threads-of-the-cosmic-web)
- **Elek et al. 2021 (Polyphorm)**: Oskar Elek, Joseph N. Burchett, J. Xavier Prochaska, Angus G. Forbes. "Polyphorm: Structural Analysis of Cosmological Datasets via Interactive Physarum Polycephalum Visualization." *IEEE Transactions on Visualization and Computer Graphics* 27(2): 806-816, Feb 2021. DOI: 10.1109/TVCG.2020.3030407. arXiv:2009.02441. — [Library record](https://katalog.dhi-paris.fr/vufind/Record/NLM316732974/Description); [arXiv HTML](https://ar5iv.labs.arxiv.org/html/2009.02441)
- **Elek et al. 2022 (MCPM)**: Oskar Elek, Joseph N. Burchett, J. Xavier Prochaska, Angus G. Forbes. "Monte Carlo Physarum Machine: Characteristics of Pattern Formation in Continuous Stochastic Transport Networks." *Artificial Life* 28(1): 22-57, 2022. DOI: 10.1162/artl_a_00351. arXiv:2204.01256. — [arXiv](https://arxiv.org/abs/2204.01256); [PubMed](https://www.pubmed.gov/34905603/)
- **Cosmic web fractions source**: Cautun, M., et al. 2014. "Evolution of the cosmic web." *MNRAS* 441: 2923 (journal details from my knowledge; arXiv ID verified). arXiv:1401.7866. — [arXiv](https://arxiv.org/abs/1401.7866); [ar5iv full text](https://ar5iv.labs.arxiv.org/html/1401.7866)

### Inferences
- For slides, cite "Burchett et al. 2020, ApJL" for the astronomy result and "Elek et al. 2022, Artificial Life" for the method (MCPM). The Polyphorm 2021 paper is the software/visualization paper and has the best technical numbers.

### Gaps
- Jones 2010 page range and the full Cautun 2014 journal reference were not confirmed online in this session; check at the DOI before printing.

## Q2. Step-by-step story with concrete numbers and one-sentence plain-language explanations

### Takeaway
The story has a clear chain: the universe is a web of matter (filaments hold about half the mass in about 6% of the volume); a slime mould rebuilt the Tokyo rail network in 26 hours; Jones turned the mould into simple software agents; Elek and Burchett grew that software through 37,000+ real galaxies and then used Hubble quasar light to show the predicted threads really contain gas.

### Cited Findings

**Step 1: The cosmic web**
- Plain language: Matter in the universe is not spread evenly; gravity has pulled it into a 3D web of dense knots (clusters), long threads (filaments), thin sheets (walls) and huge near-empty bubbles (voids).
- Present-day mass and volume fractions from dark-matter simulation (NEXUS+ method, Table 3): nodes/clusters 11% of mass, <0.1% of volume; filaments 50% of mass, 6% of volume; walls 24% of mass, 18% of volume; voids 15% of mass, 77% of volume. — [Cautun et al. 2014, ar5iv](https://ar5iv.labs.arxiv.org/html/1401.7866)
- Cautun et al.: the filament network "contains, into a relatively small volume, half of the total cosmic matter distribution"; voids "take by far the largest volume fraction ... but they only have ~15% of the total mass." — [ar5iv](https://ar5iv.labs.arxiv.org/html/1401.7866)
- Max Planck Institute for Astrophysics (MillenniumTNG): simulations suggest filaments contain over 50% of the universe's matter. — [MPA highlight 2024](https://www.mpa-garching.mpg.de/1098309/hl202406)
- Luminous galaxies hold less than 10% of the normal (baryonic) matter; most of the rest is diffuse gas (the intergalactic medium) thought to lie along the web. — [Burchett et al. 2020, arXiv](https://www.arxiv.org/abs/2003.04393)
- Scale (sources vary by definition): typical void diameters about 30-300 million light-years (Heidelberg explainer) or 100-500 million light-years / 30-150 Mpc (2025 preprint); filaments about 6-15 million light-years thick and 150-300 million light-years long (2025 preprint), with prominent filaments reaching several hundred million light-years. — [Heidelberg STRUCTURES blog](https://structures.uni-heidelberg.de/blog/posts/2022_12_cw/); [arXiv 2503.20912](https://arxiv.org/pdf/2503.20912). Note: these numbers come from search snippets and are not standardized; void and filament sizes depend on the method.
- ESA: galaxy clusters form at the densest knots, where filaments intersect; the Planck simulation image spans about 900 million light-years. — [ESA Planck image 51104](https://sci.esa.int/web/planck/-/51104-numerical-simulation-of-the-cosmic-web)

**Step 2: Slime mould rebuilds the Tokyo rail network (Tero et al. 2010)**
- Plain language: Scientists put oat flakes where Tokyo-area cities are, let a brainless single-cell slime mould grow from "Tokyo", and it built a tube network about as good as the real railway designed by engineers.
- Method: 36 food sources representing cities in the Tokyo area; the plasmodium started at Tokyo, first filled much of the space, then thinned to a few thick tubes between food sources. Arena panel width 17 cm; snapshots at 0, 5, 8, 11, 16 and 26 hours. — [Tero et al. 2010, PDF](https://pdodds.w3.uvm.edu/files/papers/others/2010/tero2010a.pdf)
- Geography: the mould avoids bright light, so the team lit up the ocean, lakes and mountain areas to mimic terrain; this made the networks look more like the real rail map. — [Tero et al. 2010, PDF](https://pdodds.w3.uvm.edu/files/papers/others/2010/tero2010a.pdf)
- Results (normalized to the minimum spanning tree, the shortest possible network): cost (total length) rail ~1.8x vs Physarum 1.75 ± 0.30 (n = 21); transport efficiency 0.85 (rail) vs 0.85 ± 0.04 (Physarum); fault tolerance: only 4% of single faults would cut off part of the rail network vs 14 ± 4% (illuminated Physarum) and 20 ± 13% (unconstrained Physarum); about 30% of possible links in place; benefit/cost ratio ~0.5 for both. — [Tero et al. 2010, PDF](https://pdodds.w3.uvm.edu/files/papers/others/2010/tero2010a.pdf)
- Key conclusion: the mould did this "without centralized control or explicit global information," by reinforcing preferred routes and removing redundant ones. — [Tero et al. 2010, PDF](https://pdodds.w3.uvm.edu/files/papers/others/2010/tero2010a.pdf)
- Mathematical model: tubes with high flow get thicker, tubes with low flow shrink (flow follows Hagen-Poiseuille); with tuned parameters it gave networks very similar to Tokyo rail, and with other settings a better benefit/cost ratio (0.7) than both rail and mould. — [Tero et al. 2010, PDF](https://pdodds.w3.uvm.edu/files/papers/others/2010/tero2010a.pdf)
- Suggested uses: sensor arrays, mobile ad hoc and wireless mesh networks. — [ScienceDaily](https://www.sciencedaily.com/releases/2010/01/100121141051.htm)

**Step 3: Jones 2010 agent-based Physarum model**
- Plain language: Jones replaced the real mould with thousands of tiny virtual "particles"; each one only smells the trail ahead, turns toward the strongest smell, steps forward, and leaves more trail, and a network appears with no central plan.
- Model: a population of simple particle-like agents with local chemotaxis-like behaviour spontaneously forms complex, dynamic transport networks. — [Jones 2010 record (via search result)](https://uwe-repository.worktribe.com/output/980579)
- Loop (from Sage Jenson's explainer of the Jones model): **Sense** with three sensors (front-left, front, front-right) reading a trail map; **Rotate** left, right or straight according to the readings; **Move** forward by a step size; **Deposit** trail; then the trail map **diffuses** (3x3 mean filter) and **decays** (multiplied by a factor below 1). Tunable parameters: sensor distance, sensor angle, rotation angle, step size, deposit amount, decay factor. Jones's original also allowed at most one particle per grid cell. — [Sage Jenson, Physarum](https://cargocollective.com/sagejenson/physarum)
- Example parameter values used in Jones's follow-up work: sensor offset 5 pixels, sensor angle and rotation angle 60 degrees; RA < SA tends to contraction, RA > SA to spontaneous branching. — [Jones, arXiv 1212.0023](https://arxiv.org/pdf/1212.0023) (from search snippets; not from the 2010 paper itself)
- Sage Jenson, a Berlin-based media artist, made the artwork that inspired the UCSC team's approach. — [NASA Hubble release](https://science.nasa.gov/missions/hubble/slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/)

**Step 4: Monte Carlo Physarum Machine (MCPM) maps the cosmic web**
- Plain language: The team treated each real galaxy as a "food source" and let millions of virtual slime-mould agents grow between them in 3D; the trails they wore down are the best guess for where the invisible filaments are.
- MCPM is "a probabilistic generalization of Jones's 2010 agent-based model," extended to 3D; it reconstructs the large-scale distribution of gas and dark matter (the cosmic web) from sparse data. — [Elek et al. 2022, arXiv](https://arxiv.org/abs/2204.01256)
- Differences from Jones: each move is randomly sampled (direction, distance, branching probability) instead of always going to the maximum; only two directions sampled per step; galaxies/haloes are fixed points that emit deposit in proportion to their mass; agents may share cells; a separate "trace" field records visits and becomes the density map. — [Polyphorm, ar5iv](https://ar5iv.labs.arxiv.org/html/2009.02441)
- Validation first on a dark-matter simulation (~840,000 Bolshoi-Planck haloes in a 170 Mpc box), then on real data. — [Polyphorm, ar5iv](https://ar5iv.labs.arxiv.org/html/2009.02441); [NASA](https://science.nasa.gov/missions/hubble/slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/)
- Real data: 37,000 SDSS galaxies (NASA; Polyphorm gives 37.6k; abstract summaries say "nearly 38,000"), out to about 300 million light-years; study region within 500 million light-years of Earth. — [NASA Hubble release](https://science.nasa.gov/missions/hubble/slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/); [Polyphorm](https://ar5iv.labs.arxiv.org/html/2009.02441)
- Compute: 10 million agents; SDSS case converges in ~75 s (600 iterations) on one NVIDIA TitanX GPU. NASA: "runs in minutes," while a real mould in a dish takes days. — [Polyphorm](https://ar5iv.labs.arxiv.org/html/2009.02441); [NASA](https://science.nasa.gov/missions/hubble/slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/)
- Gas test with Hubble: light from 350 background quasars (Hubble Spectroscopic Legacy Archive; Polyphorm says 346 HST sightlines) was checked for hydrogen absorption where the model put filaments. Hydrogen gas was found along the mapped filaments, including far from galaxies, with filament gas reaching more than 10 million light-years from galaxies. — [NASA](https://science.nasa.gov/missions/hubble/slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/); [Polyphorm](https://ar5iv.labs.arxiv.org/html/2009.02441)
- Scientific result: "the bulk of the IGM indeed resides in the Cosmic Web"; H I absorption rises from filament outskirts (about the cosmic mean density) to denser regions (up to ~200x mean), but is suppressed in the densest places, likely from shock-heating/ionization or galaxy feedback. — [Burchett et al. 2020, arXiv](https://www.arxiv.org/abs/2003.04393)
- Quotes: Burchett: "one of the simplest forms of life actually enables insight into the very largest-scale structures in the universe"; Elek: "You can literally watch it grow." — [NASA](https://science.nasa.gov/missions/hubble/slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/)
- NASA release date: 10 March 2020. — [NASA](https://science.nasa.gov/missions/hubble/slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/)

**Step 5: From the cosmic web to maps of knowledge**
- Plain language: The same "grow a network between points" idea has already been moved from galaxies to words, and science mappers have long drawn fields of research as networks of nodes and links, so mapping student projects as a slime-mould web is a new but well-grounded step.
- MCPM was applied to language: "Bio-inspired Structure Identification in Language Embeddings" (Zhou, Elek et al.) ran MCPM on word embeddings and found a single densely interconnected network; this led to the Polyglot web app, now part of the PolyPhy toolkit. — [arXiv 2009.02459](https://arxiv.org/pdf/2009.02459); [Polyglot project page](https://normand-1024.github.io/Bio-inspired-Exploration-of-Language-Embedding); [UCSC Engineering news](https://engineering.ucsc.edu/?p=6014)
- MCPM paper itself says the method has other domain uses, shown as proofs of concept. — [Elek et al. 2022, arXiv](https://arxiv.org/abs/2204.01256)
- Science maps ("scientographs", knowledge domain maps) are visual representations of the structure and dynamics of scholarly knowledge; most use network layouts. — [Petrovich, Science maps](https://iris.unito.it/bitstream/2318/1888032/1/Petrovich_Science%20maps_academia_version.pdf)
- Börner, *Atlas of Science: Visualizing What We Know* (MIT Press, 2010), based on the "Places & Spaces: Mapping Science" exhibit, has 30+ full-page science maps. — [History of Information](https://historyofinformation.com/detail.php?entryid=3789); [Shneiderman review in Nature](https://www.cs.umd.edu/~ben/Borner-BookReview-Atlas_of_Science-Nature.pdf)
- Boyack, Klavans & Börner 2005, "Mapping the backbone of science," *Scientometrics* 64(3). — [IDEAS/RePEc](https://ideas.repec.org/a/spr/scient/v64y2005i3d10.1007_s11192-005-0255-6.html)
- Bollen et al. 2009, "Clickstream Data Yields High-Resolution Maps of Science," *PLoS ONE* 4(3): e4803 — built from nearly 1 billion user interactions in scholarly portals (2007-2008). — [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC2652715)
- Rosvall & Bergstrom: citation-flow map of 6,128 journals and 6,434,916 citations partitioned into 88 modules (Infomap, a random-walk method, not Physarum). — [arXiv 0707.0609](https://arxiv.org/pdf/0707.0609)
- Physarum algorithms have been used on general networks: shortest paths, travelling salesman, Steiner trees, and ranking influential nodes in complex networks (PLoS ONE 2013). — [Physarum-inspired Network Optimization review](https://ar5iv.arxiv.org/html/1712.02910); [PLoS ONE 2013](https://www.doi.org/10.1371/JOURNAL.PONE.0066732)
- Cosmic web as a cross-domain analogy: Vazza & Feletti 2020 compared the human brain's neuron network with the cosmic web and found statistical similarities (both differ strongly from random networks). — [Frontiers in Physics, doi 10.3389/fphy.2020.525731](https://www.frontiersin.org/articles/10.3389/fphy.2020.525731/full)

### Inferences
- A clean one-line arc for architects: "A slime mould designed a railway; a programmer turned it into simple rules; astronomers used those rules to draw the hidden skeleton of the universe; we use the same rules to draw the hidden links between student projects."
- Analogy mapping for the atlas: galaxies -> projects; filaments -> shared themes/strong links; nodes/clusters -> research hubs; voids -> unexplored topics. This is the presenter's metaphor, not a claim from the sources.
- The language-embedding work (Polyglot) is the closest precedent: it shows MCPM working on abstract "idea space" points, not only on physical positions.
- Note for architects: Tero's three metrics (cost, efficiency, fault tolerance) are the same trade-offs used in infrastructure planning.

### Gaps
- I found no source that uses a Physarum/slime-mould algorithm specifically to map citation networks or a "map of science." The language-embedding work is the nearest found precedent.
- I found no source that explicitly uses "cosmic web" as a metaphor for a map of science; the visual resemblance of science maps to the cosmic web is a common observation, but I could not cite it.
- Void and filament size ranges are definition-dependent and came from search snippets (Heidelberg blog, 2025 preprint); no NASA/ESA page with official figures was found.
- The UCSC news release on Burchett/Elek 2020 was not fetched directly.

## Q3. Public images and explainer pages (URLs only)

### Takeaway
The NASA Hubble 2020 release is the main visual source; AAS Nova, Planetary Society, ESA and MPA provide extra images.

### Cited Findings
- NASA Hubble release, "Slime Mold Simulations Used to Map Dark Matter Holding Universe Together" (10 Mar 2020) — https://science.nasa.gov/missions/hubble/slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/
- Main image "Cosmic Web and Slime Mold" (credit NASA, ESA, J. Burchett and O. Elek, UC Santa Cruz) — https://assets.science.nasa.gov/dynamicimage/assets/science/missions/hubble/releases/2020/03/STScI-01EVSTSZJZS3ZKNPGQ71ZHRRWV.tif?w=900&h=900&fit=clip — [source page](https://science.nasa.gov/missions/hubble/slime-mold-simulations-used-to-map-dark-matter-holding-universe-together/)
- NASA/STScI release PDF — https://assets.science.nasa.gov/content/dam/science/missions/hubble/releases/2020/03/STScI-01EVSQRE10S6795NS9A4VG4VDS.pdf
- AAS Nova, "Featured Image: On the Cosmic Web and Slime Mold" (4 May 2020) — https://aasnova.org/2020/05/04/featured-image-on-the-cosmic-web-and-slime-mold/
- Planetary Society image, "Reconstruction of the cosmic web" — https://planetary.org/space-images/reconstruction-of-the-cosmic-web
- ESA, "Simulation of the cosmic web" (2025, Illustris simulation) — https://www.esa.int/ESA_Multimedia/Images/2025/06/Simulation_of_the_cosmic_web
- ESA Planck, "Numerical simulation of the cosmic web" (~900 million light-years across) — https://sci.esa.int/web/planck/-/51104-numerical-simulation-of-the-cosmic-web
- Max Planck Institute for Astrophysics, MillenniumTNG cosmic filaments — https://www.mpa-garching.mpg.de/1098309/hl202406
- Sage Jenson, Physarum artwork and model explainer — https://cargocollective.com/sagejenson/physarum
- National Geographic, "Slime mould attacks simulates Tokyo rail network" (2010) — https://www.nationalgeographic.com/science/article/slime-mould-attacks-simulates-tokyo-rail-network
- Polyglot (MCPM on language embeddings) — https://normand-1024.github.io/Bio-inspired-Exploration-of-Language-Embedding

### Inferences
- Tero 2010 Fig. 1 (time-lapse 0-26 h) and Fig. 2 (mould vs rail map) are the iconic images, but they are copyright AAAS/Science; check permission or use the National Geographic article image with credit.

### Gaps
- Image reuse licences were not checked. NASA images are usually public domain, but the slime-mould image is co-credited to Burchett and Elek; confirm before use.
