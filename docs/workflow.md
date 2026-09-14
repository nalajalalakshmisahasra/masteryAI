# Product Workflow (LOCKED)

This is the locked product workflow for Craft Mastery (SIH 2026, PS 26090).
**Status: documented, NOT yet implemented.** Step 1 (repo cleanup) only prepared the codebase; implementation comes in later steps.

## Hard UI rules

- **No hero/onboarding carousel.** The final app must NOT open with feature/FAQ slides.
- The existing `frontend/src/screens/auth/HeroPitchScreen.tsx` and `OnboardingScreen.tsx` are legacy screens slated for removal when the new flow lands (Step 2+). They remain in the repo only to preserve existing behavior during cleanup.
- The opening flow is exactly: **Logo / Splash → Language Selection → Login**.
- **The language selected on the language screen controls the language of every subsequent screen** (via `frontend/src/i18n/LanguageContext` and the 13-language dictionaries).

## Global flow

```
LOGO / SPLASH
     ↓
LANGUAGE SELECTION          (13 languages: te hi en ta kn mr bn ml gu pa or as ur)
     ↓
All application UI uses the selected language
     ↓
LOGIN                       (Firebase phone auth)
     ↓
ARTISAN  or  CUSTOMER       (role-based navigation)
```

## Artisan journey

```
STEP 1 — Photo
  Take Photo OR Pick Photo
        ↓
  AI Image Enhancement / Background Improvement

STEP 2 — Describe (voice-first)
  Describe Product using local-language voice or text
        ↓
  Speech-to-Text                       (expo-speech + per-locale speech config)
        ↓
  AI understands product information   (POST /api/ai/extract-info, incl. completeness check)
        ↓
  Translation / professional catalog generation
                                       (POST /api/ai/generate-description, POST /api/ai/translate)

STEP 3 — Pricing
  AI recommends a price                (POST /api/ai/pricing-recommendation)
        ↓
  Artisan confirms or fixes the price  (final price is the artisan's decision)

STEP 4 — Publish
  Final professional product preview
        ↓
  ADD TO CATALOG                       (POST /api/products)
        ↓
  Product becomes available in the customer/buyer dashboard
```

## Customer journey

```
Login
  ↓
Customer dashboard
  ↓
Browse products
  ↓
Products created by artisans appear here
```

- The customer side will later contain **demo/sample products for testing** (seeded via `backend/data/craft_mastery_store.json`; hidden unless demo data is enabled — see `EXPO_PUBLIC_DEMO_DATA` / `DEMO_DATA_ENABLED` in `.env.example`).
- Inquiry/messaging ("Contact Artisan") with automatic two-way translation already exists in the backend (`POST /api/inquiries`, `POST /api/inquiries/:id/reply`) and will be surfaced in the new UI.

## Implementation notes for later steps

- The artisan steps above map 1:1 onto existing screens/adapters (`frontend/src/screens/artisan/`, `frontend/src/adapters/`); Step 2 will re-sequence them, not reinvent them.
- Language selection must write to `LanguageContext` (persisted in AsyncStorage) before Login, so post-login screens render in the chosen language immediately.
- No ONDC/GeM integration and no new backend routes are part of this workflow yet.
