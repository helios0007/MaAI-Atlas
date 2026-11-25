# MaAI Atlas · Speaker script

About 14 minutes at 130 to 140 words per minute. Times are approximate.
Navigation: arrow keys or space. `story.html#8` opens slide 8 directly.
To present, double-click `present.bat` in this folder. It starts a local server and opens the deck, so slides 8 and 10 show the live Atlas. Keep its black window open until you finish. If you open `story.html` directly, slide 8 shows a still image and slide 10 plays a recorded video of the same change.
Keep the Chrome window in front. Chrome slows down a window that is behind other windows.
The answers at the end of this file are for questions. You can also read them out if you have time.

---

## 1 · MaAI Atlas (20 s)

Good morning. This is MaAI Atlas: one searchable map of the student research in our master. I will show you the problem first, then the tool, and then two ideas that shaped how it looks.

---

## 2 · Good student work becomes invisible after each year (2 min)

Every year this programme produces strong research. But a year later, almost no one can find it or build on it. I see six reasons. The first three are about the IAAC blog. The last three are about the programme as a whole.

**01 · Hard to upload work.**
The blog accepts text and images. That is all it is designed for. Our projects are code, datasets, trained models, thesis PDFs and 3D files, and a post has no standard place for any of them. The instructions also change from course to course. One brief I read says to post on the course blog, submit the scripts separately, and wait for "further instructions" before the deadline. Other syllabi ask only for a few images for the blog. So what is on the blog is a small part of the project.

**02 · Hard to find work.**
There are about 4,200 posts on blog.iaac.net. You can filter by programme, year and course, and there is one keyword search box. You cannot search by topic, by AI method, or by dataset. The blog has 58 broad tags, and none of them is for a method such as machine learning or computer vision. More than a quarter of all posts have no tags. There are 590 course labels with inconsistent names, and some MaAI courses show zero posts even though the posts exist.

**03 · Parts are not connected.**
One project lives in four places: the blog post, a GitHub repository, a video, and the thesis PDF. Nothing links them. Only 2 percent of blog posts link to GitHub. In our MaAI GitHub organisation there are 123 repositories, and only three blog posts link to it.

**04 · Scattered everywhere.**
Older work, from before late 2022, is on a different website, iaacblog.com. So even the history of the school is in two places.

**05 · No big picture.**
On day one, a new student cannot see what earlier cohorts already solved, which tools everyone uses, or which topics are growing or fading. You can only read post by post.

**06 · Hidden blind spots.**
Because of this, students repeat ideas that already exist, and open questions right next to them stay invisible.

The result: each new cohort starts again from zero.

*(Facts: WordPress API of blog.iaac.net, all posts read on 25 Nov 2026; IAAC course briefs and syllabi, 2025-26; github.com/iaac-maai.)*

---

## 3 · One atlas answers each problem (1 min 30 s)

MaAI Atlas answers each of these six problems directly.

**01 · Hard to upload → "Add my work" form.**
A student adds the title, abstract, repository link and the methods and data used. The project appears on the map at once and goes to a faculty review queue. Nothing becomes public without consent.

**02 · Hard to find → Search by meaning.**
You type a normal sentence, for example "cooling hot city streets". The search compares the meaning, not the exact words, so it finds projects that say "urban heat" or "microclimate".

**03 · Not connected → One record per project.**
Every project gets one standard record that links the blog post, the code, the PDF and the references.

**04 · Scattered → One shared map.**
All projects from all cohorts are on one map, grouped automatically into branches by what they are about.

**05 · No big picture → Trends by cohort.**
You can step through 24/25, 25/26 and 26/27 and see which branches grow and which fade.

**06 · Blind spots → Gap detection.**
Four independent checks find open thesis topics. Each gap comes with its evidence, so a student can judge it.

Today the map uses 192 demo projects. The connector to the real blog is already written. It needs only the permission to publish real student work.

---

## 4 · Four sources feed one automatic pipeline (1 min 15 s)

How do we gather the data? There are three ways in, and after that everything is automatic.

**First, we read what is already public.** The IAAC blog runs on WordPress, and WordPress has a public data feed. Our connector asks that feed for the MaAI posts only, one request per second, so it never loads the server. For each post it keeps the text, the authors, the course, the images and every link in the post. When a post links to GitHub, we read the repository too, and check six habits that make code reusable.

**Second, we ask the students.** The "Add my work" form collects what the blog cannot: the repository, the dataset, the methods, and the permission to publish.

