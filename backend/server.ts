import express from 'express';
import multer from 'multer';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { DeepgramClient } from '@deepgram/sdk';
import Groq, { toFile } from 'groq-sdk';
import { INITIAL_PRODUCTS, INITIAL_INQUIRIES } from './src/data/mockData.ts';
import { provisionRole, requireAuth, requireRole, samePhone } from './serverAuth.ts';

dotenv.config();

// Keep phone normalization local to this server file.
// This avoids requiring normalizePhone to be exported from serverAuth.ts.
function normalizePhone(phone: unknown): string {
  if (typeof phone !== 'string' && typeof phone !== 'number') return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}
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
// Photoroom Background Removal upload configuration
// -------------------------------------------------------------
const backgroundRemovalUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error('Only JPEG, PNG and WebP images are supported.'));
    }
    callback(null, true);
  },
});

// -------------------------------------------------------------
// Speech-to-Text (Deepgram) configuration
// -------------------------------------------------------------
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;
const PHOTOROOM_REMOVE_BACKGROUND_URL = 'https://sdk.photoroom.com/v1/segment';

const deepgram = DEEPGRAM_API_KEY
  ? new DeepgramClient({ apiKey: DEEPGRAM_API_KEY })
  : null;

// Groq Whisper is used for recorded/uploaded speech-to-text.
// Deepgram remains in place for the existing live WebSocket speech feature.
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const groq = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

/**
 * Convert the app language code to the ISO-639-1 code expected by Groq Whisper.
 */
const GROQ_LANGUAGE_CODES: Record<string, string> = {
  te: 'te', telugu: 'te',
  hi: 'hi', hindi: 'hi',
  en: 'en', english: 'en',
  ta: 'ta', tamil: 'ta',
  kn: 'kn', kannada: 'kn',
  mr: 'mr', marathi: 'mr',
  bn: 'bn', bengali: 'bn',
  ml: 'ml', malayalam: 'ml',
  gu: 'gu', gujarati: 'gu',
  pa: 'pa', punjabi: 'pa',
  ur: 'ur', urdu: 'ur',
  as: 'as', assamese: 'as',
  ne: 'ne', nepali: 'ne',
  or: 'or', odia: 'or',
};

function resolveGroqLanguageCode(requested: unknown): string | null {
  if (typeof requested !== 'string' || !requested.trim()) return 'en';
  const normalized = requested.trim().toLowerCase();
  if (normalized === 'unknown') return null;
  return GROQ_LANGUAGE_CODES[normalized]
    || GROQ_LANGUAGE_CODES[normalized.split('-')[0]]
    || null;
}

/**
 * Convert the short language codes used by the frontend into
 * language codes supported by Deepgram Nova-3.
 */
const DEEPGRAM_LANGUAGE_CODES: Record<string, string> = {
  te: 'te', telugu: 'te',
  hi: 'hi', hindi: 'hi',
  en: 'en-IN', english: 'en-IN',
  ta: 'ta', tamil: 'ta',
  kn: 'kn', kannada: 'kn',
  mr: 'mr', marathi: 'mr',
  bn: 'bn', bengali: 'bn',
  gu: 'gu', gujarati: 'gu',
  pa: 'pa', punjabi: 'pa',
  ur: 'ur', urdu: 'ur',
  as: 'as', assamese: 'as',
  ne: 'ne', nepali: 'ne',
};

function resolveDeepgramLanguageCode(requested: unknown): string | null {
  if (typeof requested !== 'string' || !requested.trim()) {
    return 'en-IN';
  }

  const normalized = requested.trim().toLowerCase();

  if (normalized === 'unknown') return null;

  // The frontend may already send a supported Deepgram language code.
  if (DEEPGRAM_LANGUAGE_CODES[normalized]) {
    return DEEPGRAM_LANGUAGE_CODES[normalized];
  }

  if (/^[a-z]{2,3}(?:-[a-z]{2,4})?$/i.test(normalized)) {
    const baseCode = normalized.split('-')[0];
    return DEEPGRAM_LANGUAGE_CODES[baseCode] || null;
  }

  return null;
}

const REQUEST_WINDOW_MS = 60_000;
const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_STRING_LENGTH = 5000;
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8081,http://127.0.0.1:8081,http://localhost:8082,http://localhost:19006')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

// -------------------------------------------------------------
// Live Speech WebSocket (Expo microphone -> backend -> Deepgram)
// -------------------------------------------------------------
const httpServer = http.createServer(app);
const wss = new WebSocketServer({
  server: httpServer,
  path: '/live-speech',
});

