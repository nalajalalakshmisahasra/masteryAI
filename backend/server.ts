import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { INITIAL_PRODUCTS, INITIAL_INQUIRIES } from './src/data/mockData.ts';
import { provisionRole, requireAuth, requireRole, samePhone } from './serverAuth.ts';

dotenv.config();
// Fallback for `npm run dev` executed from the repository root: load backend/.env too.
dotenv.config({ path: path.resolve(process.cwd(), 'backend', '.env') });

const app = express();

const PORT = 3000;
const speechUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB
  },
});

// -------------------------------------------------------------
// Speech-to-Text (AssemblyAI) configuration
// -------------------------------------------------------------
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

/**
 * AssemblyAI's `language_code` parameter only accepts a fixed set of codes.
 * Most Indian regional languages this app supports (Telugu, Tamil, Kannada,
 * Marathi, Bengali, Malayalam, Gujarati, Punjabi, Odia, Assamese, Urdu) are
 * NOT in AssemblyAI's supported set as of this writing — passing one would
 * return an API error, not just a poor transcription. Verify current
 * coverage at https://www.assemblyai.com/docs before expanding this list.
 * For anything outside the confirmed-supported set, we fall back to
 * automatic language detection instead of guessing.
 */
const ASSEMBLYAI_SUPPORTED_LANGUAGE_CODES = new Set(['en', 'hi']);

function resolveAssemblyLanguageCode(requested: unknown): { language_code?: string; language_detection?: boolean } {
  if (typeof requested === 'string' && ASSEMBLYAI_SUPPORTED_LANGUAGE_CODES.has(requested)) {
    return { language_code: requested };
  }
  return { language_detection: true };
}

const REQUEST_WINDOW_MS = 60_000;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_STRING_LENGTH = 5000;
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8082,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);
function clientError(res: express.Response, status: number, error: string) {
  return res.status(status).json({ error });
}

