# Backend API Contract

Base URL (local dev): `http://localhost:3000/api`
The mobile adapter uses `/api/v1/*`; the server treats `v1` as a transparent alias for the same routes.

All responses are JSON. Every application route below (except `/api/health` and `/api/services/status`) requires a **Bearer token** in the `Authorization` header.

- **Production auth:** Firebase Auth ID token (phone auth). Roles come from custom claims (`ARTISAN`, `CUSTOMER`, `ADMIN`); customers are the default.
- **Development auth:** with `DEV_AUTH_ENABLED=true`, the token `dev:<10-digit-phone>` is accepted for the seeded dev accounts (`9848012345` → ARTISAN, `9820044556` → CUSTOMER).

### Language codes

All `language` fields accept exactly: `te, hi, en, ta, kn, mr, bn, ml, gu, pa, or, as, ur`.

### Error format

```json
{ "error": "message" }
```

Common status codes: `400` validation · `401` missing/invalid token · `403` wrong role · `404` not found · `413` body too large · `429` rate limited (includes `Retry-After`).

### Rate limits (per IP, sliding 60 s window)

| Scope              | Limit |
|--------------------|-------|
| All `/api` routes  | 120/min (global), auth scope 60/min |
| `/api/ai/*`        | 12/min |
| `/api/products|inquiries|users` mutations | 30/min |

---

## Health & status

### `GET /api/health`
Public. → `{ "status": "ok", "service": "Craft Mastery Fullstack API", "hasGeminiKey": boolean }`

### `GET /api/services/status`
Public, non-secret configuration probe. → `{ status, services: { gemini, cloudinary, removeBackground, firebase, supabase, database } , endpoints: { apiBaseUrl, aiServiceUrl } }` (all `services.*` are booleans)

---

## AI endpoints (Gemini when `GEMINI_API_KEY` is set; deterministic fallback otherwise)