wss.on('connection', async (client, request) => {
  const origin = request.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    client.close(1008, 'Origin not allowed');
    return;
  }

  if (!deepgram) {
    client.send(JSON.stringify({
      type: 'error',
      error: 'Speech-to-text is not configured on the server (missing DEEPGRAM_API_KEY)',
    }));
    client.close(1011, 'Deepgram is not configured');
    return;
  }

  let deepgramConnection: any = null;
  let keepAliveTimer: NodeJS.Timeout | null = null;
  let configured = false;
  let closed = false;

  const sendToClient = (payload: Record<string, unknown>) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
    }
  };

  const cleanup = () => {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
    if (deepgramConnection) {
      try {
        deepgramConnection.socket?.send(JSON.stringify({ type: 'CloseStream' }));
      } catch {
        // The Deepgram socket may already be closed.
      }
      try {
        deepgramConnection.socket?.close();
      } catch {
        // Ignore already-closed sockets.
      }
      deepgramConnection = null;
    }
  };

  const startDeepgram = async (config: any) => {
    const languageCode = resolveDeepgramLanguageCode(config?.language);
    if (!languageCode) {
      sendToClient({
        type: 'error',
        error: 'The selected language is not supported by Deepgram Nova-3 speech-to-text',
      });
      client.close(1008, 'Unsupported language');
      return;
    }

    const sampleRate = Number(config?.sampleRate) || 16000;
    const channels = Number(config?.channels) || 1;

    if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 48000) {
      sendToClient({ type: 'error', error: 'Invalid microphone sample rate' });
      client.close(1008, 'Invalid sample rate');
      return;
    }

    if (!Number.isFinite(channels) || channels < 1 || channels > 2) {
      sendToClient({ type: 'error', error: 'Invalid microphone channel count' });
      client.close(1008, 'Invalid channel count');
      return;
    }

    deepgramConnection = await deepgram.listen.v1.connect({
      model: 'nova-3',
      language: languageCode,
      encoding: 'linear16',
      sample_rate: sampleRate,
      channels,
      smart_format: 'true',
      interim_results: 'true',
      punctuate: 'true',
      endpointing: 300,
      utterance_end_ms: 1000,
    } as any);

    deepgramConnection.on('open', () => {
      console.log(`[Deepgram Live] connected language=${languageCode} sampleRate=${sampleRate}`);
      sendToClient({ type: 'ready', language: languageCode });
    });

    deepgramConnection.on('message', (data: any) => {
      if (!data || closed) return;

      if (data.type === 'Results') {
        const transcript = data.channel?.alternatives?.[0]?.transcript || '';
        if (!transcript) return;

        sendToClient({
          type: 'transcript',
          transcript,
          isFinal: Boolean(data.is_final),
          speechFinal: Boolean(data.speech_final),
        });
        return;
      }

      if (data.type === 'SpeechStarted') {
        sendToClient({ type: 'speech-started' });
        return;
      }

      if (data.type === 'UtteranceEnd') {
        sendToClient({ type: 'utterance-end' });
      }
    });

    deepgramConnection.on('error', (error: any) => {
      console.error('[Deepgram Live] error:', error);
      sendToClient({
        type: 'error',
        error: 'Deepgram live transcription failed',
        details: process.env.NODE_ENV === 'development'
          ? error?.message || String(error)
          : undefined,
      });
    });

    deepgramConnection.on('close', () => {
      console.log('[Deepgram Live] connection closed');
      if (!closed) sendToClient({ type: 'deepgram-closed' });
    });

    deepgramConnection.connect();
    await deepgramConnection.waitForOpen();

    configured = true;
    keepAliveTimer = setInterval(() => {
      if (deepgramConnection?.socket?.readyState === 1) {
        try {
          deepgramConnection.socket.send(JSON.stringify({ type: 'KeepAlive' }));
        } catch {
          // Ignore keep-alive errors during shutdown.
        }
      }
    }, 8000);
  };

  client.on('message', async (data, isBinary) => {
    try {
      if (!configured) {
        if (isBinary) {
          sendToClient({ type: 'error', error: 'Live speech configuration must be sent before audio' });
          return;
        }

        const config = JSON.parse(data.toString());
        if (config?.type !== 'config') {
          sendToClient({ type: 'error', error: 'Invalid live speech configuration' });
          return;
        }

        await startDeepgram(config);
        return;
      }

      if (!deepgramConnection) return;

      if (!isBinary) {
        const message = JSON.parse(data.toString());

        if (message?.type === 'finalize') {
          deepgramConnection.socket?.send(JSON.stringify({ type: 'Finalize' }));
          return;
        }

        if (message?.type === 'close') {
          cleanup();
          client.close(1000, 'Speech session ended');
          return;
        }

        return;
      }

      const audioBuffer = Buffer.isBuffer(data)
        ? data
        : Buffer.from(data as ArrayBuffer);

      if (audioBuffer.length > 0) {
        deepgramConnection.sendMedia(audioBuffer);
      }
    } catch (error: any) {
      console.error('[Live Speech] message handling failed:', error);
      sendToClient({
        type: 'error',
        error: 'Unable to process live speech data',
        details: process.env.NODE_ENV === 'development'
          ? error?.message || String(error)
          : undefined,
      });
    }
  });

  client.on('close', () => {
    closed = true;
    cleanup();
    console.log('[Live Speech] client disconnected');
  });

  client.on('error', (error) => {
    console.error('[Live Speech] client socket error:', error);
    closed = true;
    cleanup();
  });
});