**Third, in the next phase, the thesis PDFs.** A tool called GROBID reads the full PDF, and OpenAlex matches each reference to a real paper.

Then the pipeline does the rest. It cleans the text, tags the methods, tools and datasets, and keeps the sentence that each tag comes from. It merges the references, turns each project into a fingerprint of 64 numbers, and places it on the map. Nobody types data into a spreadsheet. But a person checks it: every record stays "pending" until faculty approve it.

## 5 · Every project gets one standard record (40 s)

This is the record. Identity: title, people, cohort, type of work. Research: method, tools, datasets, domain and scale, from fixed lists so they can be compared. Evidence: every automatic tag keeps the sentence that supports it, so nothing is a black box. And consent: permission to publish, whether names are shown, and a review status.

## 6 · Projects with similar text sit close together (50 s)

How does the map decide where a project goes? Each project text becomes a fingerprint of numbers, 64 of them. Similar fingerprints sit close together. Select "Cooling street trees" and "Urban heat predictors": almost the same profile, so they are neighbours. "Robotic timber joinery" has a very different profile and lands far away. No one sorts the projects by hand.

---

## 7 · From a scatter of dots to a cosmic web (1 min 30 s)

Before I show the map, here is how we got to it, in five steps.

**1.** Our first map was a plain scatter of dots. It was correct, but it was hard to read. You could not see the connections or the empty areas.

**2.** Astronomers have the same problem with galaxies. Galaxies are not spread evenly. They sit along long thin threads called filaments, with large empty voids between them. This is the cosmic web. In simulations the filaments hold about half of the mass in only 6 percent of the volume, and the voids fill more than three quarters of space.

**3.** In 2010, a team in Japan put a slime mould on a map of the Tokyo region, with oat flakes at the 36 city positions. In about a day it grew a network that was very close to the real rail network in cost and efficiency.

**4.** In 2020, astronomers used a computer model of that slime mould to trace the cosmic web between about 37,000 real galaxies, and then confirmed the threads with Hubble data.

**5.** So we did the same with our projects. Projects are the galaxies, the slime-mould model draws the paths between them, and the voids show where nobody has worked yet.

---

## 8 · The cosmic web of MaAI research (1 min)

This is the live Atlas, not a picture. The dust drifts slowly along the filaments, like matter in the real cosmic web. The map has four parts. I will show them one at a time.
*(Select each tab. The selected part stays bright and the rest of the map goes dark. Select the same tab again to show the full map.)*
**1 · Galaxy:** each cluster of stars is one project. Warm colours are older cohorts, blue is newer. Better code makes a bigger galaxy.
**2 · Filament:** the paths come from the slime-mould simulation. Bright knots are where many projects meet; faint blue threads are weak links.
**3 · Bridge:** a chain of projects that connects two branches. We test each one 40 times by hiding random projects. 100 percent means it always survives.
**4 · Void:** the yellow ring is empty space. We check it in the full 64-number space, so it is not an effect of the flat map.

---

## 9 · Like the Sagrada Família, research is built by many generations (1 min 15 s)

The second idea is the 3D view. Why the Sagrada Família?
The first stone was laid in 1882. Gaudí took over a year later and worked on it until he died in 1926. Then other architects continued, and when his workshop and models were broken in 1936, they rebuilt the models from the fragments. This year, 2026, the Tower of Jesus Christ was completed at 172.5 metres, a hundred years after Gaudí died. The Glory façade is still not built. The current forecast is around 2035.
That is how a research programme works. Each project is a stone. Each cohort is a generation of builders, so the oldest cohort forms the base and the newest forms the spires. A research gap is unbuilt scaffolding. And the frontier between fields is the Glory façade: designed, but not built yet.

## 10 · The same points build the basilica (40 s)

This is the live Atlas again. Press "3D basilica". Every point you saw on the flat map lifts off and flies into its place in the building. The oldest cohort goes first, at the bottom. Nothing is a separate image: it is the same data in two forms. *(Press "2D map" to go back. If the deck is opened as a file, a recorded video plays instead.)*

---

## 11 · Four checks find open thesis topics, with evidence (45 s)

The atlas finds 17 candidate gaps with four checks.
Empty space between two busy branches. Untried pairs: a common method and a common topic that nobody has combined. External trends: active research outside IAAC that we do not cover. And fading fields: topics that dropped in the newest cohort.
The second check is easier to see as a grid, so here it is.

## 12 · Some common methods never met common topics (1 min)

