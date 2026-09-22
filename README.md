# Future Career XR 🚀

> **العربية:** يتوفر هذا الدليل باللغة العربية في [README_AR.md](README_AR.md) — النسخة العربية هي المرجع الأساسي لأن واجهة التطبيق أصبحت بالكامل بالعربية.

A browser-based, XR-inspired virtual career exhibition built with **Three.js**
(frontend) and **Flask** (backend). Visitors walk through a futuristic
building, meet an AI Career Assistant ("ARIA"), and explore three career
rooms: **Renewable Energy Engineering**, **Artificial Intelligence**, and
**Surgical Robotics**.

The entire user interface is in **Modern Standard Arabic** with a fully
**Right-to-Left (RTL)** layout, using the Cairo/Tajawal Arabic fonts.

Built as a university demonstration project — no Unity/Unreal, no SQL
database, runs entirely in a web browser with a lightweight Python backend.

---

## 1. Requirements

- **Python 3.9+**
- A modern web browser (Chrome, Edge, or Firefox recommended for WebGL + Pointer Lock support)
- Internet connection on first run (Three.js and fonts are loaded from a CDN)
- (Optional) A **free Groq API key** (https://console.groq.com/keys — starts with `gsk_`) for live AI-powered recommendations/chat instead of the built-in offline mode

No Node.js, no npm install, no build step required.

---

## 2. Folder Structure

```
FutureCareerXR/
│
├── backend/
│   ├── app.py                 # Flask server + API endpoints + serves the frontend
│   ├── requirements.txt       # Python dependencies
│   ├── recommendation.py      # Rule-based + Groq recommendation engine (Arabic)
│   ├── careers.json           # All career room data in Arabic (objects, future perspectives)
│   ├── ai_client.py       # Groq REST client — key stays server-side
│   ├── prompts.py             # Groq prompt templates (Arabic persona)
│
├── frontend/
│   ├── index.html             # Page structure (Arabic, RTL), HUD, modals, ARIA UI
│   ├── style.css              # Glassmorphism styling with RTL logical properties
│   ├── script.js              # Three.js scene: building, movement, interactions
│   ├── career_ai.js           # ARIA quiz flow + backend communication (Arabic)
│   ├── assets.js              # Asset management system (GLB manifest + loaders)
│   ├── assets/
│   │   ├── models/
│   │   │   ├── renewable/     # GLB models for the Renewable Energy room
│   │   │   ├── ai/            # GLB models for the AI room
│   │   │   ├── surgical/      # GLB models for the Surgical Robotics room (drop-in)
│   │   │   └── saudi_arabia.glb  # Future Perspective kiosk icon (all rooms)
│   │   ├── images/
│   │   │   ├── renewable/     # Photos used in info cards + wall displays
│   │   │   ├── ai/
│   │   │   └── surgical/
│   │   ├── icons/
│   │   ├── videos/
│   │   └── audio/
│
├── README.md                  # This file (English)
├── README_AR.md               # Arabic documentation
└── run_project.bat            # One-click Windows launcher
```

---

## 3. Installation & Running

```bash
cd FutureCareerXR/backend
pip install -r requirements.txt
python app.py
```

Then open `http://localhost:5000` — or double-click **`run_project.bat`**
on Windows. Click **«ادخل إلى المبنى»** (Enter the Building) to begin.

> **Important:** the frontend must be served over HTTP (which `app.py`
> does automatically). Opening `index.html` directly from disk will block
> GLB model loading due to browser security rules.

---

## 4. Controls

| Input          | Action                          |
|----------------|----------------------------------|
| `W A S D`      | Move forward / left / back / right |
| Mouse          | Look around                     |
| Left Click     | Interact with the object you're looking at |
| `Esc`          | Release the mouse cursor (e.g. to use a modal) |

---

## 5. The Three Career Rooms

| Room | ID | Content |
|------|----|---------|
| هندسة الطاقة المتجددة (Renewable Energy) | `renewable_energy` | Real GLB models: solar panel, wind turbine, battery storage, transformer, control room + substation photo display |
| الذكاء الاصطناعي (Artificial Intelligence) | `artificial_intelligence` | Real GLB models: robot, server rack, autonomous vehicle, XR headset + neural network / workstation photo displays |
| الروبوتات الجراحية (Surgical Robotics) | `surgical_robotics` | Futuristic robotic operating room: surgical robot, operating table, surgical lights, medical monitors, endoscopic camera, robot control console, precision instruments |

The Surgical Robotics room **replaces** the former Medical Careers room.
Every exhibit is clickable and opens an Arabic info card with: name,
purpose, how it works, real-world applications, future developments, and
career opportunities. Each room also has a **Future Perspective kiosk**
topped by a rotating Saudi Arabia 3D map (`saudi_arabia.glb`) covering
trends including Saudi Vision 2030 opportunities.

---

## 6. The AI Career Assistant (ARIA / «سعود»)

- ARIA asks 5 Arabic multiple-choice questions about engineering,
  robotics, precision technology, and healthcare innovation
  (edit them in `frontend/career_ai.js`, `QUESTIONS` array).
- On completion, the frontend POSTs the answers to `/recommend`.
- **With a Groq API key** the backend asks Google Groq (see
  `recommendation.py` / `prompts.py`) — the model answers in Arabic and
  must pick one of: **هندسة الطاقة المتجددة**, **الذكاء الاصطناعي**,
  **الروبوتات الجراحية**.
- **Without a key** a transparent weighted scoring system
  (`SCORING_RULES`) produces the same three-way recommendation offline.
- `career_ai.js` also has its own local fallback in case the Flask
  server isn't reachable, so the experience degrades gracefully.

**Easiest way (recommended):** open `backend/.env`, put your key after `GROQ_API_KEY=` (it starts with `gsk_`), save, then run `run_project.bat`. No terminal environment variables needed. Never share the `.env` file.

To connect a key: `export GEMINI_API_KEY=your-key` (macOS/Linux) or
`set GEMINI_API_KEY=your-key` (Windows) before `python app.py`.
Optionally pick a model with `GEMINI_MODEL` (default `groq-2.5-flash`).
The key is only ever read on the server — it is never sent to the browser.

---

## 7. Asset Management System (`frontend/assets.js`)

All 3D models and images are declared in one manifest:

- **`MODEL_MANIFEST`** — maps each room object to its `.glb` file with
  `targetSize` (auto-scaling), `rotY` (orientation) and `yOffset`.
  Models load asynchronously via `GLTFLoader`; each is auto-scaled,
  floor-aligned, shadow-enabled, and replaces its placeholder on arrival.
  **If a model fails to load**: the placeholder stays visible, a warning
  is printed to the browser console, and the remaining assets continue
  loading.
- **`PERSPECTIVE_ICON_MODEL`** — `saudi_arabia.glb`, used as the rotating
  icon above every Future Perspective kiosk.
- **`OBJECT_IMAGES`** — real photos for object info cards.
- **`ROOM_POSTERS`** — wall posters / digital displays per room (aspect
  ratio preserved automatically).

To add a new model: drop the `.glb` into the right folder under
`frontend/assets/models/` and add one manifest line — no scene-code
changes needed.

---

## 8. API Endpoints (Backend)

### `GET /careers`
Full Arabic career database (3 rooms, all exhibits, future perspectives).

### `GET /careers/<career_id>`
Single room. Valid IDs: `renewable_energy`, `artificial_intelligence`,
`surgical_robotics`.

### `POST /recommend`
Body: `{ "answers": ["تحديات البرمجة", ...] }` → recommendation object
with `recommended_career`, `recommended_career_id`, `reasoning`,
`suggested_majors`, `useful_skills`, `scores`, `mode`.

### `POST /chat`
Body: `{ "message": "...", "history": [...] }` → `{ "reply", "mode" }`.
Offline mode includes Arabic keyword-based canned replies.

---

## 9. Troubleshooting

- **Black screen / nothing loads**: check the browser console (F12) —
  most likely the Three.js CDN is blocked by your network.
- **Models don't appear (placeholders remain)**: make sure you're
  running through `python app.py` (HTTP), not opening the HTML file
  directly; check console warnings from `[assets]`.
- **Mouse look doesn't work**: click directly on the 3D scene once —
  browsers require a user gesture to enable Pointer Lock.
- **ARIA always shows «الوضع المحلي»**: expected unless `GEMINI_API_KEY`
  is set. Offline mode is fully functional by design.
- **`ModuleNotFoundError: No module named 'flask'`**: run
  `pip install -r requirements.txt` inside `backend/`.

---

Built for a university XR/career-exhibition demonstration. Enjoy exploring! 🌐

## Running on a VR headset (Meta Quest and others)

WebXR requires a secure (HTTPS) connection. The project provides this
locally, with no external tunnel (ngrok) needed:

1. Run `run_vr.bat` instead of `run_project.bat` (enables HTTPS and
   generates a local certificate on first run).
2. Note the address it prints, e.g. `https://192.168.1.15:5000`
3. Open that address in the headset's browser (Meta Quest Browser).
4. A security warning appears because the certificate is self-signed —
   tap **Advanced** then **Proceed**. (Safe: traffic never leaves your network.)
5. Tap the "🥽 ادخل الواقع الافتراضي" button.

**Only requirement:** laptop and headset on the same Wi-Fi network.

Advantages over external tunnels: works with no internet, much faster
(models transfer over the local network), and the address stays the same.