async function removeBackgroundWithPhotoroom(
  imageBuffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<Buffer> {
  if (!PHOTOROOM_API_KEY) {
    throw new Error('PHOTOROOM_API_KEY is not configured');
  }

  if (!imageBuffer.length) {
    throw new Error('Image buffer is empty');
  }

  const imageBlob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
  const formData = new FormData();
  formData.append('image_file', imageBlob, filename || 'image.jpg');

  const response = await fetch(PHOTOROOM_REMOVE_BACKGROUND_URL, {
    method: 'POST',
    headers: {
      'x-api-key': PHOTOROOM_API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Photoroom API error ${response.status}: ${errorText.slice(0, 1000)}`,
    );
  }

  const result = await response.arrayBuffer();
  return Buffer.from(result);
}

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
 const limit = route.startsWith('/api/ai/enhance-image')
  ? 12 * 1024 * 1024
  : route.startsWith('/api/ai/remove-background')
    ? 10 * 1024 * 1024
    : route.startsWith('/api/public/speech-to-text')
    ? 15 * 1024 * 1024
    : route.startsWith('/api/ai/')
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
    'originalImageUrl', 'enhancedImageUrl',
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
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
    console.log('[Gemini] Initializing Gemini client...');
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
const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';

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
const publicVoiceRateLimit = rateLimit('public-voice', 8);

/**
 * Shared speech-to-text implementation.
 * Kept independent from authentication so the global voice assistant works
 * before login as well as inside the artisan/buyer experience.
 */
async function handleSpeechToText(req: express.Request, res: express.Response) {
  try {
    if (!groq) {
      return clientError(
        res,
        500,
        'Speech-to-text is not configured on the server (missing GROQ_API_KEY)',
      );
    }

    const file = (req as any).file as {
      buffer: Buffer;
      size: number;
      mimetype?: string;
      originalname?: string;
    } | undefined;

    if (!file?.buffer?.length) {
      return clientError(res, 400, 'No audio file received');
    }

    const requestedLanguage = req.body?.language;
    const languageCode = resolveGroqLanguageCode(requestedLanguage);

    if (!languageCode) {
      return clientError(
        res,
        400,
        'The selected language is not supported by Groq Whisper speech-to-text',
      );
    }

    console.log(
      `[Groq] Transcribing ${file.originalname || 'audio'} ` +
      `(${file.mimetype || 'unknown'}) using language=${languageCode}`,
    );

    const result = await groq.audio.transcriptions.create({
      file: await toFile(
        file.buffer,
        file.originalname || 'audio.webm',
      ),
      model: 'whisper-large-v3-turbo',
      language: languageCode,
      response_format: 'json',
    });

    return res.json({
      success: true,
      transcript: result.text || '',
      language: languageCode,
      provider: 'groq-whisper',
    });
  } catch (err: any) {
    console.error('[Groq] transcription failed:', err);

    return res.status(502).json({
      error: 'Groq speech-to-text request failed',
      details:
        process.env.NODE_ENV === 'development'
          ? err?.message || String(err)
          : undefined,
    });
  }
}

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
      photoroom: Boolean(PHOTOROOM_API_KEY),
      firebase: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
      supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY),
      database: Boolean(process.env.DATABASE_URL),
      deepgram: Boolean(DEEPGRAM_API_KEY),
      groq: Boolean(GROQ_API_KEY),
    },
    endpoints: {
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000/api/v1',
      aiServiceUrl: process.env.EXPO_PUBLIC_AI_SERVICE_URL || 'http://localhost:8001',
    },
  });
});

// ---------------------------------------------------------------------------
// Public voice assistant endpoints.
// These must be registered before requireAuth so the assistant is available
// on language selection, login/register and onboarding screens.
// ---------------------------------------------------------------------------
app.post(
  '/api/public/speech-to-text',
  publicVoiceRateLimit,
  speechUpload.single('audio'),
  handleSpeechToText,
);

app.post(
  '/api/public/assistant',
  publicVoiceRateLimit,
  validateBody(['message', 'language', 'role', 'screen'], ['message', 'language']),
  validateString('message', 4000, true),
  validateLanguage('language'),
  async (req, res) => {
    const fallback: Record<string, string> = {
      te: 'నేను Craft Mastery గురించి సహాయం చేయగలను. మీ ప్రశ్నను మళ్లీ అడగండి.',
      hi: 'मैं Craft Mastery के बारे में आपकी मदद कर सकता हूँ। अपना सवाल फिर से पूछें।',
      ta: 'Craft Mastery பற்றி நான் உதவ முடியும். உங்கள் கேள்வியை மீண்டும் கேளுங்கள்.',
      kn: 'Craft Mastery ಬಗ್ಗೆ ನಾನು ಸಹಾಯ ಮಾಡಬಹುದು. ನಿಮ್ಮ ಪ್ರಶ್ನೆಯನ್ನು மீண்டும் ಕೇಳಿ.',
      mr: 'मी Craft Mastery बद्दल मदत करू शकतो. तुमचा प्रश्न पुन्हा विचारा.',
      bn: 'আমি Craft Mastery সম্পর্কে সাহায্য করতে পারি। আপনার প্রশ্নটি আবার করুন।',
      ml: 'Craft Mastery ഉപയോഗിക്കാൻ ഞാൻ സഹായിക്കാം. നിങ്ങളുടെ ചോദ്യം വീണ്ടും ചോദിക്കൂ.',
      gu: 'હું Craft Mastery વિશે મદદ કરી શકું છું. તમારો પ્રશ્ન ફરી પૂછો.',
      pa: 'ਮੈਂ Craft Mastery ਬਾਰੇ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ। ਆਪਣਾ ਸਵਾਲ ਦੁਬਾਰਾ ਪੁੱਛੋ।',
      ur: 'میں Craft Mastery کے بارے میں مدد کر سکتا ہوں۔ اپنا سوال دوبارہ پوچھیں۔',
      or: 'ମୁଁ Craft Mastery ବିଷୟରେ ସାହାଯ୍ୟ କରିପାରିବି। ଆପଣଙ୍କ ପ୍ରଶ୍ନ ପୁଣି ପଚାରନ୍ତୁ।',
      as: 'মই Craft Mastery সম্পৰ্কে সহায় কৰিব পাৰোঁ। আপোনাৰ প্ৰশ্নটো আকৌ সোধক।',
      en: 'I can help you with Craft Mastery. Please ask your question again.',
    };

    const language =
      typeof req.body?.language === 'string' &&
      SUPPORTED_LANGUAGES.has(req.body.language)
        ? req.body.language
        : 'en';

    const {
      message,
      role = 'GUEST',
      screen = 'current screen',
    } = req.body;

    const langName = LANGUAGE_NAMES[language] || 'English';

    const assistantSystemPrompt = `
You are the voice assistant inside the Craft Mastery mobile app.

Your job is to answer the user's ACTUAL question, not give a generic welcome message.

Current user role: ${role}
Current screen: ${screen}
User selected language: ${langName} (${language})

Craft Mastery app context:
- Artisans can create craft listings by selecting/taking a craft photo.
- The app can enhance the craft photo with AI.
- The app can generate craft/product information and descriptions.
- Artisans can add price, stock and product details.
- A completed AI craft draft can be uploaded to My Products.
- Artisans can view My Products, Messages and Profile.
- Buyers/customers can browse crafts, view craft details and send inquiries.
- The app supports multiple Indian languages and voice interaction.

Rules:
1. Directly answer what the user asked.
2. Give practical step-by-step instructions when the user asks "how".
3. If the question is unrelated to Craft Mastery, answer normally when possible.
4. Never invent that an action was completed.
5. Never ask for passwords, OTPs, Aadhaar numbers, bank details or other secrets.
6. Reply in the user's selected language.
7. Keep voice answers concise: normally 2-5 short sentences.
`;

    // Primary provider: Gemini.
    try {
      const ai = getGemini();

      if (ai) {
        const prompt = `${assistantSystemPrompt}

User said:
"${String(message).trim()}"

Answer the user's actual question now.`;

        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'text/plain',
            temperature: 0.3,
          },
        });

        const answer = response.text?.trim();

        if (answer) {
          return res.json({
            answer,
            language,
            provider: 'gemini',
          });
        }
      }
    } catch (err: any) {
      console.warn('[Assistant] Gemini failed; trying Groq fallback:', {
        message: err?.message || String(err),
        status: err?.status,
        code: err?.code,
      });
    }

    // Secondary provider: Groq.
    // This keeps the assistant conversational when Gemini quota/model/network
    // errors occur. GPT-OSS 20B is currently supported by Groq.
    try {
      if (groq) {
        const completion = await groq.chat.completions.create({
          model: 'openai/gpt-oss-20b',
          messages: [
            {
              role: 'system',
              content: assistantSystemPrompt,
            },
            {
              role: 'user',
              content: String(message).trim(),
            },
          ],
          temperature: 0.3,
          max_completion_tokens: 300,
        });

        const answer = completion.choices?.[0]?.message?.content?.trim();

        if (answer) {
          return res.json({
            answer,
            language,
            provider: 'groq',
          });
        }
      } else {
        console.warn('[Assistant] GROQ_API_KEY is not configured.');
      }
    } catch (err: any) {
      console.error('[Assistant] Groq fallback failed:', {
        message: err?.message || String(err),
        status: err?.status,
        code: err?.code,
      });
    }

    // Last-resort local response.
    return res.json({
      answer: fallback[language] || fallback.en,
      language,
      provider: 'local-fallback',
    });
  },
);


