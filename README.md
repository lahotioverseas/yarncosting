# Cotton Yarn Export Costing Engine

Export costing and pricing application for **Cotton Yarn**: three-panel spreadsheet layout, live FX rates, reverse target buyer calculation, Zoho CRM deals, and a **12:00 AM IST daily price lock**.

- **Frontend:** React 19 + TypeScript + Vite + Tailwind (`frontend/`)
- **Backend:** Python FastAPI (`backend/`), MongoDB Atlas with automatic local-file fallback

---

## 🚀 Running the Project

Requirements: **Node.js 20+** and **Python 3.10+**.

```bash
# 1. One-time setup (creates backend/.venv, installs Python + npm packages)
npm run setup

# 2. Start backend + frontend together (development, auto-reload)
npm run dev
#    -> open the "Open the app" URL it prints (normally http://localhost:3000)
#    If port 3000 / 8000 is already used by another program, the next free port is picked automatically.

# 3. Run every check (backend tests, frontend type-check, production build)
npm test

# Production: build the React app and serve app + API from FastAPI on one port (PORT, default 8080)
npm start

# Optional: create all MongoDB collections and push the app data
npm run mongo:init
```

Configuration lives in `.env` at the project root (copy `.env.example`) – see **Environment variables** below.

### Project structure

```
frontend/                 React app (UI unchanged)
  src/components/         ThreePanelCostingView, MidnightUpdatePromptModal, ...
  src/lib/                API clients (dailyPricingClient, api.ts RPC client, ...)
  vite.config.ts          dev server; proxies /api/* to the FastAPI backend
backend/                  FastAPI app
  app/main.py             app + routers + serves frontend/dist in production
  app/routers/            rpc, daily_pricing, google_sheet, zoho, misc (auth / employee sheets / mongo)
  app/services/           costing engine, pricing store + daily lock, sheet parser/sync, Zoho, Mongo, auth
  app/seed/               seed data (default price sheets, users, Zoho fallback accounts)
  storage/                runtime data: daily_pricing_store.json, price history, Zoho caches
  tests/                  pytest suite (run: npm test, or cd backend && .venv/Scripts/python -m pytest)
scripts/                  npm run setup / dev / start / test helpers
api/index.py              Vercel serverless entry (wraps backend/app)
vercel.json               Vercel build + routing config
requirements.txt          Python packages for the backend (used by Vercel and by npm run setup)
```

---

## 🕛 Daily Price Lock (12:00 AM IST)

Every night at **12:00 AM IST** all prices lock automatically. While locked, **nobody can calculate, save quotes or create Zoho deals**. The lock is based on the date, so it happens even if no one has the app open.

The Admin unlocks the day in one of two ways (the popup appears automatically when an Admin opens the app):

| Option | What the Admin does | Result |
| :--- | :--- | :--- |
| **Keep Yesterday's Prices** | One click | Unlocked immediately with the same prices |
| **Edit (Open Google Sheet)** | 1. Click **Edit** – the Google Sheet opens in a **new tab** (the Costing tab stays open)<br>2. Change prices in the sheet (Google saves automatically)<br>3. Come back to the Costing tab and click **Publish Prices** | The system reads the edited sheet, shows what changed, and unlocks the new prices |

**How to come back from the Google Sheet (simple for non-technical users):** just switch back to the Costing browser tab – it is still open and is already showing the big **Publish Prices** button. If the tab was closed, simply open the Costing app again: the system remembers that editing started and shows **Publish Prices** straight away. Optionally put the *Sheet Return Button* link (Admin → "Sheet Return Button") in the Google Sheet; clicking it also opens the Costing app on the Publish screen.

