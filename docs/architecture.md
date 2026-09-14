# Architecture

Craft Mastery — AI-driven market linkage and smart cataloging for marginalized artisans.
Smart India Hackathon 2026, Problem Statement 26090.

This document describes the architecture **as it exists after the repository reorganization** (Step 1), and the **intended architecture** for the upcoming build phases.

## Repository layout (current)

```
craft-mastery/
├── frontend/          # Mobile app (Expo / React Native) — the product's primary UI
│   ├── App.tsx
│   ├── index.ts
│   ├── app.json
│   ├── package.json
│   ├── assets/
│   └── src/
│       ├── adapters/      # api, auth, image, speech, storage (device capability adapters)
│       ├── components/ui/ # Avatar, Badge, Button, Card, Chip, EmptyState, ErrorState, ...
│       ├── config/        # assets, demo-mode helpers
│       ├── i18n/          # 13 Indian language dictionaries + LanguageContext
│       ├── navigation/    # RootNavigator, AuthStack, ArtisanTabs, CustomerTabs
│       ├── screens/       # artisan/, auth/, customer/ screens
│       ├── theme/         # design tokens
│       └── utils/         # phone helpers
│
├── backend/           # Express API + embedded web prototype
│   ├── server.ts          # all API routes, validation, rate limiting, persistence, AI calls
│   ├── serverAuth.ts      # Firebase Admin auth middleware (requireAuth / requireRole)
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── index.html         # legacy web prototype shell (served by the server)
│   ├── vite.config.ts
│   ├── vite-env.d.ts      # (src/vite-env.d.ts)
│   ├── data/              # craft_mastery_store.json (seed products + inquiries)
│   └── src/               # legacy web prototype (original AI Studio build)
│
├── database/
│   └── schema/            # data model documentation (see below)
│
├── docs/                  # this documentation set
├── .env.example           # variable NAMES only — no real credentials
├── .gitignore
├── package.json           # root orchestrator (delegates to frontend/ and backend/)
└── README.md
```

## Frontend (mobile app)

- **Stack:** Expo (SDK 57) / React Native 0.86, TypeScript, React Navigation.
- **Role:** The primary product UI. Artisan flow (photo → voice description → AI catalog → pricing → publish) and customer flow (browse, inquire, messages) live in `frontend/src/screens/`.
- **Firebase:** `@react-native-firebase/app` + `/auth` for phone authentication on device.
- **i18n:** `frontend/src/i18n/` ships dictionaries for 13 languages (`te, hi, en, ta, kn, mr, bn, ml, gu, pa, or, as, ur`) and a `LanguageContext` provider. **The selected language must drive the whole app UI** (locked product workflow — see `docs/workflow.md`).
- **API adapter:** `frontend/src/adapters/api.ts` calls the Express backend (`/api/v1/*`, which the server transparently maps to `/api/*`). Base URL resolution: `EXPO_PUBLIC_API_BASE_URL` → dev LAN host from Metro script URL → emulator loopback.
- **Storage adapter:** AsyncStorage-backed session persistence (`frontend/src/adapters/storage.ts`).
- **Demo isolation:** `frontend/src/config/demo.ts` filters seed/demo records when `EXPO_PUBLIC_DEMO_DATA=false`.

The legacy web prototype now under `backend/src/` shares the same visual language and workflows but is **not** the shipping UI; the Expo app supersedes it.

## Backend (API server)

- **Stack:** Node + Express 4, TypeScript (run via `tsx` in dev), Gemini `@google/genai`, Firebase Admin SDK.
- **Entry point:** `backend/server.ts` (single-file service). Auth middleware: `backend/serverAuth.ts`.
- **Responsibilities:**
  - All `/api/*` routes: AI endpoints, product CRUD, inquiries/messaging, user profiles, file storage, admin role provisioning.
  - Validation middleware per route (body allow-lists, string/number checks, image signature verification).
  - In-memory sliding-window rate limiting (global 120 req/min/IP; auth 60; AI 12; mutations 30).
  - JSON-file persistence in `backend/data/craft_mastery_store.json` (`STORE_DATA_DIR` overrides), plus private binary media storage (`MEDIA_STORAGE_DIR`, default `data/private-media/`).
  - CORS allow-list (`ALLOWED_ORIGINS`), bearer-token auth via Firebase Admin (`DEV_AUTH_ENABLED=true` enables `dev:<phone>` tokens for local development).
- **Embedded web prototype:** in dev the server mounts Vite middleware and serves the legacy web app from `backend/src/`; in production it serves `backend/dist/`. This preserves the original demo behavior; the mobile app talks to the same API.
- **AI behavior:** every AI endpoint has a Gemini path (when `GEMINI_API_KEY` is set) **and** a deterministic fallback path, so the app remains functional without keys.

## Data & storage

- **Current persistence:** JSON document file (`backend/data/craft_mastery_store.json`) holding `products`, `inquiries`, `users`, `files`. Media files stored under `backend/data/private-media/` (permission 0600) and served through authenticated `/api/files/:id` routes.
- **Schema reference:** see `database/schema/README.md`.
- **Intended evolution (not yet implemented):** Firebase Auth (live), Supabase (`DATABASE_URL`) and Cloudinary (`CLOUDINARY_*`) are referenced by configuration and status checks but are **not wired into the runtime yet** — the file store remains the source of truth.

## Service chain (intended end-state)

```
Frontend (Expo mobile app)
    │  HTTPS/JSON  (Bearer: Firebase ID token)
    ▼
Backend (Express API — backend/server.ts)
    │
    ├── Gemini (@google/genai, model gemini-3.8-flash)
    │      extract-info · generate-description · pricing-recommendation
    │      translate · customer-search · order-guidance
    │
    ├── Firebase
    │      Client: phone auth (@react-native-firebase/auth)
    │      Server: Admin SDK token verification + role custom claims
    │
    ├── Speech / Translation (on-device)
    │      expo-speech + locale speech configs (frontend/src/adapters/speech.ts)
    │      13-language dictionaries for voice-first UX
    │
    ├── Supabase / SQL  (configured, integration pending)
    │      SUPABASE_URL · SUPABASE_PUBLISHABLE_KEY · DATABASE_URL
    │
    ├── Cloudinary  (configured, integration pending)
    │      CLOUDINARY_CLOUD_NAME · CLOUDINARY_API_KEY · CLOUDINARY_API_SECRET
    │
    └── Local JSON store + private media dir (active persistence layer)
```

## Key cross-cutting rules

1. **Preserved behavior:** all existing routes, validation, Firebase logic, and Gemini prompts were kept intact during reorganization — no functionality was removed.
2. **Language-first UX:** the 13-language dictionaries are the single source of translations; the locked workflow (splash → language → login) will be enforced in a later UI step.
3. **No secrets in code:** all credentials arrive via environment variables (see `.env.example`); real keys must never be committed.
4. **Backward-compatible API:** the backend keeps serving `/api/*` with `/api/v1/*` accepted as an alias, so the mobile adapter and legacy web prototype both keep working unchanged.