// All application data, AI, profile, and mutation routes require a verified identity.
app.use('/api', authRateLimit, requireAuth);
app.use('/api/ai', aiRateLimit);

// 1b. AI Background Removal (Photoroom)
app.post(
  '/api/ai/remove-background',
  requireRole('ARTISAN', 'ADMIN'),
  (req, res, next) => {
    backgroundRemovalUpload.single('image')(req, res, (uploadError: any) => {
      if (!uploadError) return next();

      console.error('[Photoroom] Upload rejected:', uploadError);

      if (uploadError instanceof multer.MulterError) {
        if (uploadError.code === 'LIMIT_FILE_SIZE') {
          return clientError(res, 413, 'Image exceeds the 8 MB upload limit.');
        }
        return clientError(res, 400, 'Invalid image upload.');
      }

      return clientError(
        res,
        400,
        uploadError?.message || 'Invalid image upload.',
      );
    });
  },
  async (req, res) => {
    try {
      if (!PHOTOROOM_API_KEY) {
        return clientError(
          res,
          503,
          'Photoroom is not configured. Add PHOTOROOM_API_KEY to backend/.env.',
        );
      }

      const file = (req as any).file as {
        buffer: Buffer;
        size: number;
        mimetype: string;
        originalname: string;
      } | undefined;

      if (!file?.buffer?.length) {
        return clientError(res, 400, 'Please upload an image using the image field.');
      }

      const detectedMime = imageSignature(file.buffer);
      const declaredMime = file.mimetype as
        | 'image/jpeg'
        | 'image/png'
        | 'image/webp';

      if (
        !detectedMime ||
        detectedMime !== declaredMime ||
        !isStructurallyValidImage(file.buffer, detectedMime)
      ) {
        return clientError(res, 400, 'The uploaded image is invalid or corrupted.');
      }

      const processedImage = await removeBackgroundWithPhotoroom(
        file.buffer,
        file.originalname || 'craft-image.jpg',
        file.mimetype,
      );

      if (!processedImage.length) {
        throw new Error('Photoroom returned an empty image');
      }

      const imageDataUrl =
        `data:image/png;base64,${processedImage.toString('base64')}`;

      return res.json({
        success: true,
        provider: 'photoroom',
        imageDataUrl,
      });
    } catch (err: any) {
      console.error('[Photoroom] Background removal failed:', err);

      return res.status(502).json({
        success: false,
        message: 'Photoroom image processing failed.',
        details:
          process.env.NODE_ENV === 'development'
            ? err?.message || String(err)
            : undefined,
      });
    }
  },
);

app.use('/api/products', mutationRateLimit);
app.use('/api/inquiries', mutationRateLimit);
app.use('/api/users', mutationRateLimit);

// -------------------------------------------------------------
// User profile endpoints
// -------------------------------------------------------------
// The mobile auth adapter syncs the authenticated user's profile
// through these routes. The phone/uid are always taken from the
// authenticated identity so one user cannot save another user's
// profile.
app.post('/api/users', (req, res) => {
  const auth = req.auth!;
  const body = req.body || {};

  const requestedPhone = normalizePhone(body.phone);
  if (requestedPhone && requestedPhone !== auth.phone) {
    return clientError(res, 403, 'You can only update your own profile');
  }

  const existingIndex = usersDb.findIndex(
    (user) => user.uid === auth.uid || samePhone(user.phone, auth.phone),
  );

  const existing = existingIndex >= 0 ? usersDb[existingIndex] : null;

  const profile = {
    ...(existing || {}),
    uid: auth.uid,
    phone: auth.phone,
    name: typeof body.name === 'string' && body.name.trim()
      ? body.name.trim().slice(0, 200)
      : existing?.name || 'Artisan Maker',
    email: typeof body.email === 'string'
      ? body.email.trim().slice(0, 200)
      : existing?.email || '',
    location: typeof body.location === 'string'
      ? body.location.trim().slice(0, 300)
      : existing?.location || '',
    role: auth.role,
    onboardingComplete: body.onboardingComplete !== undefined
      ? Boolean(body.onboardingComplete)
      : Boolean(existing?.onboardingComplete),
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    usersDb[existingIndex] = profile;
  } else {
    usersDb.push(profile);
  }

  saveStoreToDisk();
  return res.status(existingIndex >= 0 ? 200 : 201).json({ user: profile });
});