Each row is an AI method. Each column is a research topic, grouped by branch. A darker cell means more projects use that method on that topic.
*(The pair "Generative models × Urban Climate & Heat" is already selected.)* Generative models are used in 49 projects. Urban heat is studied in 27. But nobody has combined them: zero projects. If methods and topics were paired at random, we would expect about five. That is a thesis topic with evidence behind it.
The dashed cells are the eight untried pairs. *(Point at one or two dashed cells, for example "Language models × Building Energy".)* A dark empty cell is different: it is quiet, because neither side is common enough for the gap to matter.

## 13 · Reproducible code earns a larger stone (30 s)

For every repository, we check six habits: a README, dependencies, pinned versions, sample data, a licence and a run script. Each habit adds 8 percent to the size of the stone. *(Toggle a check.)* It is a small reward that makes reusable work visible.

## 14 · Search in plain words, not keywords (30 s)

Try a query. "Robots that adapt to material" finds the robotic fabrication projects, even when they use other words. *(Select the other two queries.)* The search runs in the browser, with no server.

## 15 · Shared papers connect the branches (1 min)

This is the citation network. Each coloured dot is a project, in its place on the map. Each white square is a paper that students cite. A paper sits in the middle of the projects that cite it.
First, the cleaning. Students write the same reference in many formats. We merged 1,467 raw references into 50 clean sources.
*(Adam is selected.)* The most cited paper is "Adam", an optimisation method. 57 projects in 6 of the 7 branches cite it, so it sits in the centre. *(Select "Local Climate Zones".)* This paper is different: 33 of its 39 citations come from Climate & Energy, so it sits next to that branch.
So the network shows two things: the shared foundations of the whole programme, and the reading that belongs to each field.

## 16 · The same pipeline is ready for every IAAC programme (40 s)

MaAI is the pilot, with 77 posts today. The same connector reads every programme on the blog: MAA alone has almost 1,800 posts.
Three steps to go live: approve which posts, PDFs and names can be public; connect the thesis PDFs and the paper links; and lock the map, so new cohorts add stones without moving the old ones.
Thank you. I am happy to take questions.

---

## Answers for questions

### How do we gather the data?

There are three ways in.
1. **Public sources, read automatically.** The blog connector reads the MaAI posts from the WordPress data feed of blog.iaac.net. For every GitHub link in a post, we read the repository through the GitHub API.
2. **The students themselves,** through the "Add my work" form.
3. **Thesis PDFs, next phase.** GROBID reads the PDF, and OpenAlex links the references to real papers.

After that, the same steps run for every project: clean the text, tag methods, tools and datasets with the sentence as evidence, merge the references, score the repository, make the 64-number fingerprint, place the project on the map, and look for gaps. Faculty then check the record before it is public.

### How do we connect the IAAC blog?

There are two levels. The first already works. The second needs the IAAC web team.

**Level 1, read only (built).** WordPress publishes every public post as data at `blog.iaac.net/wp-json`. Our connector asks only for the MaAI course categories. It sends one request per second and uses no login, so it reads only what is already public. We run it once a week, and it asks only for posts that are new or changed since the last run. One technical detail: the image links in the feed must be changed to the blog's media server, `blog-media.iaac.net`, or the images do not load.

**Level 2, connected at the source (needs IAAC).** A small addition to the blog editor:
- When a student publishes a MaAI post, the blog sends a short signal to the Atlas, so the project appears the same day.
- The post editor gets a few extra fields: GitHub link, dataset, PDF, and methods. So the student fills them once, and the blog and the Atlas both use them.
- Every blog post gets an "Open in the Atlas" link, and every Atlas record links back to the post. So the two systems point to each other.

Before any real data is public, IAAC must agree which posts and names can be shown.

### How do we collect information from students?

With one short form, at the moment the student already submits the work.
- **When:** at the final submission of each term. MaAI already collects final work with a Google Form, so our questions go into that same form. Students fill one form, not two.
- **What:** title, abstract, cohort, type of work, methods, dataset, repository link, six yes or no checks on the code, and two consent questions: "Can this project be public?" and "Can we show your name?"
- **Less typing:** the Atlas fills in what it can find already, from the blog post and the repository. The student only checks and corrects it. That takes about five minutes.
- **Instant feedback:** the form reads the abstract and shows where the project will sit on the map, and its nearest neighbours. The student can confirm or move it.
- **Review:** each entry goes to a faculty queue with the status "pending". Nothing is public until a person approves it and the student has given consent.

Today the form saves the entry in the browser and can export it as a file. A shared database for the whole class is the next step.
