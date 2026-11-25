# IAAC Blog (blog.iaac.net) as a place where student work is published and found

Research date: 25 November 2026. Most facts below come from direct observation: the public WordPress REST API and the public HTML pages of blog.iaac.net, fetched on 25 Nov 2026. I downloaded all 4,227 posts (with content) from the API and analysed them with a script. "Observed" = seen directly. "Inferred" = my interpretation. All counts are snapshots and change daily.

Key API endpoints used (all public, no login):
- Root: https://blog.iaac.net/wp-json/
- Posts: https://blog.iaac.net/wp-json/wp/v2/posts (header X-WP-Total)
- Categories: https://blog.iaac.net/wp-json/wp/v2/categories?per_page=100
- Tags: https://blog.iaac.net/wp-json/wp/v2/tags?per_page=100&orderby=count
- Custom taxonomies: https://blog.iaac.net/wp-json/wp/v2/course?per_page=100 , https://blog.iaac.net/wp-json/wp/v2/course_year , https://blog.iaac.net/wp-json/wp/v2/course_term
- Users: https://blog.iaac.net/wp-json/wp/v2/users?per_page=100
- Media: https://blog.iaac.net/wp-json/wp/v2/media

## Q1. Who publishes, and what is the upload/submission process?

### Takeaway
Students publish their own posts. Each student self-registers for a WordPress account on the blog (with programme and year) and is the author or a co-author of a post. I found NO public guideline, style guide, template or checklist for how to write or upload a post; any instructions are presumably given inside courses (not public).