function rateLimit(name: string, limit: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    if (requestBuckets.size > 10000) {
      for (const [bucketKey, bucketValue] of requestBuckets) {
        if (bucketValue.resetAt <= now) requestBuckets.delete(bucketKey);
      }
    }
    const key = `${name}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const bucket = requestBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      requestBuckets.set(key, { count: 1, resetAt: now + REQUEST_WINDOW_MS });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return clientError(res, 429, 'Too many requests. Please try again later.');
    }
    return next();
  };
}

function validateBody(allowed: string[], required: string[] = []) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return clientError(res, 400, 'Invalid request body');
    }
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
    if (unknown.length > 0 || required.some((key) => body[key] === undefined)) {
      return clientError(res, 400, 'Invalid request fields');
    }
    return next();
  };
}

function validateString(field: string, max = MAX_STRING_LENGTH, required = false) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const value = req.body?.[field];
    if (value === undefined && !required) return next();
    if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) {
      return clientError(res, 400, `Invalid ${field}`);
    }
    return next();
  };
}

function validateParam(field: string, pattern: RegExp) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!pattern.test(req.params[field] || '')) return clientError(res, 400, 'Invalid route parameter');
    return next();
  };
}

function rejectOversizedRouteBodies(req: express.Request, res: express.Response, next: express.NextFunction) {
  const contentLength = Number(req.header('content-length') || 0);
  if (!contentLength) return next();
  const route = req.url.replace(/^\/api\/v1/, '/api');
 const limit = route.startsWith('/api/ai/')
  ? 256 * 1024
  : route.startsWith('/api/users')
    ? 32 * 1024
    : route.startsWith('/api/inquiries')
      ? 256 * 1024
      : route.startsWith('/api/products')
        ? 20 * 1024 * 1024
        : route.startsWith('/api/speech-to-text')
          ? 15 * 1024 * 1024
          : 256 * 1024;
  if (contentLength > limit) return clientError(res, 413, 'Request body is too large');
  return next();
}

function validateProductInput(req: express.Request, res: express.Response, next: express.NextFunction) {
  const body = req.body;
  const stringFields = PRODUCT_FIELDS.filter((field) => ![
    'suggestedPriceMin', 'suggestedPriceMax', 'recommendedPrice', 'finalPrice', 'stockQuantity',
    'customizationAvailable', 'translations',
  ].includes(field));
  if (stringFields.some((field) => body[field] !== undefined &&
      (typeof body[field] !== 'string' || body[field].length > MAX_STRING_LENGTH))) {
    return clientError(res, 400, 'Invalid product fields');
  }
  for (const field of ['suggestedPriceMin', 'suggestedPriceMax', 'recommendedPrice', 'finalPrice', 'stockQuantity']) {
    if (body[field] !== undefined && (typeof body[field] !== 'number' || !Number.isFinite(body[field]) || body[field] < 0)) {
      return clientError(res, 400, 'Invalid product fields');
    }
  }
  if (body.customizationAvailable !== undefined && typeof body.customizationAvailable !== 'boolean') {
    return clientError(res, 400, 'Invalid product fields');
  }
  return next();
}

function validateInquiryInput(req: express.Request, res: express.Response, next: express.NextFunction) {
  const quantity = req.body?.requestedQuantity;
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000)) {
    return clientError(res, 400, 'Invalid requested quantity');
  }
  for (const field of ['productTitle', 'productImage', 'customerName', 'customerPhone', 'artisanName']) {
    if (req.body?.[field] !== undefined && typeof req.body[field] !== 'string') return clientError(res, 400, 'Invalid inquiry fields');
  }
  return next();
}

function validateMessageInput(req: express.Request, res: express.Response, next: express.NextFunction) {
  const text = req.body?.originalText ?? req.body?.text;
  if (typeof text !== 'string' || text.trim().length === 0 || text.length > 5000) {
    return clientError(res, 400, 'Invalid message text');
  }
  return next();
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  const origin = req.header('origin');
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (process.env.NODE_ENV === 'production' && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.method === 'OPTIONS') return res.sendStatus(origin && ALLOWED_ORIGINS.has(origin) ? 204 : 403);
  return next();
});
app.use(rateLimit('api', 120));
app.use(rejectOversizedRouteBodies);
app.use(express.json({ limit: '20mb', strict: true }));
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large' || err instanceof SyntaxError) {
    return clientError(res, 400, err?.type === 'entity.too.large' ? 'Request body is too large' : 'Malformed JSON');
  }
  return next(err);
});

// Support both /api/* and /api/v1/* (for Expo mobile & web clients)
app.use((req, res, next) => {
  if (req.url.startsWith('/api/v1/')) {
    req.url = req.url.replace('/api/v1/', '/api/');
  }
  next();
});

// Persistence Setup
const DATA_DIR = path.resolve(process.env.STORE_DATA_DIR || path.join(process.cwd(), 'data'));
const DATA_FILE = path.join(DATA_DIR, 'craft_mastery_store.json');
const MEDIA_DIR = path.resolve(process.env.MEDIA_STORAGE_DIR || path.join(DATA_DIR, 'private-media'));
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGES_PER_PRODUCT = 2;
const DATA_URL_PATTERN = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const DEMO_DATA_ENABLED = process.env.NODE_ENV !== 'production' && process.env.DEMO_DATA_ENABLED === 'true';
const DEMO_PRODUCT_IDS = new Set([
  'prod-kondapalli-01', 'prod-pochampally-02', 'prod-dokra-03', 'prod-bluepottery-04',
  'prod-channapatna-05', 'prod-bidriware-06', 'prod-tanjore-07', 'prod-walnut-08',
  'prod-kalamkari-09', 'prod-tholubommalata-10', 'prod-pashmina-11', 'prod-madhubani-12',
]);
const DEMO_INQUIRY_IDS = new Set(['inq-bulk-001', 'inq-bulk-002']);

let productsDb: any[] = [];
let inquiriesDb: any[] = [];
let usersDb: any[] = [];
let filesDb: Array<{
  id: string;
  productId: string;
  ownerUid: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  size: number;
  storageKey: string;
  createdAt: string;
}> = [];

function saveStoreToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify(
        {
          products: productsDb,
          inquiries: inquiriesDb,
          users: usersDb,
          files: filesDb,
          savedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to save store to disk:', err);
  }
}

function imageSignature(buffer: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function isStructurallyValidImage(buffer: Buffer, mimeType: 'image/jpeg' | 'image/png' | 'image/webp'): boolean {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 5 && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 33 && buffer.toString('ascii', 12, 16) === 'IHDR' && buffer.includes(Buffer.from('IEND'));
  }
  return buffer.length >= 20 && buffer.readUInt32LE(4) <= buffer.length - 8;
}

function storeImageDataUrl(dataUrl: unknown, productId: string, ownerUid: string): string | null {
  if (typeof dataUrl !== 'string' || !dataUrl) return null;
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) throw new Error('Unsupported image format');
  const declaredMime = match[1] as 'image/jpeg' | 'image/png' | 'image/webp';
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) throw new Error('Image exceeds the permitted size');
  const actualMime = imageSignature(buffer);
  if (!actualMime || actualMime !== declaredMime || !isStructurallyValidImage(buffer, actualMime)) {
    throw new Error('Image content does not match its declared type');
  }

  fs.mkdirSync(MEDIA_DIR, { recursive: true });
  const id = crypto.randomUUID();
  const extension = actualMime === 'image/jpeg' ? 'jpg' : actualMime.slice('image/'.length);
  const storageKey = `${id}.${extension}`;
  fs.writeFileSync(path.join(MEDIA_DIR, storageKey), buffer, { flag: 'wx', mode: 0o600 });
  filesDb.push({ id, productId, ownerUid, mimeType: actualMime, size: buffer.length, storageKey, createdAt: new Date().toISOString() });
  return `/api/files/${id}`;
}

function removeStoredFile(file: (typeof filesDb)[number]): void {
  const absolutePath = path.join(MEDIA_DIR, file.storageKey);
  if (path.dirname(absolutePath) !== path.resolve(MEDIA_DIR)) return;
  try { fs.rmSync(absolutePath, { force: true }); } catch (err) { console.error('[Media] Failed to remove file:', err); }
}

function resolveMediaReference(value: unknown, auth: NonNullable<Express.Request['auth']>): string {
  if (typeof value !== 'string' || !value.startsWith('/api/files/')) return typeof value === 'string' ? value : '';
  const file = validateStoredFileAccess(value.slice('/api/files/'.length), auth);
  if (!file || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(file.storageKey)) return '';
  try {
    const bytes = fs.readFileSync(path.join(MEDIA_DIR, file.storageKey));
    return `data:${file.mimeType};base64,${bytes.toString('base64')}`;
  } catch (err) {
    console.error('[Media] Failed to resolve stored reference:', err);
    return '';
  }
}

function hydrateProductMedia(product: any, auth: NonNullable<Express.Request['auth']>): any {
  return {
    ...product,
    originalImageUrl: resolveMediaReference(product.originalImageUrl, auth),
    enhancedImageUrl: resolveMediaReference(product.enhancedImageUrl, auth),
  };
}

function storeProductMedia(product: any, ownerUid: string): any {
  const values = [product.originalImageUrl, product.enhancedImageUrl].filter(Boolean);
  if (values.length > MAX_IMAGES_PER_PRODUCT) throw new Error('Too many images');
  const storedKeys: string[] = [];
  try {
    const originalImageUrl = storeImageDataUrl(product.originalImageUrl, product.id, ownerUid);
    if (originalImageUrl) storedKeys.push(originalImageUrl);
    const enhancedImageUrl = storeImageDataUrl(product.enhancedImageUrl, product.id, ownerUid);
    if (enhancedImageUrl) storedKeys.push(enhancedImageUrl);
    return { ...product, originalImageUrl, enhancedImageUrl };
  } catch (err) {
    for (const reference of storedKeys) {
      const file = filesDb.find((item) => `/api/files/${item.id}` === reference);
      if (file) {
        removeStoredFile(file);
        filesDb = filesDb.filter((item) => item.id !== file.id);
      }
    }
    throw err;
  }
}

function reconcileStoredFiles(): void {
  const validFiles = filesDb.filter((file) => {
    return /^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(file.storageKey) && fs.existsSync(path.join(MEDIA_DIR, file.storageKey));
  });
  const validReferences = new Set(validFiles.map((file) => `/api/files/${file.id}`));
  let changed = validFiles.length !== filesDb.length;
  filesDb = validFiles;
  for (const product of productsDb) {
    for (const field of ['originalImageUrl', 'enhancedImageUrl']) {
      if (typeof product[field] === 'string' && product[field].startsWith('/api/files/') && !validReferences.has(product[field])) {
        product[field] = '';
        changed = true;
      }
    }
  }
  if (changed) saveStoreToDisk();
}

function isDemoProduct(product: any): boolean {
  return DEMO_PRODUCT_IDS.has(product?.id);
}

function visibleProductsFor(auth: NonNullable<Express.Request['auth']>): any[] {
  const products = DEMO_DATA_ENABLED ? productsDb : productsDb.filter((product) => !isDemoProduct(product));
  if (auth.role === 'ADMIN') return products.map((product) => hydrateProductMedia(product, auth));
  if (auth.role === 'ARTISAN') {
    return products
      .filter((product) => product.artisanId === auth.uid || samePhone(product.artisanPhone, auth.phone))
      .map((product) => hydrateProductMedia(product, auth));
  }
  return products.map(({ artisanId, artisanPhone, ...product }) => hydrateProductMedia(product, auth));
}

function visibleInquiriesFor(auth: NonNullable<Express.Request['auth']>): any[] {
  const inquiries = DEMO_DATA_ENABLED
    ? inquiriesDb
    : inquiriesDb.filter((inquiry) => !DEMO_INQUIRY_IDS.has(inquiry.id));
  if (auth.role === 'ADMIN') return inquiries;
  const ownedProductIds = new Set(
    visibleProductsFor({ ...auth, role: 'ARTISAN' })
      .map((product) => product.id)
  );
  return inquiries.filter((inquiry) =>
    auth.role === 'CUSTOMER'
      ? inquiry.customerId === auth.uid || samePhone(inquiry.customerPhone, auth.phone)
      : ownedProductIds.has(inquiry.productId) ||
        inquiry.artisanId === auth.uid ||
        samePhone(inquiry.artisanPhone, auth.phone)
  );
}

function loadStoreFromDisk() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.products) && parsed.products.length > 0) {
        productsDb = parsed.products;
      }
      if (Array.isArray(parsed.inquiries) && parsed.inquiries.length > 0) {
        inquiriesDb = parsed.inquiries;
      }
      if (Array.isArray(parsed.users)) {
        usersDb = parsed.users;
      }
      if (Array.isArray(parsed.files)) {
        filesDb = parsed.files;
      }
      console.log(`[Store] Loaded ${productsDb.length} products, ${inquiriesDb.length} inquiries, ${usersDb.length} users from disk.`);
      return true;
    }
  } catch (err) {
    console.error('Failed to load store from disk:', err);
  }
  return false;
}
function validateStoredFileAccess(fileId: string, auth: NonNullable<Express.Request['auth']>) {
  const file = filesDb.find((item) => item.id === fileId);
  if (!file) return null;
  if (auth.role === 'ADMIN' || file.ownerUid === auth.uid) return file;
  const product = productsDb.find((item) => item.id === file.productId);
  if (auth.role === 'CUSTOMER' && product?.status === 'PUBLISHED') return file;
  return null;
}

// Lazy Gemini AI initialization with aistudio-build User-Agent
let aiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Helper language mapper
const GEMINI_MODEL = 'gemini-3.8-flash';

const LANGUAGE_NAMES: Record<string, string> = {
  te: 'Telugu (తెలుగు)',
  hi: 'Hindi (हिन्दी)',
  en: 'English',
  ta: 'Tamil (தமிழ்)',
  kn: 'Kannada (ಕನ್ನಡ)',
  mr: 'Marathi (मराठी)',
  bn: 'Bengali (বাংলা)',
  ml: 'Malayalam (മലയാളം)',
  gu: 'Gujarati (ગુજરાતી)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  or: 'Odia (ଓଡ଼ିଆ)',
  as: 'Assamese (অসমীয়া)',
  ur: 'Urdu (اردو)',
};
const SUPPORTED_LANGUAGES = new Set(Object.keys(LANGUAGE_NAMES));
const AI_PRODUCT_FIELDS = ['productName', 'category', 'material', 'craftTechnique', 'dimensions', 'weight', 'timeToMake', 'features'];
const PRODUCT_FIELDS = [
  'title', 'shortDescription', 'fullDescription', 'category', 'material', 'craftTechnique', 'dimensions',
  'weight', 'timeToMake', 'region', 'originalImageUrl', 'enhancedImageUrl', 'suggestedPriceMin',
  'suggestedPriceMax', 'recommendedPrice', 'finalPrice', 'pricingReason', 'stockQuantity',
  'customizationAvailable', 'translations',
];

function validateLanguage(field: string) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const language = req.body?.[field];
    if (language !== undefined && (typeof language !== 'string' || !SUPPORTED_LANGUAGES.has(language))) {
      return clientError(res, 400, `Invalid ${field}`);
    }
    return next();
  };
}

function validateAIProductData(req: express.Request, res: express.Response, next: express.NextFunction) {
  const productData = req.body?.productData;
  if (!productData || typeof productData !== 'object' || Array.isArray(productData)) {
    return clientError(res, 400, 'Invalid product data');
  }
  if (Object.keys(productData).some((key) => !AI_PRODUCT_FIELDS.includes(key))) {
    return clientError(res, 400, 'Invalid product data');
  }
  for (const field of AI_PRODUCT_FIELDS) {
    if (field !== 'features' && productData[field] !== undefined &&
        (typeof productData[field] !== 'string' || productData[field].length > 1000)) {
      return clientError(res, 400, 'Invalid product data');
    }
  }
  if (productData.features !== undefined &&
      (!Array.isArray(productData.features) || productData.features.length > 20 ||
        productData.features.some((item: unknown) => typeof item !== 'string' || item.length > 300))) {
    return clientError(res, 400, 'Invalid product data');
  }
  return next();
}

function validateConversationHistory(req: express.Request, res: express.Response, next: express.NextFunction) {
  const history = req.body?.conversationHistory;
  if (history !== undefined && (!Array.isArray(history) || history.length > 20 || history.some((item) => {
    return !item || typeof item !== 'object' || typeof item.role !== 'string' ||
      typeof item.content !== 'string' || item.content.length > 2000;
  }))) {
    return clientError(res, 400, 'Invalid conversation history');
  }
  return next();
}

function validateGuidanceProduct(req: express.Request, res: express.Response, next: express.NextFunction) {
  const product = req.body?.product;
  if (product === undefined) {
    if (typeof req.body?.productId !== 'string' || req.body.productId.length > 128 ||
        typeof req.body?.productTitle !== 'string' || req.body.productTitle.length > 1000 ||
        typeof req.body?.intent !== 'string' || req.body.intent.length > 100 ||
        (req.body.customQuestion !== undefined && (typeof req.body.customQuestion !== 'string' || req.body.customQuestion.length > 2000))) {
      return clientError(res, 400, 'Invalid product guidance request');
    }
    return next();
  }
  if (typeof product !== 'object' || Array.isArray(product)) {
    return clientError(res, 400, 'Invalid product');
  }
  const allowed = [
    'id', 'title', 'finalPrice', 'material', 'craftTechnique', 'timeToMake', 'region', 'artisanName',
    'artisanId', 'artisanPhone', 'artisanLanguage', 'category', 'shortDescription', 'fullDescription',
    'dimensions', 'weight', 'stockQuantity', 'status', 'translations',
  ];
  if (Object.keys(product).some((key) => !allowed.includes(key))) return clientError(res, 400, 'Invalid product');
  for (const key of allowed) {
    if (product[key] !== undefined && typeof product[key] !== 'string' && typeof product[key] !== 'number') {
      return clientError(res, 400, 'Invalid product');
    }
    if (typeof product[key] === 'string' && product[key].length > 1000) return clientError(res, 400, 'Invalid product');
  }
  return next();
}

const aiRateLimit = rateLimit('ai', 12);
const mutationRateLimit = rateLimit('mutation', 30);
const authRateLimit = rateLimit('auth', 60);

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Craft Mastery Fullstack API',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Service configuration status (safe health check without exposing secrets)
app.get('/api/services/status', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      cloudinary: Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY),
      removeBackground: Boolean(
        process.env['remove background_API'] ||
        process.env.REMOVE_BACKGROUND_API ||
        process.env.REMOVE_BG_API_KEY
      ),
      firebase: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY),
      database: Boolean(process.env.DATABASE_URL),
      assemblyAI: Boolean(ASSEMBLYAI_API_KEY),
    },
    endpoints: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1',
      aiServiceUrl: process.env.EXPO_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001',
    },
  });
});

// All application data, AI, profile, and mutation routes require a verified identity.
app.use('/api', authRateLimit, requireAuth);
app.use('/api/ai', aiRateLimit);
app.use('/api/products', mutationRateLimit);
app.use('/api/inquiries', mutationRateLimit);
app.use('/api/users', mutationRateLimit);

app.get('/api/files/:id', validateParam('id', /^[0-9a-f-]{36}$/), (req, res) => {
  const file = validateStoredFileAccess(req.params.id, req.auth!);
  if (!file || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(file.storageKey)) {
    return clientError(res, 404, 'File not found');
  }
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', file.size);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.sendFile(file.storageKey, { root: MEDIA_DIR, dotfiles: 'deny' });
});

app.delete('/api/files/:id', requireRole('ARTISAN', 'ADMIN'), validateParam('id', /^[0-9a-f-]{36}$/), (req, res) => {
  const file = filesDb.find((item) => item.id === req.params.id);
  if (!file || (req.auth!.role !== 'ADMIN' && file.ownerUid !== req.auth!.uid)) {
    return clientError(res, 404, 'File not found');
  }
  removeStoredFile(file);
  filesDb = filesDb.filter((item) => item.id !== file.id);
  for (const product of productsDb) {
    if (product.originalImageUrl === `/api/files/${file.id}`) product.originalImageUrl = '';
    if (product.enhancedImageUrl === `/api/files/${file.id}`) product.enhancedImageUrl = '';
  }
  saveStoreToDisk();
  return res.status(204).send();
});

// 1a. Speech-to-Text Transcription (AssemblyAI)
app.post('/api/speech-to-text', aiRateLimit, speechUpload.single('audio'), async (req, res) => {
  try {
    if (!ASSEMBLYAI_API_KEY) {
      return clientError(res, 500, 'Speech-to-text is not configured on the server (missing ASSEMBLYAI_API_KEY)');
    }
    const file = (req as any).file as { buffer: Buffer; size: number } | undefined;
    if (!file || !file.buffer || file.buffer.length === 0) {
      return clientError(res, 400, 'No audio file received');
    }

    // 1. Upload the raw audio bytes to AssemblyAI's temporary storage.
    const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
        'content-type': 'application/octet-stream',
      },
        body: new Uint8Array(file.buffer),
    });
    if (!uploadResponse.ok) {
      console.error('[Speech] AssemblyAI upload failed:', await uploadResponse.text());
      return clientError(res, 502, 'Failed to upload audio for transcription');
    }
    const { upload_url } = (await uploadResponse.json()) as { upload_url: string };

    // 2. Kick off the transcription job.
    const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: upload_url,
        ...resolveAssemblyLanguageCode(req.body?.language),
      }),
    });
    if (!transcriptResponse.ok) {
      console.error('[Speech] AssemblyAI transcript request failed:', await transcriptResponse.text());
      return clientError(res, 502, 'Failed to start transcription');
    }
    const { id: transcriptId } = (await transcriptResponse.json()) as { id: string };

    // 3. AssemblyAI transcribes asynchronously — poll until done.
    const POLL_INTERVAL_MS = 2000;
    const MAX_POLLS = 30; // ~60s ceiling before giving up
    let result: any = null;

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      const pollResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { authorization: ASSEMBLYAI_API_KEY },
      });
      if (!pollResponse.ok) {
        console.error('[Speech] AssemblyAI poll failed:', await pollResponse.text());
        return clientError(res, 502, 'Failed to check transcription status');
      }
      result = await pollResponse.json();
      if (result.status === 'completed' || result.status === 'error') break;
    }

    if (!result || result.status === 'error') {
      console.error('[Speech] AssemblyAI transcription error:', result?.error);
      return clientError(res, 502, 'Transcription failed');
    }
    if (result.status !== 'completed') {
      return clientError(res, 504, 'Transcription timed out — please try a shorter recording');
    }

    return res.json({
      transcript: result.text || '',
      language: result.language_code || req.body?.language,
    });
  } catch (err) {
    console.error('[Speech] /api/speech-to-text failed:', err);
    return clientError(res, 500, 'Speech-to-text failed');
  }
});

// 2. AI Product Information Extraction & Incomplete Info Detection
app.post('/api/ai/extract-info', validateBody(['transcript', 'language', 'conversationHistory'], ['transcript']), validateString('transcript', 12000, true), validateLanguage('language'), validateConversationHistory, async (req, res) => {
  try {
    const { transcript, language = 'te', conversationHistory = [] } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const ai = getGemini();
    const langName = LANGUAGE_NAMES[language] || 'Telugu';

    if (ai) {
      const prompt = `
You are Craft Mastery's AI Craft Assistant. An artisan has spoken or written about their handcrafted product.
Artisan's Native Language: ${langName} (Code: ${language}).

Artisan's Current Statement:
"${transcript}"

Previous Conversation context (if any):
${JSON.stringify(conversationHistory)}

YOUR TASKS:
1. Extract all identifiable craft details:
   - productName: Name or description of craft
   - category: One of [Wooden Crafts, Handloom Textiles, Metal Crafts, Pottery & Ceramics, Leather Crafts, Jewelry, Stone Carving, Paintings, Other]
   - material: Materials used (e.g. Mango wood, Poniki wood, Mulberry silk, Bell metal, Clay, etc.)
   - craftTechnique: Traditional technique used (e.g. Hand carving, Double ikat handloom, Lost-wax casting, Blue pottery)
   - dimensions: Approximate size/height/width
   - weight: Approximate weight
   - timeToMake: Estimated time to craft one piece
   - features: Array of distinct handmade qualities

2. INCOMPLETE INFORMATION CHECK:
   Is the description sufficiently complete to publish a professional e-commerce product?
   A complete listing REQUIRES at least:
   - Name/Type of product
   - Specific Material used
   - Approximate Dimensions/Size OR Time to make OR handmade technique details.

   If vital details are missing:
   - Set "isComplete": false
   - List missing fields in "missingFields" (e.g., ["material", "dimensions"])
   - Formulate a polite, warm, encouraging follow-up question in the artisan's native language (${langName}) asking SPECIFICALLY for the missing details. For example in Telugu: "నేను ఇది చేతితో చేసిన చెక్క బొమ్మ అని అర్థం చేసుకున్నాను. మీరు దీనికి ఏ చెక్క ఉపయోగించారు మరియు సుమారు పరిమాణం ఎంత ఉంటుందో చెప్పగలరా?"

   If sufficient information has been provided:
   - Set "isComplete": true
   - Set "missingFields": []
   - "followUpQuestion": ""

Respond ONLY with valid JSON matching this schema:
{
  "isComplete": boolean,
  "missingFields": string[],
  "followUpQuestion": string,
  "extractedData": {
    "productName": string,
    "category": string,
    "material": string,
    "craftTechnique": string,
    "dimensions": string,
    "weight": string,
    "timeToMake": string,
    "features": string[]
  }
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || '{}';
      const result = JSON.parse(text);
      return res.json(result);
    }

    // Fallback if Gemini key not set
    const lower = transcript.toLowerCase();
    const isShort = transcript.trim().split(/\s+/).length < 7;
    const hasMaterial = /wood|silk|clay|cotton|brass|చెక్క|పట్టు|మట్టి|ఇత్తడి|लकड़ी|रेशम|पीतल/.test(lower);
    const hasDimensions = /inch|cm|meter|size|kg|gram|అంగుళాలు|గ్రాములు|కిలో|इंच|ग्राम/.test(lower);

    const isComplete = !isShort && hasMaterial;
    const missing: string[] = [];
    if (!hasMaterial) missing.push('material');
    if (!hasDimensions) missing.push('dimensions');

    let followUp = '';
    if (!isComplete) {
      if (language === 'te') {
        followUp = 'నేను మీ వస్తువు వివరాలను విన్నాను. అయితే దీనికి ఉపయోగించిన మెటీరియల్ (చెక్క/వస్త్రం/లోహం) మరియు సుమారు పరిమాణం (సైజు) ఇంకా చెప్పలేదు. దయచేసి వివరించండి.';
      } else if (language === 'hi') {
        followUp = 'मैंने आपके उत्पाद का विवरण सुना। लेकिन आपने इसमें प्रयुक्त सामग्री और अनुमानित आकार अभी नहीं बताया है। कृपया स्पष्ट करें।';
      } else {
        followUp = 'I have noted the details so far. Could you please specify the exact materials used and approximate dimensions?';
      }
    }

    return res.json({
      isComplete,
      missingFields: missing,
      followUpQuestion: followUp,
      extractedData: {
        productName: transcript.slice(0, 40),
        category: 'Wooden Crafts',
        material: hasMaterial ? 'Authentic Natural Material' : 'Handmade Material',
        craftTechnique: 'Traditional Handcraft',
        dimensions: hasDimensions ? 'Standard handcrafted dimensions' : 'Approx 10-12 inches',
        weight: '500g',
        timeToMake: '3-5 days',
        features: ['100% Handmade', 'Artisanal Heritage'],
      },
    });
  } catch (err: any) {
    console.error('Error in /api/ai/extract-info:', err);
    res.status(500).json({ error: 'Failed to extract product information' });
  }
});