app.get('/api/users/:phone', (req, res) => {
  const auth = req.auth!;
  const phone = normalizePhone(req.params.phone);

  if (!phone) {
    return clientError(res, 400, 'Invalid phone number');
  }

  if (auth.role !== 'ADMIN' && phone !== auth.phone) {
    return clientError(res, 403, 'You can only view your own profile');
  }

  const user = usersDb.find(
    (item) => samePhone(item.phone, phone),
  );

  if (!user) {
    return clientError(res, 404, 'User not found');
  }

  return res.json({ user });
});

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

// 1a. Speech-to-Text Transcription (Groq Whisper)
app.post(
  '/api/speech-to-text',
  aiRateLimit,
  speechUpload.single('audio'),
  handleSpeechToText,
);

// 1b. AI Craft Photo Enhancement
app.post(
  '/api/ai/enhance-image',
  aiRateLimit,
  validateBody(['imageDataUrl', 'language'], ['imageDataUrl']),
  validateString('imageDataUrl', 12 * 1024 * 1024, true),
  validateLanguage('language'),
  async (req, res) => {
    try {
      const imageDataUrl = String(req.body.imageDataUrl || '');
      const language = String(req.body.language || 'en');

      const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl);
      if (!match) {
        return clientError(res, 400, 'Unsupported image format. Use JPEG, PNG or WebP.');
      }

      const [, mimeType, base64Data] = match;
      const imageBytes = Buffer.from(base64Data, 'base64');

      if (!imageBytes.length || imageBytes.length > MAX_IMAGE_BYTES) {
        return clientError(res, 413, 'Image exceeds the 8 MB limit.');
      }

      const actualMime = imageSignature(imageBytes);
      if (!actualMime || actualMime !== mimeType || !isStructurallyValidImage(imageBytes, actualMime)) {
        return clientError(res, 400, 'The uploaded image is invalid or corrupted.');
      }

      const ai = getGemini();
      if (!ai) {
        return res.json({
          enhancedImageDataUrl: imageDataUrl,
          provider: 'original-fallback',
        });
      }

      const prompt = `
Enhance this handmade craft product photograph for a professional marketplace listing.

STRICT PRESERVATION RULES:
- Keep the exact craft/product, shape, proportions, handmade details, patterns and material identity.
- Do not add new products, people, text, logos, decorations or props.
- Do not redesign or stylize the craft.
- Keep authentic colors; only correct poor exposure or white balance when necessary.
- Improve brightness, clarity, sharpness, natural contrast and distracting background appearance.
- Make it look like a clean, premium but realistic product photograph.
- Preserve the original camera composition as much as possible.
- The result must still look like the artisan's real handmade product, not a generated replacement.
- Output only the enhanced image.

The artisan's selected language is ${LANGUAGE_NAMES[language] || 'English'}.
`;

      const response = await ai.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['IMAGE'],
        },
      });

      const imagePart = response.candidates?.[0]?.content?.parts?.find(
        (part: any) => part?.inlineData?.data
      );

      const enhancedData = imagePart?.inlineData?.data;
      const enhancedMime = imagePart?.inlineData?.mimeType || 'image/png';

      if (!enhancedData) {
        console.warn('[ImageEnhance] Gemini returned no image; using original.');
        return res.json({
          enhancedImageDataUrl: imageDataUrl,
          provider: 'original-fallback',
        });
      }

      return res.json({
        enhancedImageDataUrl: `data:${enhancedMime};base64,${enhancedData}`,
        provider: GEMINI_IMAGE_MODEL,
      });
    } catch (err) {
      console.error('[ImageEnhance] enhancement failed:', err);
      return clientError(res, 502, 'AI image enhancement failed. Please try again.');
    }
  },
);

