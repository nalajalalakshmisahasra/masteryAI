import {
  NativeModules,
  Platform,
} from 'react-native';

import { StorageAdapter } from './storage';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';

/**
 * Mobile API Adapter
 *
 * Expo Go compatible.
 *
 * Authentication uses the local development
 * session stored by StorageAdapter.
 *
 * Voice architecture:
 *
 * Expo Audio Recorder
 *        ↓
 * Backend /speech-to-text
 *        ↓
 * Sarvam AI
 *        ↓
 * Transcript
 *        ↓
 * Gemini Assistant
 *        ↓
 * Expo Speech
 */

const DEFAULT_TIMEOUT_MS = 8000;

/**
 * AI requests may take longer than normal API requests.
 */
const AI_TIMEOUT_MS = 30000;

const GET_CACHE_TTL_MS = 30_000;

/**
 * GET endpoints safe for short cache
 */
const CACHEABLE_GETS = new Set([
  '/products',
  '/inquiries',
]);

interface RequestOptions extends RequestInit {
  /**
   * Request timeout
   */
  timeoutMs?: number;

  /**
   * Ignore cache
   */
  forceRefresh?: boolean;
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const getCache =
  new Map<string, CacheEntry>();

/**
 * Phone number of the account whose responses
 * are currently cached.
 *
 * GET caches (/products, /inquiries) are scoped
 * per authenticated user on the backend. Keying
 * the cache only by endpoint would leak one
 * account's scoped data to the next account
 * logged in on the same device, so the cache is
 * cleared whenever the session phone changes.
 */
let cacheOwnerPhone: string | null = null;

/**
 * Get computer LAN IP from Expo Metro URL.
 *
 * Example:
 *
 * Metro:
 * http://192.168.1.10:8081
 *
 * Backend:
 * http://192.168.1.10:3000
 */
function getDevHostFromScriptUrl(): string | null {
  try {
    const scriptURL =
      (NativeModules as any)
        .SourceCode?.scriptURL;

    if (
      typeof scriptURL !== 'string' ||
      !scriptURL.trim()
    ) {
      return null;
    }

    const match =
      /^(?:https?|exp|exps):\/\/([^/:]+)/i.exec(
        scriptURL.trim()
      );

    return match?.[1] || null;
  } catch {
    return null;
  }
}

/**
 * Normalize an API URL supplied through Expo
 * environment variables.
 *
 * Accepted:
 *
 * http://192.168.1.10:3000
 *
 * http://192.168.1.10:3000/api
 *
 * http://192.168.1.10:3000/api/v1
 *
 * https://api.example.com/api
 */
function normalizeApiBaseUrl(
  value: string
): string {
  const trimmed =
    value.trim().replace(/\/+$/, '');

  if (
    /\/api(?:\/v1)?$/i.test(trimmed)
  ) {
    return trimmed;
  }

  return `${trimmed}/api`;
}

/**
 * API Base URL
 *
 * Priority:
 *
 * 1. EXPO_PUBLIC_API_BASE_URL
 * 2. Expo Go / Metro LAN host
 * 3. Android emulator
 * 4. localhost
 *
 * IMPORTANT:
 *
 * If EXPO_PUBLIC_API_BASE_URL points to
 * localhost while using a physical phone,
 * automatically prefer the Metro LAN host.
 */
function getDefaultApiBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_BASE_URL;

  const devHost =
    getDevHostFromScriptUrl();

  /**
   * Physical device fix:
   *
   * If .env accidentally contains localhost,
   * use the computer's LAN IP from Expo Metro.
   */
  if (
    configured?.trim()
  ) {
    const normalized =
      normalizeApiBaseUrl(configured);

    const isLocalhost =
      /\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i.test(
        normalized
      );

    if (
      isLocalhost &&
      devHost
    ) {
      return `http://${devHost}:3000/api`;
    }

    return normalized;
  }

  /**
   * Expo Go / physical device
   */
  if (devHost) {
    return `http://${devHost}:3000/api`;
  }

  /**
   * Android emulator
   */
  if (
    Platform.OS === 'android'
  ) {
    return 'http://10.0.2.2:3000/api';
  }