### Cited Findings
- (Observed) The blog has a public registration page. Its form asks for Username, First name, Last name, E-mail, Password, "Programme" (drop-down with 15 options, e.g. "Master in AI for Architecture and the Built Environment 01/02") and a year field (2022-2023 to 2026-2027). — [Register page](https://blog.iaac.net/register/)
- (Observed) The registration drop-down already lists a programme that has no posts yet: "Master in Ecological Architecture and Advanced Construction 01/02" (MEAAC; its categories have 0 posts). — [Register page](https://blog.iaac.net/register/); [Categories API](https://blog.iaac.net/wp-json/wp/v2/categories?per_page=100)
- (Observed) The site also has Login, Account, Members, Password-reset and Logout pages (these come from the "Ultimate Member" plugin; the REST API exposes a `um_form` post type). — [Pages API](https://blog.iaac.net/wp-json/wp/v2/pages?per_page=100); [Types API](https://blog.iaac.net/wp-json/wp/v2/types)
- (Observed) 778 user accounts exist. The user slugs are personal names (e.g. "aakriti" = "Aakriti Singh"), which shows students hold their own accounts. — [Users API](https://blog.iaac.net/wp-json/wp/v2/users?per_page=100)
- (Observed) 758 distinct primary authors across 4,227 posts; the most active account has only 19 posts. This is a very flat distribution: many students, each with a few posts, not a central editor. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)
- (Observed) The "Co-Authors Plus" plugin is active (`coauthors/v1` namespace). 2,444 of 4,227 posts (58%) have 2 or more co-authors; 188+ have 6 or more. This matches group work. — [REST root](https://blog.iaac.net/wp-json/); [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts?_fields=id,coauthors)
- (Observed) WordPress login is at the standard path (wp-login.php returns a 302 redirect to the custom login page). — https://blog.iaac.net/wp-login.php ; [Login page](https://blog.iaac.net/login/)
- (Observed) Web searches for an IAAC "how to post on the blog" guide or student blog submission guidelines returned no IAAC page. — WebSearch, 25 Nov 2026 (no IAAC results)

### Inferences
- Students post directly (self-service), not via a faculty or comms editor. Faculty/staff likely set categories and "course" terms (these terms look admin-made, with codes like "MaAI01 25/26"), and students select them when they post.
- Because there is no public template, each post's structure, tags and links depend on the student. The data below (missing tags, very short posts, duplicate titles) is consistent with this.

### Gaps
- No public document shows deadlines, required sections, image rules or who reviews posts before publication. It is not visible if a post needs approval (post status data for drafts is not public).
- I could not confirm the role of staff accounts (WordPress hides user roles from the public API).

## Q2. Platform

### Takeaway
WordPress, hosted on Kinsta behind Cloudflare, with the GeneratePress theme, Yoast SEO, Pods (custom taxonomies), Co-Authors Plus, Ultimate Member and Contact Form 7. The current blog only holds posts from Oct 2022 onward; older work (2011-2022) lives on a separate site.

### Cited Findings
- (Observed) REST namespaces include wp/v2, coauthors/v1, generatepress-pro/v1, yoast/v1, pods/v1, contact-form-7/v1, duplicate-post/v1, ultimate-vc/v1. Response headers show `x-kinsta-cache` and `Server: cloudflare`. — [REST root](https://blog.iaac.net/wp-json/)
- (Observed) Custom taxonomies: `course` (590 terms), `course_year` (5 terms: 2022-2023 to 2026-2027), `course_term` (1st-4th Term). — [Taxonomies API](https://blog.iaac.net/wp-json/wp/v2/taxonomies)
- (Observed) Totals: 4,227 posts; 104,407 media files. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts?per_page=1) (X-WP-Total); [Media API](https://blog.iaac.net/wp-json/wp/v2/media?per_page=1)
- (Observed) Oldest post: 19 Oct 2022; newest: 25 Nov 2026. Posts per calendar year: 2022: 300 (Oct-Dec only), 2023: 1,214, 2024: 1,261, 2025: 954, 2026: 498 (to 25 Nov). — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)
- (Observed) The footer links "Older Versions: IAAC Blog 2011-2022" to https://www.iaacblog.com . That site returned HTTP 403 Forbidden to automated requests (curl and WebFetch) on 25 Nov 2026. The Wayback Machine has 200-status snapshots up to 15 Nov 2026. — [Home page](https://blog.iaac.net/); [iaacblog.com](https://www.iaacblog.com/); [Wayback availability](https://archive.org/wayback/available?url=iaacblog.com)

### Inferences
- IAAC student work is split across two separate WordPress sites by date (2011-2022 vs. 2022-now). A visitor cannot search both at once. (Inferred from the two separate sites; I could not inspect iaacblog.com directly.)

### Gaps
- I could not verify the content, size, or search features of iaacblog.com (403 to automated access). A human check in a browser is needed.

## Q3. How a visitor finds work (navigation, search, tags, attachments)

### Takeaway
A visitor can browse by programme (category menu), and on programme pages filter by year, term and course. Search is a single keyword box. There is no filter by topic, method, tool, or data type except through free tags, and 28% of posts have no tags. Code, data, PDFs and 3D models are not attached in any standard way; only ~2% of posts link to GitHub.

### Cited Findings
Navigation and search
- (Observed) Main menu: Home, "Projects" (drop-down of programmes and cohorts 01/02), Syllabi, Login, Search. Programme URLs use the base `/projects/` (e.g. /projects/maai-master-in-ai-for-architecture-and-the-built-environment/). The WordPress default /category/... URL returns 404. — [Home](https://blog.iaac.net/); [MaAI programme page](https://blog.iaac.net/projects/maai-master-in-ai-for-architecture-and-the-built-environment/)
- (Observed) Programme pages have filter inputs for course_year, course_term and course. — [MaAI programme page](https://blog.iaac.net/projects/maai-master-in-ai-for-architecture-and-the-built-environment/)
- (Observed) The Search page has one input (`s`, keyword only). No facets. — [Search page](https://blog.iaac.net/search/)
- (Observed) The Syllabi page filters by Programme, Year (2022-2023 to 2025-2026 only; 2026-2027 is missing although 47 posts already use that year) and Term; it has 30 pages of course syllabi. — [Syllabi](https://blog.iaac.net/syllabi/); [course_year API](https://blog.iaac.net/wp-json/wp/v2/course_year)
- (Observed) Programme and course pages show an unrendered shortcode as visible text: `[print-menu name="programmes"] -->` next to "Select Programme". — [MaAI programme page](https://blog.iaac.net/projects/maai-master-in-ai-for-architecture-and-the-built-environment/); [Course page MaAI 24/25 Research Studio](https://blog.iaac.net/course/maai-24-25-research-studio/)

Tags
- (Observed) Only 58 tags exist, but tag IDs go up to 2900, which suggests the tag list was pruned or curated. No tag is used only once; 6 new tags (ai-in-design, design-copilots, generative-ai, advanced-bim, mcp, baseline) have 0 posts. Top tags: computational-design 1,235; urban-planning 590; urban-design 566; digital-fabrication 518; artificial-intelligence 508; python 436. — [Tags API](https://blog.iaac.net/wp-json/wp/v2/tags?per_page=100&orderby=count)
- (Observed) Tags are broad and mixed: domains (urban-design), tools (python, karamba, bim), materials (material-wood, material-clay), and course names (ai-in-urbanism-i, ai-in-urbanism-ii, greenskills-4-cities). There is no tag for most AI methods (no "machine-learning", "computer-vision", "reinforcement-learning", "llm", "graph" tags). — [Tags API](https://blog.iaac.net/wp-json/wp/v2/tags?per_page=100&orderby=count)
- (Observed) 1,166 of 4,227 posts (27.6%) have no tags; average 3.2 tags per post. 13 of 77 MaAI posts have no tags. Untagged posts per year: 2022: 76, 2023: 332, 2024: 355, 2025: 260, 2026: 143. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts?_fields=id,tags)

Course taxonomy (the most detailed index)
- (Observed) 590 `course` terms. 97 have 0 posts, 50 have exactly 1, 208 have 3 or fewer. — [Course API](https://blog.iaac.net/wp-json/wp/v2/course?per_page=100)
- (Observed) Course naming is not consistent: "MaAI 24/25 ...", "MaAI01 25/26 ...", "MAAI01 25/26", "MRAC01 MAAI 25/26", "MaCAD 2025/26". One term has slug `maai01-24-25-ai-theory` but the label "MaAI 25/26 AI Theory_The Invisible Human...". The same name "MaCT01 22/23 Generative Urban Design" exists twice. — [Course API](https://blog.iaac.net/wp-json/wp/v2/course?per_page=100)
- (Observed) Several MaAI 24/25 course terms have 0 posts: AI Methods I Hackathon, AI Methods II Hackathon, AI for Robotic Fabrication Workshop, Natural Ecosystems Design, EADA Leading Yourself. But there ARE MaAI posts about the AI for Robotic Fabrication workshop (e.g. [post](https://blog.iaac.net/ai-for-robotic-fabrication-workshop-reinforcement-learning-for-intelligent-grid-based-carving/)), so the course filter misses them. — [Course API](https://blog.iaac.net/wp-json/wp/v2/course?per_page=100)
- (Observed) 56 posts have no course term and 53 have no course_year. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)

Attachments and links (regex over post HTML, all 4,227 posts)
- (Observed) Posts linking to github.com: 85 of 4,227 (2.0%); MaAI: 8 of 77 (10%); MRAC 38/356; MaCAD 19/825; MAA 9/1,788. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)
- (Observed) Links to .pdf: 67 posts; Google Drive/Docs links: 63; YouTube: 502; Vimeo: 30; Hugging Face: 7; Streamlit: 5; Sketchfab (3D): 1; Colab: 1; issuu: 7. There is no download field, repository field or dataset field in the post data; links are only free text in the body. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)
- (Observed) 521 posts (12%) have fewer than 30 words of text (median 436 words). — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)

### Inferences
- A visitor can answer "show me MaAI 24/25 Research Studio posts", but not "show me all projects that use reinforcement learning", "all projects with code", or "all projects with a dataset" without reading posts one by one or guessing keywords.
- The 5-level navigation (programme > cohort > year > term > course) mirrors the school's admin structure, not the visitor's questions (topic, method, tool, outcome).

### Gaps
- I did not test the quality of keyword search results (e.g. ranking). WordPress default search matches words in title/content only (general WordPress behaviour, not verified on this site's configuration).

## Q4. Posts per programme

### Takeaway
About 4,227 posts in total; MAA has the most (~1,788), MaAI is very small (77 posts, all since Dec 2024).

### Cited Findings
- (Observed) Distinct posts per programme (a post is counted once even if it is in several sub-categories): MAA 1,788; MaCAD 825; MaCT 574; MRAC 356; MAEBB 341; MaUP 198; MaAI 77; 3DPA 68; MEAAC 0. — [Categories API](https://blog.iaac.net/wp-json/wp/v2/categories?per_page=100); [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)
- (Observed) Raw category counts: maa-01 880, macad 825, maa (parent) 459, maa-02 449, mact-01 434, mrac-01 270, maebb-01 242, maup 198, mact-02 123, mrac-02 68, 3dpa 68, maebb 58, maebb-02 41, maai-01 34, maai (parent) 27, mrac 18, mact 17, maai-02 16. — [Categories API](https://blog.iaac.net/wp-json/wp/v2/categories?per_page=100)
- (Observed) First MaAI post: 6 Dec 2024. 27 of 77 MaAI posts are only in the parent MaAI category (no 01/02 cohort). Course years: 2022-23: 954 posts, 2023-24: 1,352, 2024-25: 1,106, 2025-26: 715, 2026-27: 47. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts); [course_year API](https://blog.iaac.net/wp-json/wp/v2/course_year)
- (Observed) Example MaAI posts: [SeisNav](https://blog.iaac.net/seisnav/), [Reinforcement Learning for Robotic Pick and Place](https://blog.iaac.net/reinforcement-learning-for-robotic-pick-and-place/), [Urban vegetation analysis using computer vision](https://blog.iaac.net/urban-vegetation-analysis-using-computer-vision-and-deep-learning/), [CineFlow](https://blog.iaac.net/cineflow-an-ai-powered-cinematic-walkthrough-for-architectural-design/), [ADAPT_AI](https://blog.iaac.net/adapt_ai-your-copilot-for-sustainable-design/).

### Inferences
- One project often appears as several posts (one per course: e.g. "SeisNav" plus "Designing, communicating and programming a user interface: SeisNav"; "Green Liminals" feasibility + dashboard; "GG Worlds v.01 / v.2 / Blender plug-in"). There is no link object that groups posts of one project. (Inferred from titles in the MaAI post list.)

### Gaps
- The number of MaAI students per cohort is not on the blog, so I cannot compute "share of students who posted".

## Q5. Evidence of problems (uploading, finding, broken links, missing images, content loss)

### Takeaway
I found no public complaints (forums, reviews, Reddit) about the blog. But direct measurement shows concrete quality problems: duplicate posts, untagged posts, near-empty posts, inconsistent course labels, a visible template bug, some broken images (from Google-Docs-pasted images), and a split archive (pre-2022 work on a separate site that blocks automated access).

### Cited Findings
- (Observed) 163 titles occur more than once (402 posts), e.g. "La Memoria del Agua" x4, "Terraformed" x3. 329 post URLs end in "-2", "-3" etc. (WordPress adds this when a slug already exists, e.g. [comfortech...-2](https://blog.iaac.net/comfortech-intelligent-environmental-control-system-2/) next to [comfortech...](https://blog.iaac.net/comfortech-intelligent-environmental-control-system/)). 23 posts have numeric-only URLs (e.g. https://blog.iaac.net/122688-2/), and 7 have an empty title. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)
- (Observed) 320 posts embed images hosted on googleusercontent.com (typical when content is pasted from Google Docs). In a random sample of 40 such image URLs, 3 failed (2 x 404, 1 x 403) = ~7.5% broken. Examples: [Bund Finance Centre](https://blog.iaac.net/bund-finance-centre/), [Collaborative workflows for medical center in Mars](https://blog.iaac.net/collaborative-workflows-for-medical-center-in-mars-planet/), [Introduction to digital fabrication](https://blog.iaac.net/introduction-to-digital-fabrication/). — tested 25 Nov 2026
- (Observed) Images uploaded to the blog itself loaded fine: 60/60 sampled images returned 200 from blog-media.iaac.net. Note for developers: the raw REST API content still contains `blog.iaac.net/wp-content/...` image URLs, and those return 404 (60/60); the public HTML rewrites them to `blog-media.iaac.net`. So a tool that reuses the API must rewrite image URLs. — [Media API](https://blog.iaac.net/wp-json/wp/v2/media?per_page=1)
- (Observed) 55 posts have no featured image. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)
- (Observed) Visible template bug `[print-menu name="programmes"]` on programme/course pages; Syllabi year filter lacks 2026-2027. — [MaAI programme page](https://blog.iaac.net/projects/maai-master-in-ai-for-architecture-and-the-built-environment/); [Syllabi](https://blog.iaac.net/syllabi/)
- (Observed) Older work 2011-2022 is on a different domain (iaacblog.com) that returned 403 to automated fetches. — [iaacblog.com](https://www.iaacblog.com/)
- (Observed) Web searches for student reviews/complaints about the blog found only general Archinect threads about IAAC (cost, jobs), with nothing about the blog. — [Archinect thread](https://archinect.com/forum/thread/150052093/iaac-reviews-how-did-you-pay-for-it-how-happy-were-you-with-your-experience-network-after-graduation-quality-of-work-etc)

### Inferences
- Duplicates and "-2" slugs suggest students re-upload or repost the same project for several courses, or post twice by mistake (cannot tell which from public data).
- Pasting from Google Docs creates hot-linked images that can expire; this is a content-loss risk that grows with time.

### Gaps
- No public statement from IAAC about upload problems or content loss. No student testimony found. Do NOT claim on the slide that "students complain"; claim only the measured problems.

## Q6. Other places IAAC student work lives

### Takeaway
Code lives in GitHub organisations per programme (including iaac-maai with 123 repos), and in personal repos/GitBooks. Links between blog posts and repositories are rare and not standard.

### Cited Findings
- (Observed) GitHub org `iaac-maai` ("IAAC - MAAI"), created 9 Jun 2025, 123 public repos; homepage = the MaAI page on iaac.net. Of the latest 100 repos: 79 have a description, 0 have GitHub topics, 3 have a homepage link. — [GitHub API org](https://api.github.com/orgs/iaac-maai); [org page](https://github.com/iaac-maai)
- (Observed) Repo names in iaac-maai are not consistent, e.g. "hackathon-team4-resplan-18112026", "hackathon-team4-resplan", "Hackathon_Group_08", "Hackaton_Group3_AIMethods", "group-3-day4-assignment", "5-day4-assignment", "Group4-day4-assignment". — [GitHub API repos](https://api.github.com/orgs/iaac-maai/repos?per_page=100&sort=created)
- (Observed) Other IAAC GitHub orgs: `iaac-macad` (86 repos, created Dec 2022), `MRAC-IAAC` (93 repos, created Nov 2019), `IaaC` (48 repos, 2016). — [iaac-macad](https://github.com/iaac-macad); [MRAC-IAAC](https://github.com/MRAC-IAAC); [IaaC](https://github.com/IaaC)
- (Observed) GitHub repository search "iaac maai" = 9 results; "macad iaac" = 25 (many in personal accounts, e.g. NeilBersabe-Iaac/IAAC-THESIS-MACAD). — [GitHub search](https://github.com/search?q=iaac+maai&type=repositories)
- (Observed) Blog posts linking to GitHub orgs: MRAC-IAAC in 8 posts, iaac-macad in 4, iaac-maai in 3; the rest link to personal accounts. — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts)
- (Observed) Videos: 502 posts embed or link YouTube. Some students also keep personal GitBooks (e.g. a first-year IAAC student's notes). — [Posts API](https://blog.iaac.net/wp-json/wp/v2/posts); [javierserraa.gitbook.io](https://javierserraa.gitbook.io/term-1/undefined/landing)

### Inferences
- For a MaAI project, the writing/images (blog), code (GitHub org or personal), video (YouTube), and pre-2022 work (iaacblog.com) are in separate systems with no shared ID. Of 123 iaac-maai repos, only a handful are linked from the blog (3 posts link to the org), so most code is not findable from the blog, and the blog is not findable from the repo (no topics, 3 homepages).

### Gaps
- I did not check issuu or iaac.net project pages in depth (only 7 blog posts link to issuu; 4 to iaac.net).
- I did not count how many iaac-maai repos link back to a blog post in their README.