// 2. AI Product Information Extraction & Incomplete Info Detection
app.post(
  '/api/ai/extract-info',
  validateBody(
    ['transcript', 'language', 'conversationHistory'],
    ['transcript']
  ),
  validateString('transcript', 12000, true),
  validateLanguage('language'),
  validateConversationHistory,
  async (req, res) => {
    const {
      transcript,
      language = 'te',
      conversationHistory = [],
    } = req.body;

    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({
        error: 'Transcript is required',
      });
    }

    const langName =
      LANGUAGE_NAMES[language] || 'Telugu';

    /*
     * ---------------------------------------------------------
     * FALLBACK EXTRACTION
     * ---------------------------------------------------------
     *
     * This is used when Gemini is unavailable or quota is
     * exhausted. The product flow can continue instead of
     * returning HTTP 500.
     */
    // Extract explicit measurements/time directly from the artisan's words.
    // This is used both when Gemini is unavailable and when Gemini omits a
    // value that was actually present in the transcript.
    const extractExplicitCraftValues = (text: string) => {
      const source = String(text || '').replace(/\s+/g, ' ').trim();

      const weightMatch = source.match(
        /(?:weighs?|weight\s*(?:is|:)?|weighing)\s*(?:about|around|approximately|approx\.?|nearly)?\s*(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|g|grams?|grammes?)(?![a-z])/i,
      );

      const genericWeightMatch = source.match(
        /(?:about|around|approximately|approx\.?|nearly)?\s*(\d+(?:\.\d+)?)\s*(kg|kgs|kilograms?|g|grams?|grammes?)\s*(?:in\s+weight|weight)?/i,
      );

      const timeMatch = source.match(
        /(?:takes?|take|requires?|require|needs?|need)\s*(?:about|around|approximately|approx\.?|nearly)?\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)(?:\s+(?:to|for)\s+(?:make|craft|finish|complete|produce))?/i,
      );

      const genericTimeMatch = source.match(
        /(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?|days?|weeks?)\s*(?:to\s+(?:make|craft|finish|complete|produce))/i,
      );

      const dimensionMatch = source.match(
        /(?:approximately|approx\.?|about|around)?\s*(\d+(?:\.\d+)?)\s*(?:x|×)\s*(\d+(?:\.\d+)?)\s*(?:x|×)?\s*(\d+(?:\.\d+)?)?\s*(inches?|inch|cm|centimeters?|feet|ft|meters?|m)?/i,
      );

      const normalizedUnit = (value: string) => {
        const unit = value.toLowerCase();
        if (/^kg|kilogram/.test(unit)) return 'kg';
        if (/^g|gram/.test(unit)) return 'grams';
        if (/^min/.test(unit)) return 'minutes';
        if (/^h|hr/.test(unit)) return 'hours';
        if (/^d/.test(unit)) return 'days';
        if (/^w/.test(unit)) return 'weeks';
        return unit;
      };

      const weight = weightMatch
        ? `${weightMatch[1]} ${normalizedUnit(weightMatch[2])}`
        : genericWeightMatch
          ? `${genericWeightMatch[1]} ${normalizedUnit(genericWeightMatch[2])}`
          : '';

      const time = timeMatch
        ? `${timeMatch[1]} ${normalizedUnit(timeMatch[2])}`
        : genericTimeMatch
          ? `${genericTimeMatch[1]} ${normalizedUnit(genericTimeMatch[2])}`
          : '';

      const dimensions = dimensionMatch
        ? `${dimensionMatch[1]} × ${dimensionMatch[2]}${dimensionMatch[3] ? ` × ${dimensionMatch[3]}` : ''}${dimensionMatch[4] ? ` ${dimensionMatch[4]}` : ''}`
        : '';

      return { weight, timeToMake: time, dimensions };
    };

    const mergeExplicitCraftValues = (result: any) => {
      const explicit = extractExplicitCraftValues(transcript);
      const existing = result?.extractedData || {};
      const extractedData = {
        ...existing,
        ...(explicit.weight && (!existing.weight || /not\s+specified|unknown|unavailable/i.test(String(existing.weight)))
          ? { weight: explicit.weight }
          : {}),
        ...(explicit.timeToMake && (!existing.timeToMake || /not\s+specified|unknown|unavailable/i.test(String(existing.timeToMake)))
          ? { timeToMake: explicit.timeToMake }
          : {}),
        ...(explicit.dimensions && (!existing.dimensions || /not\s+specified|unknown|unavailable/i.test(String(existing.dimensions)))
          ? { dimensions: explicit.dimensions }
          : {}),
      };

      const missingFields = Array.isArray(result?.missingFields)
        ? result.missingFields.filter((field: unknown) => {
            const name = String(field).toLowerCase();
            if (explicit.weight && name.includes('weight')) return false;
            if (explicit.timeToMake && (name.includes('time') || name.includes('time-to-make'))) return false;
            if (explicit.dimensions && (name.includes('dimension') || name.includes('size'))) return false;
            return true;
          })
        : [];

      const hasMaterial = Boolean(String(extractedData.material || '').trim()) &&
        !/not\s+specified|unknown|unavailable/i.test(String(extractedData.material));
      const hasDimensions = Boolean(String(extractedData.dimensions || '').trim()) &&
        !/not\s+specified|unknown|unavailable/i.test(String(extractedData.dimensions));
      const hasTechnique = Boolean(String(extractedData.craftTechnique || '').trim()) &&
        !/not\s+specified|unknown|unavailable/i.test(String(extractedData.craftTechnique));

      const isComplete = hasMaterial && (hasDimensions || hasTechnique);

      return {
        ...result,
        isComplete,
        missingFields,
        followUpQuestion: isComplete ? '' : result?.followUpQuestion || '',
        extractedData,
      };
    };

    const fallbackExtraction = () => {
      const lower = transcript.toLowerCase();
      const explicit = extractExplicitCraftValues(transcript);

      const isShort = transcript.trim().split(/\s+/).length < 7;

      const hasMaterial =
        /wood|wooden|neem wood|silk|clay|cotton|brass|metal|leather|stone|pottery|bamboo|glass|jute|wool|చెక్క|వేప చెక్క|పట్టు|మట్టి|ఇత్తడి|లోహం|తోలు|వెదురు|लकड़ी|रेशम|पीतल|मिट्टी|बांस/.test(lower);

      const hasDimensions = Boolean(explicit.dimensions) ||
        /inch|inches|cm|meter|meters|size|feet|ft|అంగుళాలు|పరిమాణం|इंच|आकार/.test(lower);

      const hasTechnique =
        /handmade|hand made|handcrafted|carved|carving|hand-carved|woven|weaving|loom|painted|painting|casting|pottery|handloom|చేతితో|చెక్కడం|నేత|చిత్రం|हस्तनिर्मित|बुनाई|चित्रकारी/.test(lower);

      const isComplete =
        !isShort &&
        hasMaterial &&
        (hasDimensions || hasTechnique);

      const missing: string[] = [];
      if (!hasMaterial) missing.push('material');
      if (!hasDimensions && !hasTechnique) missing.push('dimensions');

      let followUp = '';
      if (!isComplete) {
        if (language === 'te') {
          followUp = 'మీ వస్తువు వివరాలను విన్నాను. ఉపయోగించిన మెటీరియల్ మరియు సుమారు పరిమాణం లేదా తయారీ విధానం గురించి మరికొంత వివరించండి.';
        } else if (language === 'hi') {
          followUp = 'मैंने आपके उत्पाद का विवरण समझ लिया है। कृपया उपयोग की गई सामग्री और अनुमानित आकार या बनाने की विधि के बारे में थोड़ा और बताएं।';
        } else {
          followUp = 'I have noted your product details. Please specify the material used and approximate dimensions or the handmade technique.';
        }
      }

      let category = 'Other';
      if (/wood|wooden|carved|చెక్క|लकड़ी/.test(lower)) category = 'Wooden Crafts';
      else if (/silk|cotton|saree|textile|handloom|woven|పట్టు|పత్తి|చీర|నేత|रेशम|कपड़ा/.test(lower)) category = 'Handloom Textiles';
      else if (/brass|metal|bell metal|ఇత్తడి|లోహం|पीतल|धातु/.test(lower)) category = 'Metal Crafts';
      else if (/clay|pottery|ceramic|మట్టి|కుండ|मिट्टी|मिट्टी के बर्तन/.test(lower)) category = 'Pottery & Ceramics';
      else if (/leather|తోలు|चमड़ा/.test(lower)) category = 'Leather Crafts';
      else if (/jewel|necklace|earring|ring|నగ|ఆభరణ|गहना|हार/.test(lower)) category = 'Jewelry';
      else if (/stone|రాయి|శిల్పం|पत्थर/.test(lower)) category = 'Stone Carving';
      else if (/painting|painted|చిత్రం|चित्र|पेंटिंग/.test(lower)) category = 'Paintings';

      return {
        isComplete,
        missingFields: missing,
        followUpQuestion: followUp,
        extractedData: {
          productName: transcript.trim().slice(0, 80),
          category,
          material: hasMaterial ? 'As described by artisan' : 'Not specified',
          craftTechnique: hasTechnique ? 'Traditional Handcraft' : 'Not specified',
          dimensions: explicit.dimensions || (hasDimensions ? 'As described by artisan' : 'Not specified'),
          weight: explicit.weight || 'Not specified',
          timeToMake: explicit.timeToMake || 'Not specified',
          features: ['100% Handmade', 'Artisanal Heritage'],
        },
      };
    };

    /*
     * ---------------------------------------------------------
     * TRY GEMINI
     * ---------------------------------------------------------
     */
    const ai = getGemini();

    if (ai) {
      try {
        const prompt = `
You are Craft Mastery's AI Craft Assistant.
An artisan has spoken or written about their handcrafted product.

Artisan's Native Language:
${langName} (Code: ${language})

Artisan's Current Statement:
"${transcript}"

Previous Conversation context:
${JSON.stringify(conversationHistory)}

YOUR TASKS:

1. Extract all identifiable craft details:

- productName: Name or description of craft
- category: One of [Wooden Crafts, Handloom Textiles, Metal Crafts, Pottery & Ceramics, Leather Crafts, Jewelry, Stone Carving, Paintings, Other]
- material: Materials used
- craftTechnique: Traditional technique used
- dimensions: Approximate size/height/width
- weight: Approximate weight
- timeToMake: Estimated time to craft one piece

IMPORTANT EXTRACTION RULES:
- If the artisan explicitly says a weight such as "250 grams", "0.5 kg", or "weighs around 250 grams", copy that value into weight exactly; do NOT return "Not specified".
- If the artisan explicitly says a duration such as "takes 2 days", "requires 5 hours", or "2 days to make", copy that value into timeToMake exactly; do NOT return "Not specified".
- If the artisan explicitly gives dimensions such as "8 inches long, 4 inches wide and 3 inches high", preserve those measurements in dimensions.
- Never replace an explicitly provided numeric value with a generic phrase such as "lightweight", "handcrafted time", or "not specified".
- features: Array of distinct handmade qualities

2. INCOMPLETE INFORMATION CHECK:

A complete listing requires at least:

- Name/Type of product
- Specific Material used
- Approximate Dimensions/Size OR Time to make OR handmade technique details

If vital details are missing:

- Set "isComplete": false
- List missing fields in "missingFields"
- Ask a polite follow-up question in the artisan's native language

If enough information is available:

- Set "isComplete": true
- Set "missingFields": []
- Set "followUpQuestion": ""

Respond ONLY with valid JSON:

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

        const response =
          await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: {
              responseMimeType:
                'application/json',
              temperature: 0.2,
            },
          });

        const text =
          response.text?.trim() || '{}';

        const result =
          JSON.parse(text);

        // Gemini can occasionally omit a value that is clearly present in
        // the transcript. Merge explicit artisan-provided values before
        // returning the result so real measurements are never lost.
        return res.json(mergeExplicitCraftValues(result));

      } catch (error: any) {

        console.error(
          '========== GEMINI EXTRACTION ERROR =========='
        );

        console.error(error);

        console.error(
          '=============================================='
        );

        /*
         * Gemini quota/rate-limit error.
         *
         * Instead of returning HTTP 500 and breaking
         * Add Product, use local fallback extraction.
         */
        const errorText =
          error?.message ||
          error?.toString?.() ||
          '';

        const isQuotaError =
          errorText.includes('429') ||
          errorText.includes(
            'RESOURCE_EXHAUSTED'
          ) ||
          errorText.includes(
            'quota'
          ) ||
          errorText.includes(
            'Quota exceeded'
          );

        if (isQuotaError) {

          console.warn(
            '[AI Extraction] Gemini quota exceeded. Using local fallback extraction.'
          );

          return res.json({
            ...fallbackExtraction(),

            aiFallback: true,

            message:
              'Gemini quota is temporarily unavailable. Product details were extracted using local fallback processing.',
          });
        }

        /*
         * For other Gemini errors, also use fallback
         * so the artisan can continue adding the product.
         */
        console.warn(
          '[AI Extraction] Gemini failed. Using fallback extraction.'
        );

        return res.json({
          ...fallbackExtraction(),

          aiFallback: true,

          message:
            'AI service is temporarily unavailable. Product details were extracted using fallback processing.',
        });
      }
    }

    /*
     * ---------------------------------------------------------
     * NO GEMINI KEY
     * ---------------------------------------------------------
     */
    console.warn(
      '[AI Extraction] Gemini API key is unavailable. Using fallback extraction.'
    );

    return res.json({
      ...fallbackExtraction(),

      aiFallback: true,

      message:
        'AI service is not configured. Product details were extracted using fallback processing.',
    });
  }
);

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

// Delete an artisan's own product and its stored image files.
app.delete('/api/products/:id', requireRole('ARTISAN', 'ADMIN'), validateParam('id', /^[-A-Za-z0-9_]+$/), (req, res) => {
  const auth = req.auth!;
  const productId = req.params.id;
  const index = productsDb.findIndex((product) => product.id === productId);

  if (index < 0) {
    return clientError(res, 404, 'Product not found');
  }

  const product = productsDb[index];
  const ownsProduct =
    auth.role === 'ADMIN' ||
    product.artisanId === auth.uid ||
    samePhone(product.artisanPhone, auth.phone);

  if (!ownsProduct) {
    return clientError(res, 403, 'You can only delete your own products');
  }

  const productFiles = filesDb.filter((file) => file.productId === productId);
  for (const file of productFiles) {
    removeStoredFile(file);
  }
  filesDb = filesDb.filter((file) => file.productId !== productId);

  productsDb.splice(index, 1);
  saveStoreToDisk();

  return res.json({ success: true, productId });
});

// 9. Inquiries & 2-way Messages CRUD
// MessagesScreen calls GET /api/inquiries when the artisan opens the inbox.
// This route was missing from the current server.ts, which caused:
//   Cannot GET /api/inquiries (404)
app.get('/api/inquiries', (req, res) => {
  const auth = req.auth!;
  const inquiries = visibleInquiriesFor(auth).map((inquiry) =>
    serializeInquiry(inquiry, auth)
  );
  return res.json(inquiries);
});

// Customer creates a new inquiry / bulk-order request.
app.post(
  '/api/inquiries',
  validateInquiryInput,
  (req, res) => {
    const auth = req.auth!;
    const body = req.body || {};
    const product = productsDb.find((item) => item.id === body.productId);

    if (!product) {
      return clientError(res, 404, 'Product not found');
    }

    const inquiry = {
      ...body,
      id: body.id || `inq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId: product.id,
      productTitle: body.productTitle || product.title || 'Handcrafted Product',
      productImage: body.productImage || product.enhancedImageUrl || product.originalImageUrl || '',
      artisanId: product.artisanId,
      artisanPhone: product.artisanPhone,
      artisanName: product.artisanName || 'Artisan Maker',
      customerId: auth.uid,
      customerName: body.customerName || 'Customer',
      customerPhone: auth.phone,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'PENDING',
      messages: Array.isArray(body.messages) ? body.messages : [],
    };

    inquiriesDb.unshift(inquiry);
    saveStoreToDisk();

    return res.status(201).json(serializeInquiry(inquiry, auth));
  },
);

