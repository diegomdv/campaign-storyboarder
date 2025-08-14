# Campaign Storyboarder

Map multi‑concept campaigns by market, enforce annual narrative cohesion, and export an executive one‑pager. Includes quarterly storyboard view, ATPM tribe examples, and an asset checklist.

## 🧰 Features
- Month‑by‑month planner per **market**
- **Cohesion** scoring with guardrails (hero repeats, quarterly presence, etc.)
- **Quarterly Storyboard** with asset‑readiness bars
- **ATPM Tribes** examples; assign tribes per placement
- **Campaign Asset Checklist** (auto % ready)
- **One‑Pager** export (print to PDF)
- LocalStorage persistence
- Inline self‑tests (see devtools console: `[TEST] PASS/FAIL`)

---

## 🚀 Run locally (no Docker)

### 1) Prereqs
- Node.js 18+ (20+ recommended)
- npm (or pnpm / yarn)

### 2) Install deps
```bash
npm install
```

### 3) Start dev server
```bash
npm run dev
```
Then open the URL shown in the terminal (typically http://localhost:5173).

### 4) Build for production (optional)
```bash
npm run build
npm run preview   # serve the built files locally
```

---

## 🐳 Run on a Docker server

### Option A — Build locally and run
```bash
docker build -t campaign-storyboarder .
docker run -d --name storyboarder -p 8080:80 campaign-storyboarder
```
Now open http://localhost:8080 (or your server’s IP:8080).

### Option B — docker-compose
```bash
docker compose up -d --build
```
This maps the app to port **8080** on your host. Adjust in `docker-compose.yml` if needed.

### Deploy notes
- Image serves static build via **nginx**.
- SPA fallback is configured so refreshing routes works.
- For HTTPS/Custom domains, put this behind your reverse proxy (e.g., Traefik, Nginx Proxy Manager, Caddy).

---

## 🧪 Inline tests
Open your browser devtools console and look for `[TEST] PASS/FAIL`. A summary array is also available as `window.__CS_TEST_RESULTS`.

---

## 📝 Tech stack
- Vite + React 18
- Tailwind via CDN (no build step required for styles)

---

## 📁 Project structure
```
.
├─ public/
├─ src/
│  ├─ App.jsx        # Main application (from canvas)
│  └─ main.jsx       # React mount
├─ index.html
├─ package.json
├─ Dockerfile
├─ docker-compose.yml
└─ README.md
```

---

## ⚠️ Notes
- Data is saved in your browser’s LocalStorage under key `campaign_storyboarder_v2`.
- Printing the One‑Pager uses your browser’s **Print** → **Save as PDF**.
- If you want Tailwind fully compiled, you can add a PostCSS/Tailwind pipeline later; this build uses the CDN for simplicity.
