# Craft Mastery — Professional Voice & AI Update

## What was changed

### 1. Mobile API connection fix
`frontend/src/adapters/api.ts`
- Expo Go `exp://...` Metro URLs are now parsed correctly.
- A physical iPhone no longer falls back to `localhost:3000`.
- `EXPO_PUBLIC_API_BASE_URL` accepts either a host URL or `/api` URL.
- Speech-to-text automatically uses the public voice endpoint before login.

### 2. Global voice assistant
New:
`frontend/src/components/VoiceAssistant.tsx`

Mounted from:
`frontend/src/navigation/RootNavigator.tsx`

The assistant is available from:
- Language selection
- Login/register
- Onboarding
- Artisan dashboard
- Add Craft
- Catalog
- Messages
- Buyer marketplace
- Buyer inquiries
- Buyer profile

Flow:
Voice -> Sarvam speech-to-text -> Gemini assistant -> Expo Speech response.

### 3. AI craft photo enhancement
`frontend/src/screens/artisan/UploadScreen.tsx`
- Photo selection automatically starts AI enhancement.
- Original and enhanced versions are shown side-by-side.
- Original photo is preserved as a fallback.

`frontend/src/adapters/api.ts`
- Added `enhanceCraftImage()`.

`backend/server.ts`
- Added `/api/ai/enhance-image`.
- Uses Gemini image editing while preserving the real craft/product.
- Falls back to the original if AI is unavailable.

### 4. Speech-to-text availability before login
`backend/server.ts`
- Added `/api/public/speech-to-text`.
- Added `/api/public/assistant`.
- Both are rate-limited.
- Authenticated app APIs remain protected.

### 5. Professional artisan dashboard
`frontend/src/screens/artisan/DashboardScreen.tsx`
- Clear workshop header.
- Main "Create your next listing" CTA.
- Business snapshot cards.
- Quick actions.
- Recent crafts.
- Buyer inquiry shortcut.
- AI service status.

### 6. Professional buyer marketplace/dashboard
`frontend/src/screens/customer/MarketplaceScreen.tsx`
- Buyer welcome header.
- Search panel.
- AI search feedback.
- Category browsing.
- Large professional craft cards.
- Authenticity/location/artisan metadata.
- Clear pricing and view action.

### 7. Simpler professional buyer account
`frontend/src/screens/customer/ProfileScreen.tsx`
- Name
- Mobile number
- Language
- Location
- Account role
- Role switching
- Sign out

### 8. Environment configuration
`.env.example`
- Added `SARVAM_API_KEY`.

## Required backend environment variables

At minimum for full AI/voice functionality:

```env
GEMINI_API_KEY=your_gemini_key
SARVAM_API_KEY=your_sarvam_key
DEV_AUTH_ENABLED=true
DEMO_DATA_ENABLED=true
```

For physical Expo Go testing, the frontend can automatically discover the Metro LAN host.
For deployed testing, set:

```env
EXPO_PUBLIC_API_BASE_URL=https://YOUR-BACKEND-DOMAIN/api
```

## Verification

Frontend:
`npm run typecheck` — PASS

Backend:
`npm run lint` — PASS
