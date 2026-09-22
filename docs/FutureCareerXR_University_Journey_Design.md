# FutureCareerXR — The University Journey
### Product & UX design for the Electrical Engineering degree experience

**Status:** design specification. No application code — this is the document to build from and to show a university.
**Scope of this release:** Electrical Engineering (King Faisal University curriculum), as the first dataset of a white-label platform.
**Constraint honored throughout:** runs on Meta Quest 2 — no new heavy 3D models, no Blender assets. Everything below is built from existing panels, framed images, simple Three.js geometry, icons, and copyright-safe photos.

---

## 1. Locked design decisions

| # | Decision | Consequence for the build |
|---|---|---|
| 1A | Users are **enrolled freshmen** in orientation/advising | Sessions are personal, ~15 min, unhurried. Depth is welcome; throughput is not the concern. |
| 2B | The sale is **retention** ("fewer dropouts & major-switches") | The product's job is to make a freshman *understand and commit to* the degree before it gets hard. |
| 3B | Graduation needs a **required spine + optional depth** | ~18 spine courses gate graduation (~15 min). The other ~37 are tappable depth, tracked but not required. |
| 4C | **Accounts + analytics** | The VR journey is the data surface; the **department dashboard is the product**. This is what a university actually pays for. |
| 5A | Reward = the **renewable-energy / power room** | Zero new assets. The EE spine *is* power/energy. Other two rooms visible-but-locked (upsell hook). |
| 6B | **Bilingual** (AR ⇄ EN), English course codes | All student-facing microcopy is authored in both languages. Course codes/titles stay English ("EE330 Signals & Systems"). |
| 7B | **White-label**, KFU EE is dataset #1 | The entire curriculum lives in JSON. New university/major = new file, no code change. |
| 8A | Explanations **freely paraphrased**, youth-friendly | We optimize for excitement and clarity, not accreditation-verbatim text. |
| 9B | **One MCQ per spine course**, framed as "unlock next" | Each answer emits a correct/incorrect/hesitation signal — the raw material of the retention analytics. |

---

## 2. Product thesis — why a university pays

Engineering programs lose the most students in the **first three semesters**, and the reason is rarely capability — it's *meaning collapse*. A freshman grinds through Calculus, Physics, and Circuits with no felt sense of where any of it leads, decides "this isn't for me," and switches major or drops out. Every lost student is lost tuition and a hit to the program's completion rate — a number universities are measured on.

**FutureCareerXR's University Journey attacks exactly that gap.** In ~15 minutes a freshman *lives* the whole degree as a connected path: they see that EE241 (Circuits) is what makes EE335 (Power Systems) possible, which is what makes them the engineer who electrifies a NEOM-scale project. When they later sit in a hard Circuits lecture, the meaning is already installed. That is a retention intervention, and retention has a dollar value the department can put on a purchase order.

**But the deeper product is the data.** Because every spine course ends in a one-tap question (9B) and every optional course logs a tap, the system produces a **curriculum heat-map**: which courses confuse incoming students, where they hesitate, which majors they drift toward. The department has never had this signal before advising even begins. The dashboard that surfaces it — "37% of your incoming cohort couldn't connect Signals & Systems to any future course" — is the thing a dean signs off on. The headset is the sensor; the dashboard is the SaaS.

**The three-sentence pitch:**
> FutureCareerXR turns your first-year orientation into a 15-minute VR journey through the entire degree, so students arrive understanding *why* they're studying what they study — which measurably reduces first-year attrition. Every student interaction feeds a dashboard that shows your department exactly where incoming students lose the thread. And because the whole curriculum is data, it works for any major you offer — Electrical Engineering is just the first.

---

## 3. The curriculum as a tech-tree (the design backbone)

The last page of the KFU brochure is, functionally, a **skill tree** — every course is a node, every prerequisite an edge. This is the single most important asset in the whole curriculum, because a tech-tree is intrinsically motivating: humans want to unlock the next node. The entire journey is built on rendering this tree and letting the student climb it.

Reading the prerequisite chains from the brochure, the EE degree has four strata:

- **Foundation (the language):** Calculus → Physics → Chemistry → Engineering intro. Nothing electrical yet; these are the tools.
- **Core EE (the trunk):** Circuits I → Circuits II → Electronics → Digital Logic → Signals → Electromagnetics. Every EE identity flows from here.
- **Systems (the branches):** Power, Communications, Control, Microprocessors — the trunk splits into the sub-disciplines a student will choose between.
- **Capstone (the canopy):** Senior Design I → II → 🎓 → career.

