# Craft Mastery 🧵

**AI-driven market linkage and smart cataloging for marginalized artisans.**
Smart India Hackathon 2026 · Problem Statement **PS 26090**

Craft Mastery lets artisans with low digital/literacy barriers create professional product catalogs using **voice in their own language** (13 Indian languages), AI image enhancement, and AI fair-pricing — then connects them directly with customers through a cross-lingual marketplace.

## Repository layout

```
craft-mastery/
├── frontend/    # 📱 The mobile app (Expo / React Native) — the product's primary UI
├── backend/     # 🖥️ The API server (Express + TypeScript) — AI, auth, catalog, inquiries
├── database/    # 🗄️ Data-store documentation (schema reference)
├── docs/        # 📚 architecture.md · api-contract.md · workflow.md
├── .env.example # 🔑 Environment variable NAMES only — copy to .env and fill in locally
└── package.json # Root scripts that delegate to frontend/ and backend/
```

- **`frontend/` is the mobile app** (Expo SDK 57). Artisan flow: photo → voice description → AI catalog → pricing → publish. Customer flow: browse, inquire, multilingual chat. 13-language i18n included.
- **`backend/` is the API/server** (Express, runs on port 3000). It hosts all `/api/*` routes (AI extraction, description generation, pricing, translation, customer search, order guidance, products, inquiries, users, files), Firebase-phone-token authentication, rate limiting, and JSON-file persistence. It also serves the legacy web prototype (Vite) that predates the mobile app.
- **Database docs:** [`database/schema/README.md`](database/schema/README.md) — the current JSON store (`backend/data/craft_mastery_store.json`) and planned Supabase/Cloudinary evolution.
- **Workflow doc:** [`docs/workflow.md`](docs/workflow.md) — the **locked** product workflow (Splash → Language Selection → Login → Artisan/Customer journeys) that later build steps will implement.
- **Architecture doc:** [`docs/architecture.md`](docs/architecture.md) — current vs intended service chain (Frontend → Backend → Firebase / Supabase / Cloudinary / Gemini / Speech / Translation).
- **API doc:** [`docs/api-contract.md`](docs/api-contract.md) — every existing backend endpoint with request/response shapes.

## Quick start

**Prerequisites:** Node.js ≥ 20.

```bash
# 1. Install dependencies (frontend and backend are separate installs)
npm run setup

# 2. Configure environment variables (names only in the template)
cp .env.example backend/.env     # server-side keys (GEMINI_API_KEY, FIREBASE_*, ...)
cp .env.example frontend/.env    # mobile-side config (EXPO_PUBLIC_*)

# 3. Run the backend API (http://localhost:3000 — also serves the legacy web app)
npm run dev

# 4. Run the mobile app (Expo)
npm run mobile           # start Expo dev server (Expo Go / emulator)
```

Useful scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Backend dev server (API + web prototype on :3000) |
| `npm run mobile` | Expo dev server for the mobile app |
| `npm run build` / `npm start` | Production build / run of the backend |
| `npm run lint` | TypeScript checks for **both** workspaces |
| `npm run mobile:lint` | TypeScript check for the mobile app only |

## Environment variables & secrets

- All variable **names** are listed in [`.env.example`](.env.example) (Firebase, Gemini, Supabase, Cloudinary, background removal, server flags).
- Copy the template to `backend/.env` and/or `frontend/.env` and fill in real values **locally**.
- ⚠️ **Real credentials must NOT be committed.** `.env`, `.env.local`, service-account JSON, keystores, and key files are git-ignored. Share secrets through your team's password manager, never through Git.
- Without any keys the app still runs: every AI endpoint has a deterministic no-key fallback, and dev auth (`DEV_AUTH_ENABLED=true` with `dev:<phone>` tokens) replaces Firebase phone auth for local testing.

## Current phase

**Step 1 — repository cleanup & organization (this state).** The mobile app now lives in `frontend/`, the server in `backend/`; docs define the locked UI workflow and API contract. Feature work (language-selection-first flow, customer marketplace polish, ONDC/GeM) comes in later steps.