// Artisan replies to a customer's inquiry.
// The frontend uses /api/inquiries/:id/reply.
app.post(
  '/api/inquiries/:id/reply',
  validateParam('id', /^[-A-Za-z0-9_]+$/),
  validateMessageInput,
  (req, res) => {
    const auth = req.auth!;
    const inquiry = inquiriesDb.find((item) => item.id === req.params.id);

    if (!inquiry) {
      return clientError(res, 404, 'Inquiry not found');
    }

    const visible = visibleInquiriesFor(auth).some((item) => item.id === inquiry.id);
    if (!visible) {
      return clientError(res, 403, 'You do not have access to this inquiry');
    }

    const originalText = String(req.body.originalText || req.body.text || '').trim();
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      inquiryId: inquiry.id,
      senderRole: req.body.senderRole || auth.role,
      senderName: req.body.senderName || inquiry.artisanName || 'Artisan Maker',
      originalText,
      originalLang: req.body.originalLang || 'en',
      // Keep the original text as the display fallback. A translation service
      // can populate translatedText later without changing this API contract.
      translatedText: req.body.translatedText || originalText,
      timestamp: new Date().toISOString(),
    };

    if (!Array.isArray(inquiry.messages)) inquiry.messages = [];
    inquiry.messages.push(message);
    inquiry.status = 'IN_PROGRESS';
    inquiry.updatedAt = new Date().toISOString();
    saveStoreToDisk();

    return res.status(201).json(serializeInquiry(inquiry, auth));
  },
);