The design insight: **a student doesn't need to walk all 55 nodes to feel the tree.** They need to climb one clear path from root to canopy and *see the branches they're not taking* glowing off to the side (that's the optional depth, and the upsell: "Communications track — explore" / "more majors coming"). This is exactly the spine + depth model (3B).

### The prerequisite spine (the critical path)

Derived by selecting, at each level, the course that **unlocks the most downstream courses** — the load-bearing nodes:

```
MATH144 ─► MATH145 ─┬─► MATH240 ─┐
                    └─► MATH215 ─┼─► EE330 ─► EE332 (Comms branch)
PHYS140 ─► PHYS141 ─► EE241 ─► EE242 ─┤        └─► EE430 (Control branch)
                            EE241 ─► EE243 ─► EE244
                            EE231 (Digital) ─► EE233 (Micro)
                    EE242 ─► EE331 ─► EE335 ─► [POWER / renewable-energy reward]
EE330 + EE331 + EE335 ... ─► EE495 ─► EE496 ─► 🎓
```

### The 18-course spine (required to graduate in the journey)

| Stratum | Courses | Journey minutes @ ~30s |
|---|---|---|
| Foundation | MATH144, MATH145, PHYS140, PHYS141 | 2:00 |
| Core EE | EE241, EE242, EE243, EE231, EE330, EE331 | 3:00 |
| Systems | EE335, EE332, EE233, EE430 | 2:00 |
| Capstone | EE495, EE496 | 1:00 |
| **+ generated moments** | year transitions, branch reveals, graduation | ~4:00 |
| **Total** | **18 courses** | **~12–15 min** |

Everything **not** on this list (Chemistry, English, the math/physics labs, Probability, Numerical Methods, Mechanics, Economics, Materials, Thermo-Fluids, the Islamic-studies electives, and all 12 technical electives) is a **tappable optional node** — visible on the tree, one MCQ-free tap to read its card, logged for analytics, never blocking graduation.

---

## 4. The VR presentation toolkit (zero heavy assets)

Every course experience is assembled from **eight reusable patterns** below. This is what keeps us on Quest 2: there is no per-course modeling — a course is *data* that selects a pattern and fills it in. Author once, reuse 55×.

| # | Pattern | Built from (all existing/cheap) | Best for |
|---|---|---|---|
| P1 | **Concept Card** | existing panel + icon + one-line "why" | every course — the base layer |
| P2 | **Signal-on-a-wire** | a line + a moving dot (pure geometry) | Circuits, Signals, Comms, Control |
| P3 | **Node-graph reveal** | glowing spheres + lines lighting up | "this course unlocks →", the tech-tree itself |
| P4 | **Before / After** | two framed images, a wipe slider | Electronics (noisy→clean), Signal Processing |
| P5 | **Icon-burst skills** | 3 icon sprites popping in | the "skills you gain" beat of every course |
| P6 | **Real-world photo** | existing wall-image system + copyright-safe image | grounding every course in a real job/site |
| P7 | **Live plot** | line geometry drawn from a formula | Fourier, control response, probability curves |
| P8 | **Progress structure** | one box per completed course, stacking into a bridge/tower toward the graduation arch | the spine's sense of climb & reward |

**The standard 30–90s course beat** (same rhythm every time, so it's learnable and fast to author):

1. **0–5s — Arrive** (P1): course code + youth-friendly one-liner. *"EE330 Signals & Systems — teaching machines to hear."*
2. **5–20s — See it** (P2/P4/P6/P7): one vivid visual of the core idea. No lecture — one "aha."
3. **20–30s — Gain it** (P5): three skill icons burst in. *"You'll be able to: filter noise · compress audio · read an ECG."*
4. **30–40s — Connect it** (P3): the node lights up, edges shoot to the courses it unlocks. *"This is what makes Communications and Control possible."*
5. **40–55s — Unlock gate** (9B MCQ): one question, framed as the key to the next node. Correct → the edge completes and the next course lights up. *(This is the analytics event.)*
6. **optional — Go deeper**: a "learn more" tap reveals P6 real-world photo + the paraphrased full description. Logged, never required.

Optional (non-spine) courses use the **same beat minus step 5** — tap to read, no gate, but the tap is logged.

---

## 5. Course-by-course analysis

Depth is allocated by product value (the PM discipline you asked for): **full 7-field treatment for the 18 spine courses** (they carry the MCQs and drive the journey), **compact treatment for non-spine required courses**, and **grouped-by-track treatment for the 12 technical electives** (they function as career branches, not individual gates). Every course still gets a card and a tap event.

Legend for each spine course: **Why it exists · What you learn · Skills gained · Why it matters later · Unlocks · High-schooler pitch · VR pattern.**

### 5.1 Foundation stratum

---

**MATH144 — Calculus I** · 4 CH · *(spine)*
- **Why it exists:** Engineering is the study of how things *change* — voltage over time, heat through a wall, a signal rising and falling. Calculus is the mathematics of change. Nothing else in the degree works without it.
- **What you learn:** limits, derivatives, integrals of a single variable; rates, areas, optimization.
- **Skills gained:** modeling a changing quantity; finding maxima/minima (the core of all engineering design); reading a curve.
- **Why it matters later:** it's the literal prerequisite for *every* physics, circuits, and signals course. It is the root of the tree.
- **Unlocks:** MATH145, PHYS140, and through them essentially everything.
- **High-schooler pitch:** *"The math that lets you predict the future of anything that moves or changes — a rocket's path, a battery draining, a stock price."*
- **VR pattern:** P7 live plot — a curve draws itself; a tangent line rides along it showing "the slope = the rate right now." One tap changes the curve, the slope follows. Instant intuition, zero assets.

**MATH145 — Calculus II** · 4 CH · *(spine)*
- **Why it exists:** Calculus I handled one instant of change; Calculus II adds up *infinitely many* changes (integration, series) — how you get total energy from power, total charge from current.
- **What you learn:** integration techniques, infinite series, Taylor/power series, vectors.
- **Skills gained:** accumulation (area/energy/charge), approximating hard functions with simple ones (the trick behind every calculator and DSP chip).
- **Why it matters later:** Taylor series underpin numerical methods and signal processing; vectors open the door to fields and electromagnetics.
- **Unlocks:** MATH215, MATH240, MATH244, CS204.
- **High-schooler pitch:** *"How engineers add up a million tiny pieces to get one exact answer — and how your calculator secretly fakes sine and cosine."*
- **VR pattern:** P7 — a jagged real curve, then a Taylor approximation snapping closer with each added term (tap to add a term). The "it's getting closer!" moment sells the idea.

**PHYS140 — General Physics I (Mechanics)** · 3 CH · *(spine)*
- **Why it exists:** before you move electrons, you learn to describe motion, force, and energy — the grammar of the physical world.
- **What you learn:** kinematics, Newton's laws, work/energy, momentum, rotation.
- **Skills gained:** force/energy reasoning, free-body thinking, translating a real situation into equations.
- **Why it matters later:** energy conservation reappears in circuits and power; mechanics is the base for Engineering Mechanics, Mechatronics, and machines.
- **Unlocks:** PHYS141, ENGR223, ENGR303.
- **High-schooler pitch:** *"The physics of everything that pushes, spins, or flies — and the reason engineers can promise a bridge won't fall."*
- **VR pattern:** P2 on a projectile arc — a dot traces a trajectory; vectors for velocity/force ride along. Reuses existing geometry.

**PHYS141 — General Physics II (Electricity & Magnetism)** · 3 CH · *(spine)*
- **Why it exists:** this is the course where the degree becomes *electrical*. Charge, field, current, magnetism — the raw phenomena every EE course manipulates.
- **What you learn:** electric charge/field/potential, Kirchhoff & Gauss laws, capacitance, magnetic force, induction, Faraday's law.
- **Skills gained:** field thinking, applying Kirchhoff's laws (the foundation of all circuit analysis), understanding how motors and generators *actually* work.
- **Why it matters later:** it is the direct prerequisite to Circuits I — the gateway to the entire EE trunk.
- **Unlocks:** EE241, ENGR223.
- **High-schooler pitch:** *"Where you finally learn what electricity really is — and why a moving magnet can light a city."*
- **VR pattern:** P2 — field lines (cheap line geometry) between two charges; drag a charge, lines re-flow. A magnet passes a coil and a bulb lights. The "invisible made visible" beat.

### 5.2 Core EE stratum (the trunk)

---

**EE241 — Electric Circuits I** · 3 CH · *(spine)* — **the identity moment**
- **Why it exists:** the first course that is unmistakably electrical engineering. Everything before was preparation; here you analyze and design real circuits.
- **What you learn:** charge/current/voltage/power, passive elements, mesh & nodal analysis, Thévenin/Norton theorems, transient response.
- **Skills gained:** solving any resistive network, reducing a messy circuit to a simple equivalent, predicting how a circuit responds the instant a switch flips.
- **Why it matters later:** it is *the* trunk node — Circuits II, Electronics, Power, and the labs all grow from it. If a student is going to feel "I am becoming an engineer," it happens here.
- **Unlocks:** EE242, EE243, EE247 (and downstream, nearly all EE).
- **High-schooler pitch:** *"The first time you'll design something real — the circuit inside a charger, a speaker, a heartbeat monitor."*
- **VR pattern:** P2 signal-on-a-wire around a simple loop — current dots flow, a bulb brightens as you (tap to) change a resistor. Reuses existing panel + geometry; no modeling.

**EE242 — Electric Circuits II** · 3 CH · *(spine)*
- **Why it exists:** real electricity is AC (alternating), not the steady DC of Circuits I. This course handles the electricity that actually comes out of the wall.
- **What you learn:** AC sinusoidal analysis, power calculations, three-phase circuits, Laplace transforms, filters, Bode plots.
- **Skills gained:** analyzing the AC grid, designing filters (what lets your headphones separate bass from treble), using Laplace to tame hard circuits.
- **Why it matters later:** three-phase + power calc feed directly into Power Systems; Laplace + filters feed Signals and Control.
- **Unlocks:** EE330, EE331, EE335, EE244.
- **High-schooler pitch:** *"How the electricity in your walls really behaves — and how engineers bend it to power a whole building safely."*
- **VR pattern:** P7 live plot — a sine wave; a filter knob (tap) reshapes it; a three-phase trio of waves spins. Pure line geometry.

**EE243 — Electronics I** · 3 CH · *(spine)*
- **Why it exists:** circuits made of just resistors are passive. *Electronics* introduces the components that amplify, switch, and decide — diodes and transistors, the atoms of every chip.
- **What you learn:** diodes, rectifiers, MOSFETs, BJTs — models, biasing, small-signal analysis.
- **Skills gained:** designing an amplifier, building the switch that is the basis of all digital logic, turning AC into usable DC.
- **Why it matters later:** the transistor is the bridge from analog to digital; this course underpins Electronics II, Communications electronics, and conceptually Digital Logic.
- **Unlocks:** EE244, EE248.
- **High-schooler pitch:** *"Meet the transistor — the tiny switch there are more of on Earth than there are stars in the galaxy, and you'll learn to design with it."*
- **VR pattern:** P4 before/after — a weak input signal on the left, a big amplified copy on the right, an amplifier block between. One slider grows the output.

**EE231 — Digital Logic Design** · 3 CH · *(spine)*
- **Why it exists:** everything digital — every computer, phone, and chip — is built from simple logic gates. This is where a student learns the language computers are physically made of.
- **What you learn:** Boolean algebra, combinational and sequential circuits, counters, registers.
- **Skills gained:** designing logic from a truth table, building memory and counters, thinking in 1s and 0s at the hardware level.
- **Why it matters later:** it is the direct prerequisite to Microprocessors and the whole digital branch.
- **Unlocks:** EE233 (Microprocessors), EE434.
- **High-schooler pitch:** *"Build a brain from switches — the exact logic gates inside every computer chip ever made."*
- **VR pattern:** P3 node-graph — gates as glowing nodes; tap inputs 0/1 and watch the output light propagate through an AND/OR/NOT chain. Pure geometry, deeply satisfying.

**EE330 — Signals & Systems** · 3 CH · *(spine)* — **the "wow" course**
- **Why it exists:** the deepest idea in EE — that *any* signal (sound, image, radio, ECG) can be broken into simple waves, analyzed, and reshaped. The intellectual heart of the degree.
- **What you learn:** signal representation, linear systems, Fourier series/transforms, Laplace, filtering.
- **Skills gained:** decomposing any signal into frequencies, filtering noise, the math behind audio, images, and wireless.
- **Why it matters later:** it is the shared parent of *both* major branches — Communications (EE332) and Control (EE430). The tree splits here.
- **Unlocks:** EE332, EE430, EE434.
- **High-schooler pitch:** *"The secret that noise-cancelling headphones, Shazam, and MRI machines all share — turning any sound or signal into math you can edit."*
- **VR pattern:** P7 — a messy waveform decomposes into three clean sine waves that fan out and recombine (tap to remove the "noise" one). The single most impressive 15 seconds in the journey.

**EE331 — Engineering Electromagnetics** · 3 CH · *(spine)*
- **Why it exists:** the physics behind wireless, antennas, motors, and power transmission — how energy travels through fields and empty space.
- **What you learn:** vector calculus, static and dynamic fields, Maxwell's equations, electromagnetic waves.
- **Skills gained:** field analysis, understanding how antennas radiate and how power lines carry energy, wave thinking.
- **Why it matters later:** it feeds Power Systems (transmission) and, conceptually, all wireless communication.
- **Unlocks:** EE335, EE493.
- **High-schooler pitch:** *"How your phone talks to a tower with nothing in between — the four equations that describe all of light, radio, and Wi-Fi."*
- **VR pattern:** P2/P7 — a wave (line geometry) radiating outward from an antenna point; field lines ripple. Cheap and striking.

### 5.3 Systems stratum (the branches)

---

**EE335 — Electric Energy & Power Systems** · 3 CH · *(spine)* — **the reward's anchor**
- **Why it exists:** the course that makes you the engineer who powers cities — generation, transformers, motors, transmission, and (per the syllabus) renewable energy.
- **What you learn:** three-phase power, transformers, synchronous & induction machines, transmission lines, power-flow, a renewable-energy case study.
- **Skills gained:** analyzing a power grid, designing with transformers and motors, thinking about renewable integration — *exactly the skills the reward room dramatizes.*
- **Why it matters later:** it is the gateway to the entire power track (Machines, Power Systems, Power Electronics) and thematically **the bridge into the renewable-energy career room** (5A).
- **Unlocks:** EE480, EE481, EE482, EE336, EE495.
- **High-schooler pitch:** *"Become the engineer who keeps the lights on for a whole country — and who builds the solar and wind grid of the future."*
- **VR pattern:** P6 real-world photo (existing wall-image system: a substation / a solar farm — the same imagery already in the renewable room) + P3 mini-grid node-graph lighting up from source to city. This is the visual handshake into the reward.

**EE332 — Communication Systems Fundamentals** · 3 CH · *(spine)*
- **Why it exists:** how information travels — the principles behind radio, mobile networks, and the internet.
- **What you learn:** modulation (AM/FM/digital), spectral analysis, noise, multiplexing.
- **Skills gained:** encoding information onto a wave, fighting noise, understanding how millions share the airwaves.
- **Why it matters later:** the head of the Communications branch (Digital Comms, Wireless, Comms Electronics electives).
- **Unlocks:** EE486, EE487, EE488, EE333.
- **High-schooler pitch:** *"How your voice fits onto a radio wave and reaches someone across the planet a fraction of a second later."*
- **VR pattern:** P2 — a message rides a carrier wave from tower to phone; P7 shows the spectrum. Line geometry only.

**EE233 — Microprocessors** · 3 CH · *(spine)*
- **Why it exists:** where digital logic becomes a *computer you can program* — the brain inside every embedded device.
- **What you learn:** microcomputer architecture, instruction sets, memory/IO, the Intel 8086, assembly-level design.
- **Skills gained:** programming hardware directly, designing embedded systems, bridging software and circuits.
- **Why it matters later:** the core of the embedded/mechatronics branch; feeds Mechatronics and Digital Systems.
- **Unlocks:** EE429 (Mechatronics), EE434.
- **High-schooler pitch:** *"Program the tiny computer hidden inside a microwave, a drone, or a car — down to the raw instructions."*
- **VR pattern:** P3 node-graph — an instruction moves through fetch→decode→execute nodes lighting up; registers (small boxes) update. Pure geometry.

**EE430 — Analogue Control Systems** · 3 CH · *(spine)*
- **Why it exists:** how machines regulate themselves — the feedback that keeps a drone level, a cruise control steady, a thermostat on target.
- **What you learn:** transfer functions, time & frequency domain analysis, stability, feedback design.
- **Skills gained:** designing a system that corrects its own error, guaranteeing stability, tuning response.
- **Why it matters later:** head of the Control branch (Modern, Digital, Industrial control electives); pairs with Mechatronics.
- **Unlocks:** EE483, EE485, EE431.
- **High-schooler pitch:** *"The invisible skill behind self-balancing robots and self-driving cars — teaching a machine to fix its own mistakes in real time."*
- **VR pattern:** P7 live plot — a target line and a response curve that overshoots then settles; a "gain" tap changes how it settles (or wobbles). The feedback "aha."

### 5.4 Capstone stratum (the canopy)

---

**EE495 — Senior Design I** · 2 CH · *(spine)*
- **Why it exists:** the whole degree converges — students design a real electrical system from concept, in a team, like a professional.
- **What you learn:** design process, teamwork, project management, prototyping, technical communication.
- **Skills gained:** turning knowledge into a built thing; the professional skills employers actually screen for.
- **Why it matters later:** it is the dress rehearsal for the career that follows — and narratively, the last gate before graduation.
- **Unlocks:** EE496.
- **High-schooler pitch:** *"Everything you've learned, aimed at one real project you design and build — your proof you're an engineer."*
- **VR pattern:** P8 progress-structure — every completed course-block the student earned flies in and assembles into the project. Literally shows the degree adding up.

**EE496 — Senior Design II** · 2 CH · *(spine)* — **the graduation gate**
- **Why it exists:** the project is finished, tested, and defended. The student crosses from learner to engineer.
- **What you learn:** implementation, testing, defense, professional communication.
- **Skills gained:** shipping and standing behind real work.
- **Why it matters later:** completing it **triggers graduation → the renewable-energy career room unlocks** (5A).
- **Unlocks:** 🎓 → the career simulation.
- **High-schooler pitch:** *"Cross the stage. You're an electrical engineer now — go power the future."*
- **VR pattern:** P8 → graduation moment: the assembled project powers on, the tree fully lights, the graduation arch opens toward the (existing) renewable-energy room. Reuses existing room as the reveal — no new assets.

### 5.5 Non-spine required courses (compact treatment — tappable depth, tracked, not gated)

These are real and valuable, but they're not load-bearing nodes on the critical path, so in the journey they're optional cards (tap to read, logged for analytics, no MCQ gate).

- **CHEM140 / CHEM142 — General Chemistry I & II** — *Why:* materials, batteries, and semiconductors are chemistry underneath. *Pitch:* "why a battery holds energy and a chip is made of sand." *VR:* P6 photo (battery/wafer) + P1 card.
- **PHYS144 / PHYS145 / EE247 / EE248 / EE232 / EE234 / EE336 / EE333 / EE431 — Labs** — *Why:* where theory becomes hands-on measurement. *Pitch:* "the room where you finally touch it — oscilloscopes, breadboards, sparks." *VR:* P6 photo of the actual KFU lab (from the brochure's lab list) — grounds the student in a real place they'll stand in. Strong retention beat; cheap.
- **MATH240 — Differential Equations** — *Why:* the equations that describe how circuits and systems evolve over time. *Unlocks:* EE330. *VR:* P7 decaying/oscillating curve.
- **MATH244 — Multivariate Calculus** — *Why:* calculus in 3D — the math of fields. *Unlocks:* EE331. *VR:* P7 surface hint.
- **MATH215 — Math for EE** — *Why:* complex numbers & linear algebra, the daily language of AC and signals. *Unlocks:* EE330, ENGR340. *VR:* P2 rotating phasor (a spinning vector — pure geometry, and genuinely beautiful).
- **CS204 — Engineering Programming** — *Why:* engineers automate and simulate; code is a core tool. *Unlocks:* EE233, ENGR310. *VR:* P3 code-block flow.
- **ENGR105 — Engineering Computing (MATLAB)** — *Why:* the tool used in half the later courses. *VR:* P7 plot "drawn by code."
- **ENGR340 — Probability & Random Processes** — *Why:* real signals and noise are random; this is how you handle uncertainty. *Unlocks:* EE332. *VR:* P7 bell curve filling in.
- **ENGR310 — Numerical Methods** — *Why:* when equations are too hard, computers approximate — how simulation really works. *VR:* P7 converging estimate.
- **ENGR223 — Engineering Mechanics** / **ENGR303 — Thermo-Fluids** / **ENGR205 — Materials Science** — the cross-disciplinary breadth (mechanical/thermal/materials) that makes a well-rounded engineer; *VR:* P6 photos.
- **ENGR100 — Introduction to Engineering** — *Why:* the "what is engineering" on-ramp; natural **first card of the whole journey**. *VR:* P1 + the tech-tree preview (P3) — literally show the map they're about to climb.
- **ENGR106 — Engineering Graphics (CAD)** — *Why:* engineers communicate in drawings. *VR:* P6 CAD image.
- **ENGR307 — Engineering Economics** / **MGT292 — Management** — *Why:* engineers cost, budget, and lead. *Pitch:* "the skills that turn an engineer into a project leader." *VR:* P5 icon set.
- **ENGR399 — Engineering Training (internship)** — *Why:* the real-world summer between theory and career. *Pitch:* "8 weeks inside a real company — your first taste of the job." *VR:* P6 photo; sits naturally just before the capstone as a narrative bridge toward the reward.
- **ENG133/134/137/138 — English & Communication** — *Why:* an engineer who can't explain or present is invisible. *Pitch:* "the skill that gets your ideas built." *VR:* P5 icons.
- **SSC/DEIC — University (Islamic studies) electives** — *Why:* the university's general-education requirement; represented honestly as part of the real plan. *VR:* P1 card only. (White-label note: these are institution-specific gen-ed; in the JSON they're flagged `category: "general_education"` so other universities swap their own.)

### 5.6 Technical electives — grouped by career track (the branches the student chooses)

The 12 technical electives aren't 12 gates; they're **three career branches** glowing off the trunk. Presenting them by track is both better pedagogy and the commercial upsell ("choose your specialization"). Each track is one P3 node-cluster the student can explore after the spine, and each maps to a future career room.

- **⚡ Power track → renewable-energy career room (the EE default reward, 5A).**
  EE480 Electric Machines · EE481 Power Systems · EE482 Power Electronics.
  *Pitch:* "Design the motors, grids, and converters that electrify the world — and the renewable future." *VR:* P3 cluster + P6 solar/grid photo (reuses reward-room imagery).
- **🎛️ Control & Automation track → (maps toward robotics/industry).**
  EE483 Modern Control · EE485 Digital Control · EE484 Industrial Controls.
  *Pitch:* "Make machines and factories run themselves." *VR:* P7 response curves + P3 cluster.
- **📡 Communications track → (maps toward telecom/AI-adjacent).**
  EE486 Digital Comms · EE487 Comms Electronics · EE488 Wireless & Cellular · EE493 Optical Fiber.
  *Pitch:* "Build the 5G, satellite, and fiber networks the whole world runs on." *VR:* P2 wave + P3 cluster.
- **🔬 Open exploration:** EE489 Special Topics · EE490 Undergraduate Research — *"go beyond the syllabus — invent something."*

The two non-power branches are shown **glowing but marked "explore / more career rooms coming"** — honest about today's scope (only renewable-energy room exists) while advertising the roadmap. That's the upsell hook baked into the pedagogy.

---

## 6. The MCQ bank (one per spine course — the analytics events)

Design rules: **one question per spine course**, always testing *connection or purpose* (not trivia — that's what makes the degree feel coherent and what produces useful analytics), 4 options, framed as "unlock the next course." Bilingual (6B). Each records `{course, chosen, correct, latency_ms, hesitations}` → the dashboard.

Below, each entry is **stem (EN / AR) · options · answer · one-line why**. These drop straight into the JSON `question` field.

1. **MATH144 Calculus I** — EN: *"Calculus is the math of ___ — the reason it underlies every later course."* AR: «التفاضل والتكامل هو رياضيات ___ ولهذا يقوم عليه كل ما بعده.» — (a) change ✓ (b) shapes (c) money (d) history — *why:* engineering models how things change over time.
2. **MATH145 Calculus II** — EN: *"Which idea from Calc II lets a chip fake sine & cosine?"* — (a) Taylor series ✓ (b) fractions (c) matrices (d) logarithms — *why:* series approximate hard functions with simple sums.
3. **PHYS140 Physics I** — EN: *"Physics I gives you the language of ___, reused later in energy and machines."* — (a) motion & energy ✓ (b) colors (c) prices (d) grammar.
4. **PHYS141 Physics II** — EN: *"Which course does Physics II directly unlock — the first truly 'electrical' one?"* — (a) EE241 Circuits I ✓ (b) English II (c) Chemistry (d) Graphics — *why:* charge & Kirchhoff's laws are the gateway to circuits.
5. **EE241 Circuits I** — EN: *"Circuits I is the foundation of which later course?"* — (a) EE242 Circuits II ✓ (b) Speech (c) Economics (d) Islamic Culture.
6. **EE242 Circuits II** — EN: *"Three-phase power from Circuits II is essential for which field?"* — (a) EE335 Power Systems ✓ (b) English (c) Graphics (d) Chemistry.
7. **EE243 Electronics I** — EN: *"The transistor you meet here is basically a tiny ___."* — (a) switch/amplifier ✓ (b) battery (c) magnet (d) motor.
8. **EE231 Digital Logic** — EN: *"Digital Logic is the prerequisite that makes which course possible?"* — (a) EE233 Microprocessors ✓ (b) Thermo-Fluids (c) Speech (d) Materials — *why:* logic gates build the computer you'll program.
9. **EE330 Signals & Systems** — EN: *"Signals & Systems is the shared parent of which TWO branches?"* — (a) Communications & Control ✓ (b) Chemistry & English (c) Sports & Music (d) Economics & Law — *why:* the tree splits into EE332 and EE430 here.
10. **EE331 Electromagnetics** — EN: *"Electromagnetics explains how your phone reaches a tower with ___ in between."* — (a) nothing/empty space ✓ (b) wires (c) water (d) rails.
11. **EE335 Power Systems** — EN: *"Which career does mastering Power Systems point you toward?"* — (a) renewable energy & the grid ✓ (b) accounting (c) translation (d) cooking — *why:* this is the handshake into the reward room.
12. **EE332 Communications** — EN: *"Communications is the head of which specialization track?"* — (a) wireless/telecom ✓ (b) power (c) materials (d) mechanics.
13. **EE233 Microprocessors** — EN: *"Microprocessors turns digital logic into a ___ you can program."* — (a) computer ✓ (b) motor (c) battery (d) antenna.
14. **EE430 Control Systems** — EN: *"Control is the skill behind which technology?"* — (a) self-balancing robots / self-driving cars ✓ (b) paint (c) glass (d) paper.
15. **EE495 Senior Design I** — EN: *"Senior Design exists to make you ___ before you graduate."* — (a) build a real system like a professional ✓ (b) memorize formulas (c) take more exams (d) start over.
16. **EE496 Senior Design II** — EN: *"Completing Senior Design II means you are now ___."* — (a) an electrical engineer ✓ (b) a freshman (c) undecided (d) on a break — *why:* this is the graduation trigger → career room.

*(Foundation courses 1–4 use gentle "purpose" questions to build confidence early; difficulty and connection-depth rise toward the capstone. This ramp is deliberate — early wins reduce the very drop-off the product targets.)*

---

## 7. The redesigned end-to-end journey

The existing app drops the student straight into a career room. We insert the University Journey **before** that room and make the room the reward. Nothing existing is rebuilt — the journey is a new "act" that hands off to the current experience.

### 7.1 Flow (new act shown in **bold**, existing untouched)

```
Existing entry / lobby
        │
        ▼
Career Compass  ──or──  Choose Major        ← existing compass, now also an entry to the journey
        │
        ▼
**Electrical Engineering** (only major live today; others shown "coming soon")
        │
        ▼
**Study-Plan Overview**  — the tech-tree, whole degree visible, spine highlighted
        │
        ▼
**Year → Semester → Course**  — climb the spine (18 gated) ; branches tappable (optional)
        │        each course = the 30–90s beat (§4), spine courses end in an MCQ gate
        ▼
**Graduation**  — capstone completes, tree fully lit, arch opens
        │
        ▼
Renewable-energy career room   ← EXISTING room, now the earned reward (5A)
        │
        ▼
Existing career content (guide سعود, exhibits, exhibits' own galleries…) — unchanged
```

### 7.2 Screen-by-screen (states are new; components reuse existing panels/geometry)

1. **Choose Major** — cards: *Electrical Engineering* (live), others greyed "قريباً / coming soon." One tap → journey. (White-label: cards are generated from available curriculum JSON files.)
2. **Study-Plan Overview (the map)** — the P3 tech-tree of the whole degree, camera framed on it. Spine glows gold; branches glow faint. A progress ring shows "0/18." This screen alone communicates "this is a real, finite, climbable path" — a retention message before a single course. *"Your 4-year journey. Let's begin."*
3. **Course experience** — the §4 beat. Spine course → ends in MCQ gate; correct answer completes the edge to the next node with a satisfying light-up and +1 on the ring. Optional course → same beat minus gate, tap "next."
4. **Year/Semester transitions** — a generated 3-second beat: "Year 1 complete — 4 courses, the foundation is set." Reuses P8 (blocks stacked so far). Gives rhythm and a sense of progress across the ~15 min.
5. **Branch reveal** (after EE330) — the tree visibly splits; *"Your path now branches: Power, Control, Communications. Your spine follows Power toward the energy of the future."* Sets up the reward and the upsell.
6. **Graduation** — P8 finale: earned blocks assemble into the capstone project, it powers on, the arch opens onto the existing renewable-energy room. Cap-and-gown microcopy, bilingual. *"You're an electrical engineer. Go power the future."*
7. **Hand-off** — the existing room loads exactly as it does today. From the student's view, the career simulation is now the *reward for finishing the degree* — which is the entire point of the new vision.

### 7.3 Session, save, resume (4C)

- Progress persists per student account: `{studentId, major, completedCourses[], answers[], optionalTaps[], graduated, timestamps}`.
- A student can leave and resume on any headset — the tree redraws with earned nodes lit.
- "Skip to my progress" for returning students; "restart" always available.
- **Account creation is out-of-headset** (a web/QR sign-in the advisor sets up), so no keyboard-in-VR friction — the headset only *reads* the student token. This keeps the VR flow clean and the data attributable.

---

## 8. The analytics layer — what the university actually buys (4C, 2B)

Every interaction is an event; the **department dashboard** turns them into retention intelligence. This is the SaaS, billed per-seat or per-cohort. Nothing here needs new VR assets — it's a web dashboard fed by the journey.

**Events captured** (all already produced by §4/§7):
`journey_start · course_view{course, dwell_ms} · mcq_answer{course, chosen, correct, latency_ms, hesitations} · optional_tap{course} · branch_explored{track} · year_complete · graduated · session_end{completion_%}`

**Dashboard views the buyer sees:**
1. **Curriculum heat-map** — every course colored by incoming-student confusion (wrong-answer rate + hesitation + dwell). *"Signals & Systems is your #1 confusion point before students even take it."* → advisors intervene early. **This is the headline feature.**
2. **Drop-off funnel** — where in the 15-minute journey students disengage. A cliff at a given course is an early attrition signal for the real degree.
3. **Interest map** — which branches students explore (Power vs Control vs Comms). Tells the department where incoming demand is, and which career rooms to build next (your roadmap, informed by data).
4. **Cohort completion & at-risk flags** — who didn't finish, who hesitated everywhere → an advising worklist before week 1.
5. **ROI panel** — completion-rate correlation over cohorts: the number that renews the contract.

**Why this closes the sale:** a dean doesn't buy VR; a dean buys a **lower first-year attrition rate** and the evidence to act on it. The journey produces the evidence as a byproduct of being engaging. That is the commercial moat — a competitor with a prettier VR demo but no data layer can't make the retention argument.

---

## 9. White-label data model (7B) — the whole curriculum is JSON

No course is hard-coded. A university/major is one file at `curriculum/<slug>.json`. Adding a new program is authoring data, not writing code — the platform play.

```jsonc
{
  "major": { "id": "kfu-ee", "name_en": "Electrical Engineering",
             "name_ar": "الهندسة الكهربائية",
             "institution": "King Faisal University",
             "reward_room": "renewable_energy",        // maps to an EXISTING room (5A)
             "branches": [ {"id":"power","reward_room":"renewable_energy","status":"live"},
                           {"id":"control","status":"coming_soon"},
                           {"id":"comms","status":"coming_soon"} ] },
  "courses": [
    {
      "code": "EE330", "title_en": "Signals & Systems",
      "credits": 3, "year": 3, "semester": 5,
      "spine": true, "branch": null, "category": "core",
      "prereqs": ["MATH215","MATH240","EE242"], "unlocks": ["EE332","EE430","EE434"],
      "pitch_en": "The secret noise-cancelling headphones, Shazam & MRI all share.",
      "pitch_ar": "السر الذي تشترك فيه سماعات عزل الضجيج وشازام والرنين المغناطيسي.",
      "skills": ["filter noise","compress audio","read an ECG"],
      "vr_pattern": "P7_live_plot",
      "asset": { "type":"generated" },               // or {"type":"image","query":"..."} for P6
      "question": {
        "stem_en": "Signals & Systems is the shared parent of which TWO branches?",
        "stem_ar": "مادة الإشارات والأنظمة هي الأصل المشترك لأي فرعين؟",
        "options_en": ["Communications & Control","Chemistry & English","Sports & Music","Economics & Law"],
        "options_ar": ["الاتصالات والتحكم","الكيمياء والإنجليزية","الرياضة والموسيقى","الاقتصاد والقانون"],
        "answer": 0,
        "why_en": "The degree's two big branches both grow from here."
      }
    }
    // …one object per course; optional courses set "spine": false and omit "question"
  ]
}
```

Design guarantees this buys you:
- **New major** = new JSON + (optionally) a reward-room mapping to an existing room. Zero engine changes.
- **New university** = fork the file, swap gen-ed (`category:"general_education"`), rebrand. Same engine.
- **Content authoring** (pitches, questions, images) is a spreadsheet-like task a non-programmer can do — critical for scaling to many programs.
- **VR patterns (P1–P8)** are a fixed library the JSON *selects*; no per-course engineering.

---

## 10. Build sequencing (evolve, don't rebuild)

Ordered so each step ships value and nothing existing breaks. Every step reuses current panels/geometry/wall-image systems; none adds a 3D model.

1. **Data layer first** — author `kfu-ee.json` (all §5 content + §6 questions). No VR yet; this is a spreadsheet. De-risks everything and is the white-label core.
2. **The map screen (P3 tech-tree)** — renders from JSON. Even alone, it's a compelling demo ("see your whole degree") and validates the data.
3. **The course beat (§4) + patterns P1–P8** — build the eight patterns once; wire the beat to consume JSON. Start with spine-only.
4. **The MCQ gate + event logging** — even logging to console first; the analytics contract is defined here.
5. **Progress/accounts + resume (4C)** — device token read; out-of-headset sign-in.
6. **Graduation → existing room hand-off (5A)** — the reward wiring; reuses the renewable room as-is.
7. **Analytics dashboard (§8)** — the web product; ship the heat-map first (the headline).
8. **Optional depth + branch reveals** — the non-spine cards and track clusters.
9. **Second major/university** — proves white-label; the sales asset.

**What we explicitly do NOT touch:** the VR movement/controllers/touch, the existing rooms and exhibits, سعود, the compass scoring, WebXR, navigation, the optimization work. The journey is an *act inserted before* the existing experience, sharing its components, handing off cleanly.

---

## 11. Open questions for you (before any code)

1. **Account/sign-in mechanism (4C):** is there a student system to tie into (university SSO / student IDs), or do we issue our own QR tokens at the advising session? This affects the data model's `studentId`.
2. **Dashboard hosting:** does the university want it as our SaaS (we host), or on-premise (they host)? Changes the analytics build, not the VR.
3. **Spine sign-off:** the 18-course spine in §3 — good as-is, or adjust (add/remove a course)?
4. **Elective-branch reward rooms:** confirm the two non-power branches stay "coming soon" for v1 (only renewable-energy room live), with Control/Comms rooms on the roadmap.
5. **Bilingual authoring:** do you have an Arabic reviewer for the student-facing microcopy, or should I draft both and flag the AR for your review?

Answer these and the next step is step 1: I author the complete `kfu-ee.json` from this document — still no engine code until you approve the data.