### `POST /api/ai/extract-info`
Voice/text → structured craft data + completeness check (follow-up question in the artisan's language when incomplete).

Request:
```json
{ "transcript": "string (≤12000, required)", "language": "te", "conversationHistory": [] }
```
Response:
```json
{
  "isComplete": true,
  "missingFields": [],
  "followUpQuestion": "",
  "extractedData": {
    "productName": "string", "category": "string", "material": "string",
    "craftTechnique": "string", "dimensions": "string", "weight": "string",
    "timeToMake": "string", "features": ["string"]
  }
}
```
Fallback behavior: heuristic extraction; `followUpQuestion` in Telugu/Hindi/English when material/dimensions are missing.

### `POST /api/ai/generate-description`
Craft data → professional multilingual catalog listing.

Request:
```json
{ "productData": { "productName": "string", "category": "string", "material": "string",
                   "craftTechnique": "string", "dimensions": "string", "weight": "string",
                   "timeToMake": "string", "features": ["string"] },
  "artisanLanguage": "te", "targetLanguage": "en" }
```
Response:
```json
{ "title": "string", "shortDescription": "string", "fullDescription": "string" }
```

### `POST /api/ai/pricing-recommendation`
Craft data → fair-price recommendation with rationale in the requested language.

Request:
```json
{ "productData": { ...same AI_PRODUCT_FIELDS as above }, "language": "te" }
```
Response:
```json
{
  "suggestedPriceMin": 1020,
  "suggestedPriceMax": 1500,
  "recommendedPrice": 1200,
  "pricingReason": "string (in the requested language)"
}
```

### `POST /api/ai/translate`
Two-way multilingual translation (customer ↔ artisan).

Request: `{ "text": "string (≤5000, required)", "fromLang": "te", "toLang": "en" }`
Response: `{ "translatedText": "string", "fromLang": "te", "toLang": "en" }` (+ `"isFallback": true` when the Gemini path is unavailable)

### `POST /api/ai/customer-search`
Customer shopping query → parsed search intent.

Request: `{ "query": "string (≤1000, required)", "language": "en" }`
Response: `{ "category": "string", "maxPrice": number|null, "keywords": ["string"], "aiMessage": "string" }`

### `POST /api/ai/order-guidance`
"Ask AI" guidance for a specific product (e.g. bulk-order handling).

Request: `{ "question": "string (≤2000)", "product": { ...product object }, "language": "en", "productId": "string", "productTitle": "string", "intent": "string", "customQuestion": "string" }`
(only `language` is required; `product` must be a valid product-shaped object if present)
Response: `{ "guidance": "string", "answer": "string", "suggestedAction": "CONTACT_ARTISAN", "recommendedQuantity": 100, ... }`

---

## Products

### `GET /api/products`
Any authenticated role. Returns products visible to the caller (scoping applies per role/ownership; demo seed records are hidden when `DEMO_DATA_ENABLED` is not `true`). → `[ CraftProduct, ... ]`

### `POST /api/products` (ARTISAN/ADMIN)
Creates a published product owned by the authenticated artisan. Body: product fields (title, descriptions, category, material, craftTechnique, dimensions, weight, timeToMake, region, prices, stockQuantity, customizationAvailable, translations) + `originalImageUrl` / `enhancedImageUrl` which may be **data URLs** (`image/jpeg|png|webp`, ≤8 MB each, max 2 per product) — the server validates magic bytes and stores them privately.

Response `201`: `{ "product": CraftProduct }`

### `DELETE /api/products/:id` (ARTISAN/ADMIN)
Deletes own product. → `204 No Content`

---

## Inquiries & messaging

### `GET /api/inquiries`
Auth role. Returns inquiries visible to the caller (customer's own / referencing artisan's products). ID fields are stripped for non-admins. → `[ ProductInquiry, ... ]`

### `POST /api/inquiries` (CUSTOMER/ADMIN)
Creates an inquiry ("Contact Artisan"). Required: `productId`; optional: `requestedQuantity`, `initialMessage`, `customerLanguage`, plus denormalized product/customer fields (server fills ownership + product snapshot).

Response `201`: `{ ProductInquiry }` with `status: "PENDING"` and an initial customer message when `initialMessage` was supplied.

### `POST /api/inquiries/:id/messages`
Appends a message (server translates between `artisanLanguage` ↔ `customerLanguage`). Body: `{ "originalText": "string (≤5000)", "text": "string", "senderRole": "ARTISAN"|"CUSTOMER", "senderName": "string", "inquiryId": "string" }`

### `POST /api/inquiries/:id/reply`
Reply with automatic cross-language translation. Body: `{ "originalText": "string (required, ≤5000)", "originalLang": "te", "senderRole": "ARTISAN"|"CUSTOMER", "senderName": "string" }`
Response: updated inquiry including translated `messages`.

---

## Users

### `GET /api/users/:phone`
Profile lookup by phone (`+?[0-9 ()-]{7,20}`). Non-admins receive a redacted `user` object.

### `POST /api/users`
Upsert profile. Body: `{ "name", "language", "onboardingComplete", "craftSpecialty", "location", "shoppingInterests", "phone", "role" }` → `200 { "user": ... }`

### `POST /api/admin/users/:uid/role` (ADMIN)
Sets a user's role claim: `{ "role": "ARTISAN"|"CUSTOMER"|"ADMIN" }` → `200 { "uid", "role" }`

---

## Files (private product media)

Images are stored server-side (never public URLs) and served only through this authenticated route, after ownership checks.

### `GET /api/files/:id`
Streams the stored image (`image/jpeg|png|webp`) with `Cache-Control: private, no-store`.

### `DELETE /api/files/:id` (ARTISAN/ADMIN, owner)
Removes the file and clears product references. → `204 No Content`

---

## Serving model

- **Dev (`npm run dev` in `backend/`):** Express + Vite middleware — serves the legacy web prototype from `backend/src/` and the API on the same port (3000).
- **Production:** `npm run build` produces `backend/dist/` (web assets + bundled `server.cjs`); `npm start` serves them together.

## Conventions that must not drift

- All AI endpoints keep both the Gemini path and a no-key fallback so the app works without credentials.
- `/api/v1/*` remains accepted as an alias for `/api/*` (the mobile adapter depends on it).
- Customer/artisan ID fields stay stripped from inquiry responses for non-admin callers (privacy).