// 3. AI Professional Multilingual Product Description Generator
app.post('/api/ai/generate-description', validateBody(['productData', 'artisanLanguage', 'targetLanguage'], ['productData']), validateAIProductData, validateLanguage('artisanLanguage'), validateLanguage('targetLanguage'), async (req, res) => {
  try {
    const {
      productData,
      artisanLanguage = 'te',
      targetLanguage = 'en',
    } = req.body;

    const ai = getGemini();
    const sourceLangName = LANGUAGE_NAMES[artisanLanguage] || 'Telugu';
    const targetLangName = LANGUAGE_NAMES[targetLanguage] || 'English';

    if (ai) {
      const prompt = `
You are an expert e-commerce catalog specialist for Indian handmade artisanal products.
The artisan spoke in: ${sourceLangName}.
Generate a captivating, authentic, professional marketplace catalog listing for potential buyers in: ${targetLangName}.

Craft Details:
- Name: ${productData.productName || 'Handcrafted Artisan Item'}
- Category: ${productData.category || 'Handicrafts'}
- Material: ${productData.material || 'Natural Materials'}
- Craft Technique: ${productData.craftTechnique || 'Handmade'}
- Dimensions: ${productData.dimensions || 'Handcrafted standard'}
- Time to craft: ${productData.timeToMake || 'Handcrafted with care'}
- Features: ${(productData.features || []).join(', ')}

Please generate:
1. "title": A clear, high-converting product title (in ${targetLangName}).
2. "shortDescription": A 1-2 sentence compelling summary (in ${targetLangName}).
3. "fullDescription": A rich, evocative narrative describing the heritage, authentic materials, meticulous crafting process, and aesthetic appeal (in ${targetLangName}).

Output valid JSON only:
{
  "title": string,
  "shortDescription": string,
  "fullDescription": string
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const text = response.text?.trim() || '{}';
      return res.json(JSON.parse(text));
    }

    // Fallback description
    const title = `${productData.productName || 'Authentic Handcrafted Artisan Item'} (${targetLangName})`;
    const shortDesc = `Handmade using genuine ${productData.material || 'craft materials'} using centuries-old traditional techniques.`;
    const fullDesc = `This authentic handmade masterpiece is individually crafted by skilled artisans. Made with pure ${productData.material || 'natural materials'} through traditional methods, each piece carries distinct character, cultural heritage, and unmatched quality. Dimensions: ${productData.dimensions || 'Standard'}.`;

    return res.json({
      title,
      shortDescription: shortDesc,
      fullDescription: fullDesc,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/generate-description:', err);
    res.status(500).json({ error: 'Failed to generate product description' });
  }
});

// 4. AI Fair Craft Valuation & Pricing Recommendation
app.post('/api/ai/pricing-recommendation', validateBody(['productData', 'language'], ['productData']), validateAIProductData, validateLanguage('language'), async (req, res) => {
  try {
    const { productData, language = 'te' } = req.body;
    const ai = getGemini();
    const langName = LANGUAGE_NAMES[language] || 'Telugu';

    if (ai) {
      const prompt = `
You are Craft Mastery's AI Pricing Specialist. Your mission is to protect artisans from unfair exploitation while ensuring fair, competitive market pricing for buyers.

Craft Details:
- Name: ${productData.productName}
- Category: ${productData.category}
- Material: ${productData.material}
- Craft Technique: ${productData.craftTechnique}
- Dimensions: ${productData.dimensions}
- Time to craft: ${productData.timeToMake}

Calculate fair INR (₹) pricing:
- minPrice: Minimum fair wholesale/market boundary
- maxPrice: Maximum retail boundary
- suggestedPrice: Recommended sweet-spot listing price
- reasoning: A warm 1-2 sentence explanation in ${langName} explaining the rationale (considering raw material costs, handwork hours, rarity, and artisanal skill).

Return JSON only:
{
  "suggestedPriceMin": number,
  "suggestedPriceMax": number,
  "recommendedPrice": number,
  "pricingReason": string
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || '{}';
      return res.json(JSON.parse(text));
    }

    // Fallback calculation
    let base = 1200;
    if (/saree|textile|silk/i.test(productData.category || '')) base = 6500;
    if (/brass|metal/i.test(productData.category || '')) base = 2200;
    if (/pottery|clay/i.test(productData.category || '')) base = 950;

    let reason = 'క్రాఫ్ట్ మెటీరియల్ ఖర్చులు, చేతి శ్రమ మరియు మార్కెట్ డిమాండ్ ఆధారంగా AI సిఫార్సు చేసిన ధర.';
    if (language === 'hi') {
      reason = 'कच्चे माल की लागत, हस्तनिर्मित श्रम और बाजार मांग के आधार पर अनुशंसित मूल्य।';
    } else if (language === 'en') {
      reason = 'Calculated fairly on material quality, hours of handcrafting labor, and current marketplace benchmarks.';
    }

    return res.json({
      suggestedPriceMin: Math.round(base * 0.85),
      suggestedPriceMax: Math.round(base * 1.25),
      recommendedPrice: base,
      pricingReason: reason,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/pricing-recommendation:', err);
    res.status(500).json({ error: 'Failed to recommend pricing' });
  }
});

// 5. Two-Way Multilingual Translation (Customer <-> Artisan)
app.post('/api/ai/translate', validateBody(['text', 'fromLang', 'toLang'], ['text', 'fromLang', 'toLang']), validateString('text', 5000, true), validateLanguage('fromLang'), validateLanguage('toLang'), async (req, res) => {
  try {
    const { text, fromLang, toLang } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required for translation' });
    }

    if (fromLang === toLang) {
      return res.json({ translatedText: text, fromLang, toLang });
    }

    const ai = getGemini();
    const fromName = LANGUAGE_NAMES[fromLang] || fromLang;
    const toName = LANGUAGE_NAMES[toLang] || toLang;

    if (ai) {
      const prompt = `
You are a real-time diplomatic and natural multilingual translator for an Indian artisan marketplace.
Translate the following message faithfully from ${fromName} into ${toName}.
Maintain cultural warmth, politeness, business negotiation clarity, and natural dialect tone.
Do not add meta commentary or quotes.

Source text:
"${text}"

Translated text (${toName}):
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          temperature: 0.1,
        },
      });

      const translated = response.text?.trim() || text;
      return res.json({ translatedText: translated, fromLang, toLang });
    }

    // Direct fallback dictionary for common inquiry patterns
    let fallback = text;
    if (toLang === 'te' && /100 pieces/i.test(text)) {
      fallback = 'నాకు 100 ముక్కలు కావాలి. హోల్‌సేల్ ధర మరియు డెలివరీ సమయం ఎంత?';
    } else if (toLang === 'en' && /100/i.test(text)) {
      fallback = 'I can craft and deliver 100 pieces at a discounted wholesale price. Please let me know your preferred deadline.';
    }

    return res.json({
      translatedText: fallback,
      fromLang,
      toLang,
      isFallback: true,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/translate:', err);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// 6. Customer Semantic Search & AI Query Understanding
app.post('/api/ai/customer-search', validateBody(['query', 'language'], ['query']), validateString('query', 1000, true), validateLanguage('language'), async (req, res) => {
  try {
    const { query, language = 'en' } = req.body;
    const ai = getGemini();

    if (ai && query) {
      const prompt = `
Analyze the customer's shopping query for an Indian handmade craft marketplace.
Query: "${query}"
Customer language: ${language}

Extract:
1. "category": Most relevant craft category (e.g. "Wooden Crafts", "Handloom Textiles", "Metal Crafts", "Pottery & Ceramics", "All")
2. "maxPrice": maximum budget mentioned in INR, or null
3. "keywords": array of descriptive keywords
4. "aiMessage": a short, friendly response in customer language (${language}) acknowledging what they are looking for and what was found.

Output JSON only:
{
  "category": string,
  "maxPrice": number | null,
  "keywords": string[],
  "aiMessage": string
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = response.text?.trim() || '{}';
      return res.json(JSON.parse(text));
    }

    // Default response
    return res.json({
      category: 'All',
      maxPrice: null,
      keywords: [query],
      aiMessage: `I found authentic handmade crafts matching "${query}". Select any item and tap ✨ Ask AI below for guidance!`,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/customer-search:', err);
    res.status(500).json({ error: 'Search analysis failed' });
  }
});

// 7. Customer "✨ Ask AI" Guidance for a Specific Product
app.post('/api/ai/order-guidance', validateBody(['question', 'product', 'language', 'productId', 'productTitle', 'intent', 'customQuestion'], ['language']), validateString('question', 2000), validateString('customQuestion', 2000), validateLanguage('language'), validateGuidanceProduct, async (req, res) => {
  try {
    const { language = 'en' } = req.body;
    const question = req.body.question || req.body.customQuestion || req.body.intent || 'How do I order?';
    const product = req.body.product || { title: req.body.productTitle };
    const ai = getGemini();
    const langName = LANGUAGE_NAMES[language] || 'English';

    if (ai) {
      const prompt = `
You are the interactive shopping assistant on Craft Mastery.
A customer is viewing this authentic handcrafted product:
- Title: ${product.title}
- Price: ₹${product.finalPrice}
- Material: ${product.material}
- Technique: ${product.craftTechnique}
- Time to craft: ${product.timeToMake}
- Region: ${product.region}
- Artisan: ${product.artisanName}

The customer asked in ${langName}:
"${question}"

Provide clear, helpful, trustworthy guidance in ${langName}.
If they ask "How do I order?":
Explain the simple verified flow:
1. Choose required quantity.
2. If bulk (e.g., 20+ or 100+ pieces), tap "Send Inquiry" to receive special wholesale artisan pricing.
3. Confirm delivery details; the artisan receives notification in their native language and confirms dispatch.

If they ask to contact the artisan or ask for 100 pieces:
Explain that clicking the "Contact Artisan / Bulk Order" button directly sends a translated message to the artisan.

Output JSON only:
{
  "answer": string,
  "suggestedAction": "ORDER" | "CONTACT_ARTISAN" | "NONE",
  "recommendedQuantity": number | null
}
`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      });

      const text = response.text?.trim() || '{}';
      const parsed = JSON.parse(text);
      return res.json({
        guidance: parsed.answer || parsed.guidance || 'Direct artisan assistance available.',
        ...parsed,
      });
    }

    let answer = `You can order "${product.title}" by choosing your quantity and clicking Contact Artisan. For bulk orders like 100 pieces, the artisan will offer wholesale rates.`;
    if (language === 'te') {
      answer = `మీరు ఈ "${product.title}" వస్తువును సులభంగా ఆర్డర్ చేయవచ్చు. మీకు 100 ముక్కలు లేదా బల్క్ ఆర్డర్ కావాలంటే "కళాకారుడిని సంప్రదించండి" బటన్ ద్వారా నేరుగా విచారణ పంపవచ్చు. కళాకారుడు ప్రత్యేక హోల్‌సేల్ ధరను అందిస్తారు.`;
    }

    return res.json({
      guidance: answer,
      answer,
      suggestedAction: 'CONTACT_ARTISAN',
      recommendedQuantity: 100,
    });
  } catch (err: any) {
    console.error('Error in /api/ai/order-guidance:', err);
    res.status(500).json({ error: 'Guidance failed' });
  }
});

// 8. Products CRUD
function serializeInquiry(inquiry: any, auth: NonNullable<Express.Request['auth']>) {
  if (auth.role === 'ADMIN') return inquiry;
  const { customerId, artisanId, ...safeInquiry } = inquiry;
  return safeInquiry;
}

app.get('/api/products', (req, res) => {
  const auth = req.auth!;
  res.json(visibleProductsFor(auth));
});

app.post('/api/products', requireRole('ARTISAN', 'ADMIN'), validateBody([...PRODUCT_FIELDS, 'id', 'artisanId', 'artisanPhone', 'artisanName', 'artisanLanguage', 'status', 'createdAt']), validateProductInput, (req, res) => {
  const auth = req.auth!;
  const profile = usersDb.find((user) => user.uid === auth.uid);
  const productId = `prod-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const newProduct = {
    ...req.body,
    id: productId,
    artisanId: auth.uid,
    artisanPhone: auth.phone,
    artisanName: profile?.name || 'Artisan Maker',
    createdAt: new Date().toISOString(),
    status: 'PUBLISHED',
  };
  try {
    const storedProduct = storeProductMedia(newProduct, auth.uid);
    productsDb.unshift(storedProduct);
    saveStoreToDisk();
    res.status(201).json({ product: hydrateProductMedia(storedProduct, auth) });
  } catch (err) {
    console.error('[Media] Product upload rejected:', err instanceof Error ? err.message : err);
    clientError(res, 400, 'Invalid product image');
  }
});