Prices stay locked until **Publish Prices** (or Keep Yesterday's Prices) is clicked by a logged-in Admin. After that they are active for every employee until the next 12:00 AM IST.

---

## 🔐 Environment variables (`.env`)

`.env` holds passwords and API keys, so it is **never committed to git** (it is listed in `.gitignore`). That is why it is not in the repository: every developer creates their own copy from `.env.example`, and Vercel gets the same values through its dashboard instead of the file.

| Variable | Needed? | What it is |
| :--- | :--- | :--- |
| `MONGODB_URI` | **Required** | MongoDB Atlas connection string. Without it nothing is saved permanently (on Vercel the disk is temporary). |
| `MONGODB_DB_NAME` | Optional | Database name (default `lahoti_costing_db`). Use a different name (e.g. `lahoti_costing_db_dev`) on your PC if you do not want local testing to change live prices. |
| `AUTH_SECRET` | **Required on Vercel** | Long random text used to sign logins. Generate one with `python -c "import secrets; print(secrets.token_hex(32))"`. |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | Optional | Zoho CRM. Without them quotes are still recorded, but no Zoho deal is created. |
| `ZOHO_API_DOMAIN`, `ZOHO_ACCOUNTS_DOMAIN` | Optional | Zoho data centre (default `.com`). |
| `MONGODB_ENABLED` | Optional | `false` = local files only (used by the tests). |

---

## ☁️ Deploying on Vercel

The repository is ready for Vercel: `vercel.json` builds the React app (`frontend/dist`, served as static files) and runs the FastAPI backend as one Python serverless function (`api/index.py`). All `/api/*` calls go to that function.

**Before the first deploy**

1. **MongoDB Atlas → Network Access → Add IP Address → "Allow access from anywhere" (`0.0.0.0/0`).** Vercel has no fixed IP address; without this the app cannot reach the database.
2. **Rotate the old secrets.** The Mongo password and Zoho keys used to be written inside the code. Change the Atlas database user password and regenerate the Zoho client secret / refresh token, then put the new values in `.env` and in Vercel.
3. Make sure the Google Sheet is shared as **"Anyone with the link can view"** (the backend downloads it as CSV).
4. Run `npm test` – everything must pass.

**Deploy**

1. Push the project to GitHub (check that `.env` is *not* in the commit).
2. On vercel.com → **Add New Project** → import the repository. Leave *Framework* = "Other", *Root Directory* = the repository root. Build settings come from `vercel.json`.
3. **Settings → Environment Variables**: add `MONGODB_URI`, `MONGODB_DB_NAME`, `AUTH_SECRET`, and the `ZOHO_*` keys (for Production and Preview).
4. Deploy. Then open `https://<your-app>.vercel.app/api/health` – it must show `"ok": true` and `"mongo": {"connected": true}`. Any problem is listed under `"problems"`.
5. Log in as Admin and do the daily check (Keep Yesterday's Prices or Edit → Publish Prices).

**How it behaves on Vercel**

* The 12:00 AM IST lock needs no cron job – it is calculated from the date on every request.
* Prices, history, saved quotes, costing records and sheet settings are stored in MongoDB, so every serverless instance sees the same data.
* Each request may run up to 60 s (`maxDuration` in `vercel.json`); publishing from Google Sheets normally takes 1–3 s.
* Use the **same Vercel domain** in the Google Sheet "Sheet Return Button" link (Admin → Sheet Return Button generates it automatically from the address you are on).

---

## 📌 Technical & Architecture Deliverables

1. **React + TypeScript Frontend (`frontend/src/components/ThreePanelCostingView.tsx`)**: Responsive three-panel layout matching spreadsheet workflow.
2. **MongoDB Atlas** storage: daily pricing store + history, saved quotes, costing records (save/replay), settings. Collections are created with `npm run mongo:init`.
3. **FastAPI backend (`backend/app`)**: Python port of the costing RPCs, daily pricing store and lock, Google Sheet sync, Zoho CRM and MongoDB management. `backend/tests/test_ts_parity.py` checks it returns the same numbers as the original TypeScript engine.

---

## 🔑 Core Formula Specs & Business Logic

### 1. The +$25 Freight Surcharge Rule
* The `$25` surcharge applies to the **raw USD per-FCL ocean freight rate** *before* INR conversion.
* **Formula**:
  $$\text{Selected Freight USD} = \text{Base Freight USD} + 25$$
  $$\text{Freight Cost (₹/kg)} = \frac{\text{Selected Freight USD} \times (\text{USD/INR Rate} + 0.50)}{\text{Qty per FCL (kg)}}$$
* *Example*: Base `$950` + `$25` = `$975`. Converted at ₹95.40 + ₹0.50 = ₹95.90. For 21,000 kg, Freight per kg = ₹4.4525.

### 2. USD/EUR Formula Asymmetry (Intentional)
* The calculation formula between USD and EUR export pricing is intentionally asymmetrical:
  * **USD Price (Full Stack)**: Derived after factoring in net ex-mill, FOB logistics, ocean freight, BCI/Org charges, interest/commission, and trader margin, divided by the unpadded USD/INR exchange rate.
    $$\text{USD Price} = \frac{\text{Total INR Cost Breakdown}}{\text{USD/INR Exchange Rate}}$$
  * **EUR Price (Pre-Freight / Spot Metric)**: Calculated as the INR Ex-Mill cost + Margin divided directly by the EUR/INR exchange rate (independent of ocean freight conversion).
  * If the EUR exchange rate is missing or unavailable, `usd_price` still returns normally while `eur_price` returns `null` without raising errors.

### 3. Biratnagar Row Business Naming Clarification
* In master port logistics data, two distinct "23 tons" entries exist for **Biratnagar**:
  1. **Biratnagar (23 tons - Via Kolkata Port)**: Handles Eastern Nepal transit via Haldia / Kolkata.
  2. **Biratnagar (23 tons - Via Visakhapatnam Port)**: Handles deep-draft vessel transit via Vizag.
* Disambiguated in the master database using explicit location and variant labels (`Biratnagar - Kolkata Route` vs `Biratnagar - Vizag Route`).

### 4. Daily FX Policy & Fallback Mechanics
* **Frequency**: Live USD/INR and EUR/INR are fetched by the backend on start, on every "refresh" from the app (every 2 minutes while open), and automatically before a calculation if the rates are older than 10 minutes.
* **Providers (in order)**: open.er-api.com → Frankfurter (ECB) → exchangerate-api.com.
* **Hardcoded emergency fallback**: `95.43` for USD/INR and `111.36` for EUR/INR.

---

## 🧪 System Validation Matrix

Automated in `backend/tests/test_validation_matrix.py` (tolerance **0.0001**), run with `npm test`.

| Test Group | Item / Case | Expected |
| :--- | :--- | :--- |
| **Reference Case** | Selected freight USD | `975` |
| **Reference Case** | DDB & RoDTEP | `16.9` |
| **Reference Case** | Net Ex-Mill | `321.1` |
| **Reference Case** | FOB cost per kg | `3.3333333333` |
| **Reference Case** | Freight per kg | `4.4525` |
| **Reference Case** | Total cost | `328.8858333333` |
| **Reference Case** | USD price | `3.5594824205` (margin 3.25%, see note) |
| **Target Case** | Allowed Ex-Mill | `271.7361666667` |
| **Target Case** | With 5% buffer | `285.3229750000` |
| **Target Case** | After interest | `285.3229750000` |
| **Target Case** | Final target ex-mill | `276.0499783125` (margin 3.25%, see note) |
| **Behaviour** | Freight table stores Chittagong | `950` (not `975`) |
| **Behaviour** | Origin = Mah destination list | `Casablanca, Port Louis` |
| **Behaviour** | Route with no published rate | Calculation Blocked |
| **Behaviour** | EUR rate missing | `usd_price` returns, `eur_price` null |
| **Behaviour** | Same inputs at USD/INR 90.0 | Freight per kg = `4.2017857143` |
| **Behaviour** | Save then replay after rate change | Replayed output identical to original |
| **Behaviour** | FX refresh twice same day | 1 row per currency per day |

> **Note:** the original spec used a 3% margin for Chittagong (USD price `3.5508638190`, final target `276.7632857500`). The current business rules add **+0.25%** margin for Chittagong (`getMarginTermsForDestination`), and the Daily Pricing freight sheet now publishes a **Santos** rate (6800 USD), so Gujarat → Santos is no longer blocked. These were already the results of the previous Node server; the tests document the current behaviour.