// Artisan/Admin updates an order status. Orders are represented by inquiries
// in the current data model, so this updates the inquiry status in place.
app.patch(
  '/api/inquiries/:id/status',
  validateParam('id', /^[-A-Za-z0-9_]+$/),
  validateBody(['status'], ['status']),
  (req, res) => {
    const auth = req.auth!;
    const inquiry = inquiriesDb.find((item) => item.id === req.params.id);

    if (!inquiry) {
      return clientError(res, 404, 'Order request not found');
    }

    const visible = visibleInquiriesFor(auth).some((item) => item.id === inquiry.id);
    if (!visible) {
      return clientError(res, 403, 'You do not have access to this order');
    }

    const allowedStatuses = [
      'PENDING',
      'ACCEPTED',
      'REJECTED',
      'SHIPPED',
      'DELIVERED',
    ];

    const nextStatus = String(req.body.status || '').toUpperCase();

    if (!allowedStatuses.includes(nextStatus)) {
      return clientError(res, 400, 'Invalid order status');
    }

    inquiry.status = nextStatus;
    inquiry.updatedAt = new Date().toISOString();
    saveStoreToDisk();

    return res.json(serializeInquiry(inquiry, auth));
  },
);

// -------------------------------------------------------------
// Persistence
// -------------------------------------------------------------
// Restore products, inquiries, users and stored files saved by previous
// runs. Without this the store starts empty on every restart and real
// accounts see nothing (or only demo seed content).
loadStoreFromDisk();
reconcileStoredFiles();

// -------------------------------------------------------------
// Start the server
// -------------------------------------------------------------
// IMPORTANT: this was missing entirely before — every route above was
// defined but the HTTP server never bound to a port, so no request from
// any frontend (web or mobile) could ever reach this API. Most hosts
// (Render, Railway, Fly, etc.) inject the port to bind via process.env.PORT,
// so that must take priority over the hardcoded local dev PORT constant.
const listenPort = Number(process.env.PORT) || PORT;
httpServer.listen(listenPort, () => {
  console.log(`Craft Mastery API listening on port ${listenPort}`);
  console.log(`Live speech WebSocket available at ws://localhost:${listenPort}/live-speech`);
});