  /**
   * iOS simulator / fallback
   */
  return 'http://localhost:3000/api';
}

/**
 * Main API URL
 */
export const API_BASE_URL =
  getDefaultApiBaseUrl();

console.log(
  '[API] Base URL:',
  API_BASE_URL
);

/**
 * Get Authentication Token
 *
 * Uses the local development session.
 */
async function getAuthToken():
  Promise<string | undefined> {
  const session =
    await StorageAdapter
      .getAuthSession();

  /*
   * Normal authenticated session.
   */
  if (session?.token) {
    console.log(
      '[API AUTH] Using stored token:',
      session.token,
    );

    return session.token;
  }

  /*
   * Development fallback.
   *
   * The current backend accepts:
   *   dev:<10 digit phone>
   *
   * Older sessions may have been saved before the
   * token field was added. In that case derive the
   * development token from the stored phone number.
   */
  const phone = String(
    session?.phone || '',
  ).replace(/\D/g, '');

  if (/^\d{10}$/.test(phone)) {
    const devToken = `dev:${phone}`;

    console.log(
      '[API AUTH] Creating token from stored phone:',
      devToken,
    );

    try {
      if (session) {
        await StorageAdapter.setAuthSession({
          ...session,
          token: devToken,
        });
      }
    } catch (error) {
      console.warn(
        '[API AUTH] Could not save generated token:',
        error,
      );
    }

    return devToken;
  }

  /*
   * No authenticated session.
   *
   * IMPORTANT:
   * Never fall back to a fixed phone number such as
   * dev:9848012345. Doing that makes every unauthenticated
   * request look like the same development user.
   *
   * Public endpoints can still be called without a token.
   * Protected endpoints will correctly receive HTTP 401.
   */
  console.warn(
    '[API AUTH] No authenticated session/token found.',
  );

  return undefined;
}

/**
 * Clear related GET cache
 * after mutation.
 */
function invalidateGetCache(
  endpoint: string
): void {
  if (
    endpoint.startsWith(
      '/products'
    )
  ) {
    getCache.delete(
      'GET:/products'
    );
  }

  if (
    endpoint.startsWith(
      '/inquiries'
    )
  ) {
    getCache.delete(
      'GET:/inquiries'
    );
  }
}

/**
 * Main API request function
 */
async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    timeoutMs =
      DEFAULT_TIMEOUT_MS,

    forceRefresh =
      false,

    ...init
  } = options;

  const url =
    `${API_BASE_URL}${
      endpoint.startsWith('/')
        ? endpoint
        : `/${endpoint}`
    }`;

  const method =
    init.method ||
    'GET';

  /**
   * Cache GET requests
   *
   * Scoped responses differ per logged-in user,
   * so switch/clear the cache when the account
   * changes between requests.
   */
  const session =
    await StorageAdapter
      .getAuthSession();

  const sessionPhone =
    String(session?.phone || '') || null;

  if (
    sessionPhone !== cacheOwnerPhone
  ) {
    getCache.clear();

    cacheOwnerPhone =
      sessionPhone;
  }

  const cacheKey =
    `${method}:${endpoint}`;

  if (
    method === 'GET' &&
    !forceRefresh &&
    CACHEABLE_GETS.has(
      endpoint
    )
  ) {
    const cached =
      getCache.get(
        cacheKey
      );

    if (
      cached &&
      cached.expiresAt >
        Date.now()
    ) {
      return cached.value as T;
    }
  }

  /**
   * Detect FormData
   *
   * IMPORTANT:
   * Do not manually set Content-Type for
   * multipart FormData.
   *
   * The runtime adds the correct boundary.
   */
  const isFormData =
    typeof FormData !==
      'undefined' &&
    init.body instanceof
      FormData;

  /**
   * Headers
   */
  const headers:
    Record<string, string> = {
    Accept:
      'application/json',

    ...(
      (
        options.headers ||
        {}
      ) as Record<
        string,
        string
      >
    ),
  };

  /**
   * JSON requests
   */
  if (!isFormData) {
    headers[
      'Content-Type'
    ] =
      'application/json';
  }

  /**
   * Authentication
   */
  const token = await getAuthToken();

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  /**
   * Abort controller
   */
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  try {
    /**
     * Send request
     */
    const response =
      await fetch(
        url,
        {
          ...init,
          headers,
          signal:
            controller.signal,
        }
      );

    /**
     * API error
     */
    if (!response.ok) {
      const errorText =
        await response.text();

      throw new Error(
        `API Error ` +
        `[${response.status}] ` +
        `${response.statusText}: ` +
        errorText
      );
    }

    /**
     * Parse response
     */
    const json =
      (await response.json()) as T;

    /**
     * Save GET cache
     */
    if (
      method === 'GET' &&
      CACHEABLE_GETS.has(
        endpoint
      )
    ) {
      getCache.set(
        cacheKey,
        {
          expiresAt:
            Date.now() +
            GET_CACHE_TTL_MS,

          value:
            json,
        }
      );
    }

    /**
     * Invalidate cache
     */
    if (
      method !== 'GET'
    ) {
      invalidateGetCache(
        endpoint
      );
    }

    return json;

  } catch (err) {

    if (
      err instanceof Error &&
      err.name ===
        'AbortError'
    ) {
      throw new Error(
        `Request timed out after ` +
        `${timeoutMs}ms. ` +
        `Could not reach API at ` +
        `${API_BASE_URL}`
      );
    }

    throw err;

  } finally {
    clearTimeout(
      timer
    );
  }
}

/**
 * Craft Mastery API
 */
export const ApiAdapter = {

  // ---------------------------------
  // System Health
  // ---------------------------------

  async checkHealth():
    Promise<{
      status: string;
      service: string;
      hasGeminiKey: boolean;
    }> {

    return request(
      '/health'
    );
  },

  async getServicesStatus():
    Promise<any> {

    return request(
      '/services/status'
    );
  },

  // ---------------------------------
  // Products
  // ---------------------------------

  async getProducts(
    forceRefresh =
      false
  ): Promise<any[]> {

    const data =
      await request<any>(
        '/products',
        {
          forceRefresh,
        }
      );

    return Array.isArray(data)
      ? data
      : data?.products || [];
  },

  async createProduct(
    product: any
  ): Promise<any> {

    return request(
      '/products',
      {
        method:
          'POST',

        body:
          JSON.stringify(
            product
          ),
      }
    );
  },

  async deleteProduct(productId: string): Promise<any> {
    return request(`/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE',
    });
  },

  // ---------------------------------
  // Inquiries
  // ---------------------------------

  async getInquiries(
    forceRefresh =
      false
  ): Promise<any[]> {

    const data =
      await request<any>(
        '/inquiries',
        {
          forceRefresh,
        }
      );

    return Array.isArray(data)
      ? data
      : data?.inquiries || [];
  },

  async createInquiry(
    inquiry: any
  ): Promise<any> {

    return request(
      '/inquiries',
      {
        method:
          'POST',

        body:
          JSON.stringify(
            inquiry
          ),
      }
    );
  },

  async replyToInquiry(
    inquiryId: string,

    replyData: {
      senderRole: string;
      senderName: string;
      originalText: string;
      originalLang: string;
    }

  ): Promise<any> {

    return request(
      `/inquiries/${inquiryId}/reply`,
      {
        method:
          'POST',

        body:
          JSON.stringify(
            replyData
          ),
      }
    );
  },

  // ---------------------------------
  // Orders
  // ---------------------------------
  // Orders are stored as inquiry/order requests in the current backend.
  async getOrders(
    forceRefresh =
      false
  ): Promise<any[]> {
    return this.getInquiries(forceRefresh);
  },

  async updateOrderStatus(
    orderId: string,
    status: string
  ): Promise<any> {
    return request(
      `/inquiries/${encodeURIComponent(orderId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status,
        }),
      }
    );
  },

  // ---------------------------------
  // Users
  // ---------------------------------

  async getUser(
    phone: string
  ): Promise<any> {

    return request(
      `/users/${phone}`
    );
  },

  async saveUser(
    userData: any
  ): Promise<any> {

    return request(
      '/users',
      {
        method:
          'POST',

        body:
          JSON.stringify(
            userData
          ),
      }
    );
  },

  // ---------------------------------
  // Speech To Text
  // ---------------------------------

  /**
   * Upload recorded audio to backend.
   *
   * Backend:
   *
   * /api/speech-to-text
   *
   * or
   *
   * /api/public/speech-to-text
   *
   * Backend then sends the audio to Sarvam AI.
   */
    // ---------------------------------
  // Speech To Text - Groq Whisper
  // ---------------------------------

  // ---------------------------------
  // Speech To Text - Groq Whisper
  // ---------------------------------

  async transcribeAudio(
    audioUri: string,
    language: string,
  ): Promise<{
    transcript: string;
    language?: string;
    provider?: string;
  }> {
    try {
      if (!audioUri) {
        throw new Error(
          'No audio recording was created.',
        );
      }

      console.log(
        '[Groq Speech] Audio URI:',
        audioUri,
      );

      const formData = new FormData();

      /**
       * WEB
       *
       * expo-audio uses MediaRecorder on Web.
       * The returned URI is a blob: URL.
       *
       * DO NOT use:
       *
       * new File(audioUri)
       *
       * on Web.
       */
      if (
        Platform.OS === 'web'
      ) {
        console.log(
          '[Groq Speech] Web recording detected',
        );

        const audioResponse =
          await fetch(audioUri);

        if (!audioResponse.ok) {
          throw new Error(
            `Could not read recorded audio (${audioResponse.status})`,
          );
        }

        const audioBlob =
          await audioResponse.blob();

        if (
          !audioBlob ||
          audioBlob.size <= 0
        ) {
          throw new Error(
            'The recorded audio is empty.',
          );
        }

        console.log(
          '[Groq Speech] Web audio size:',
          audioBlob.size,
        );

        console.log(
          '[Groq Speech] Web audio type:',
          audioBlob.type,
        );

        formData.append(
          'audio',
          audioBlob,
          'voice-note.webm',
        );
      } else {
        /**
         * ANDROID / IOS
         *
         * Native Expo File API.
         */
        const file =
          new File(audioUri);

        if (!file.exists) {
          throw new Error(
            'The recorded audio file does not exist.',
          );
        }

        if (
          !file.size ||
          file.size <= 0
        ) {
          throw new Error(
            'The recorded audio file is empty.',
          );
        }

        console.log(
          '[Groq Speech] Native audio size:',
          file.size,
        );

        formData.append(
          'audio',
          file as any,
          file.name ||
            'voice-note.m4a',
        );
      }

      /**
       * Language selected by artisan.
       */
      formData.append(
        'language',
        language || 'en',
      );

      /**
       * Authentication token.
       */
      const token =
        await getAuthToken();

      /**
       * Authenticated users use:
       *
       * /api/speech-to-text
       *
       * Guests use:
       *
       * /api/public/speech-to-text
       */
      const endpoint =
        token
          ? `${API_BASE_URL}/speech-to-text`
          : `${API_BASE_URL}/public/speech-to-text`;

      console.log(
        '[Groq Speech] Sending audio to:',
        endpoint,
      );

      /**
       * IMPORTANT:
       *
       * Do NOT set Content-Type manually.
       * FormData creates the multipart boundary.
       */
      const response =
        await expoFetch(
          endpoint,
          {
            method: 'POST',

            headers: {
              Accept:
                'application/json',

              ...(token
                ? {
                    Authorization:
                      `Bearer ${token}`,
                  }
                : {}),
            },

            body: formData,
          },
        );

      const responseText =
        await response.text();

      console.log(
        '[Groq Speech] HTTP status:',
        response.status,
      );

      console.log(
        '[Groq Speech] Server response:',
        responseText,
      );

      let data: any = {};

      try {
        data =
          responseText
            ? JSON.parse(
                responseText,
              )
            : {};
      } catch {
        data = {
          error:
            responseText ||
            'Invalid server response',
        };
      }

      /**
       * Backend error.
       */
      if (!response.ok) {
        throw new Error(
          data?.error ||
          data?.message ||
          data?.details ||
          `Speech transcription failed (${response.status})`,
        );
      }

      /**
       * Extract transcript.
       */
      const transcript =
        typeof data?.transcript ===
        'string'
          ? data.transcript.trim()
          : '';

      if (!transcript) {
        throw new Error(
          'No speech was detected. Please speak clearly and try again.',
        );
      }

      console.log(
        '[Groq Speech] Transcript:',
        transcript,
      );

      return {
        transcript,

        language:
          data?.language ||
          language ||
          'en',

        provider:
          data?.provider ||
          'groq-whisper',
      };
    } catch (error: any) {
      console.error(
        '[Groq Speech] Transcription error:',
        error,
      );

      throw error instanceof Error
        ? error
        : new Error(
            String(
              error ||
              'Speech transcription failed',
            ),
          );
    }
  },

  // ---------------------------------
  // Global Voice Assistant
  // ---------------------------------

  /**
   * Send transcript to Gemini assistant.
   */
  async askVoiceAssistant(
    message: string,

    language: string,

    role: string =
      'GUEST',

    screen: string =
      'current screen'

  ): Promise<{
    answer: string;
    language: string;
  }> {

    return request(
      '/public/assistant',
      {
        method:
          'POST',

        timeoutMs:
          30_000,

        body:
          JSON.stringify({
            message,
            language,
            role,
            screen,
          }),
      }
    );
  },

  // ---------------------------------
  // AI Craft Photo Enhancement
  // ---------------------------------

  async enhanceCraftImage(
    imageDataUrl: string,

    language: string

  ): Promise<{
    enhancedImageDataUrl: string;
    provider: string;
  }> {

    return request(
      '/ai/enhance-image',
      {
        method:
          'POST',

        timeoutMs:
          60_000,

        body:
          JSON.stringify({
            imageDataUrl,
            language,
          }),
      }
    );
  },

  // ---------------------------------
  // AI Services
  // ---------------------------------

  async extractCraftInfo(
    transcript: string,

    language: string,

    conversationHistory:
      any[] = []

  ): Promise<any> {

    return request(
      '/ai/extract-info',
      {
        method:
          'POST',

        timeoutMs:
          AI_TIMEOUT_MS,

        body:
          JSON.stringify({
            transcript,
            language,
            conversationHistory,
          }),
      }
    );
  },

  async generateDescription(
    productData: any,

    artisanLanguage:
      string,

    targetLanguage:
      string

  ): Promise<any> {

    return request(
      '/ai/generate-description',
      {
        method:
          'POST',

        timeoutMs:
          AI_TIMEOUT_MS,

        body:
          JSON.stringify({
            productData,
            artisanLanguage,
            targetLanguage,
          }),
      }
    );
  },

  async getPricingRecommendation(
    productData: any,

    language: string

  ): Promise<any> {

    return request(
      '/ai/pricing-recommendation',
      {
        method:
          'POST',

        timeoutMs:
          AI_TIMEOUT_MS,

        body:
          JSON.stringify({
            productData,
            language,
          }),
      }
    );
  },

  async translateText(
    text: string,

    fromLang: string,

    toLang: string

  ): Promise<{
    translatedText: string;
    fromLang: string;
    toLang: string;
  }> {

    return request(
      '/ai/translate',
      {
        method:
          'POST',

        timeoutMs:
          AI_TIMEOUT_MS,

        body:
          JSON.stringify({
            text,
            fromLang,
            toLang,
          }),
      }
    );
  },

  async customerSearch(
    query: string,

    language: string

  ): Promise<any> {

    return request(
      '/ai/customer-search',
      {
        method:
          'POST',

        timeoutMs:
          AI_TIMEOUT_MS,

        body:
          JSON.stringify({
            query,
            language,
          }),
      }
    );
  },

  async getOrderGuidance(
    question: string,

    product: any,

    language: string

  ): Promise<any> {

    return request(
      '/ai/order-guidance',
      {
        method:
          'POST',

        timeoutMs:
          AI_TIMEOUT_MS,

        body:
          JSON.stringify({
            question,
            product,
            language,
          }),
      }
    );
  },
};