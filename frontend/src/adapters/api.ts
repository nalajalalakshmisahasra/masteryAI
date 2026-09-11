import { NativeModules, Platform } from 'react-native';
import { StorageAdapter } from './storage';
import { getAuth, getIdToken } from '@react-native-firebase/auth';

/**
 * Mobile Native API Adapter
 * Connects to the Craft Mastery Express API backend.
 * Uses /api/v1/* which server.ts transparently handles.
 */

const DEFAULT_TIMEOUT_MS = 8000;
const AI_TIMEOUT_MS = 15000;
const GET_CACHE_TTL_MS = 30_000;

/** GET endpoints that are safe to cache briefly (collection data). */
const CACHEABLE_GETS = new Set(['/products', '/inquiries']);

interface RequestOptions extends RequestInit {
  /** Per-request timeout in ms (defaults to DEFAULT_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Bypass the short GET cache (used by pull-to-refresh / post-mutation refreshes). */
  forceRefresh?: boolean;
}

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

const getCache = new Map<string, CacheEntry>();

/**
 * Derive the development machine's LAN host from the Metro bundle URL.
 *
 * In Expo Go (development) the JS bundle is served from the dev computer,
 * e.g. http://192.168.29.92:8083/index.bundle?... — so the URL host is the
 * computer's LAN IP. This lets a physical phone reach the backend on the
 * same Wi-Fi with zero environment configuration, and it stays correct when
 * the LAN IP changes.
 *
 * Returns null outside development (bundled production builds load from
 * file:// or assets://), where EXPO_PUBLIC_API_BASE_URL must be used.
 */
function getDevHostFromScriptUrl(): string | null {
  try {
    const scriptURL = (NativeModules as any).SourceCode?.scriptURL;
    if (typeof scriptURL !== 'string') return null;
    const match = /^https?:\/\/([^/:]+)/.exec(scriptURL);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Base URL priority:
 *   1. EXPO_PUBLIC_API_BASE_URL env override (explicit, highest priority)
 *   2. Development LAN host derived from the Metro/script URL (physical devices)
 *   3. Emulator / simulator loopback defaults (last resort only)
 */
function getDefaultApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  const devHost = getDevHostFromScriptUrl();
  if (devHost) {
    return `http://${devHost}:3000/api/v1`;
  }
  return Platform.OS === 'android' ? 'http://10.0.2.2:3000/api/v1' : 'http://localhost:3000/api/v1';
}

export const API_BASE_URL = getDefaultApiBaseUrl();

/** Resolves an auth token, preferring a signed-in Firebase user but
 *  falling back to the stored session (dev mock auth, or platforms
 *  like web where @react-native-firebase has no native module). */
async function getAuthToken(): Promise<string | undefined> {
  const session = await StorageAdapter.getAuthSession();
  try {
    const firebaseUser = getAuth().currentUser;
    if (firebaseUser) {
      return await getIdToken(firebaseUser);
    }
  } catch (err) {
    // No native Firebase app (dev/mock mode, or running on web) — ignore
    // and fall back to the session token below.
  }
  return session?.token;
}

/** A mutation invalidates its related cached GET collection so refreshes are never stale. */
function invalidateGetCache(endpoint: string): void {
  if (endpoint.startsWith('/products')) getCache.delete('GET:/products');
  if (endpoint.startsWith('/inquiries')) getCache.delete('GET:/inquiries');
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, forceRefresh = false, ...init } = options;
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const method = init.method || 'GET';

  // Short-lived GET dedup/cache for collection data (products, inquiries).
  const cacheKey = `${method}:${endpoint}`;
  if (method === 'GET' && !forceRefresh && CACHEABLE_GETS.has(endpoint)) {
    const cached = getCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
  }

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const token = await getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error [${response.status}] ${response.statusText}: ${errorText}`);
    }

    const json = (await response.json()) as T;

    if (method === 'GET' && CACHEABLE_GETS.has(endpoint)) {
      getCache.set(cacheKey, { expiresAt: Date.now() + GET_CACHE_TTL_MS, value: json });
    }
    return json;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(
        `Request timed out after ${timeoutMs}ms — could not reach the API at ${API_BASE_URL}. ` +
          `Is the Craft Mastery backend running and reachable on this network?`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export const ApiAdapter = {
  // System Health
  async checkHealth(): Promise<{ status: string; service: string; hasGeminiKey: boolean }> {
    return request('/health');
  },

  async getServicesStatus(): Promise<any> {
    return request('/services/status');
  },

  // Products
  async getProducts(forceRefresh = false): Promise<any[]> {
    const data = await request<any>('/products', { forceRefresh });
    return Array.isArray(data) ? data : data?.products || [];
  },

  async createProduct(product: any): Promise<any> {
    return request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  },

  // Inquiries & Messages
  async getInquiries(forceRefresh = false): Promise<any[]> {
    const data = await request<any>('/inquiries', { forceRefresh });
    return Array.isArray(data) ? data : data?.inquiries || [];
  },

  async createInquiry(inquiry: any): Promise<any> {
    return request('/inquiries', {
      method: 'POST',
      body: JSON.stringify(inquiry),
    });
  },

  async replyToInquiry(inquiryId: string, replyData: {
    senderRole: string;
    senderName: string;
    originalText: string;
    originalLang: string;
  }): Promise<any> {
    return request(`/inquiries/${inquiryId}/reply`, {
      method: 'POST',
      body: JSON.stringify(replyData),
    });
  },

  // Users & Profiles
  async getUser(phone: string): Promise<any> {
    return request(`/users/${phone}`);
  },

  async saveUser(userData: any): Promise<any> {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  // Speech-to-Text
  async transcribeAudio(
    audioUri: string,
    language: string
  ): Promise<{ transcript: string; language?: string }> {
    try {
      const formData = new FormData();

      formData.append(
        'audio',
        {
          uri: audioUri,
          name: 'voice-note.m4a',
          type: 'audio/m4a',
        } as any
      );

      formData.append('language', language);

      const token = await getAuthToken();

      console.log('Sending audio directly to backend...');
      console.log('API URL:', `${API_BASE_URL}/speech-to-text`);
      console.log('Has auth token:', !!token);

      const response = await fetch(
        `${API_BASE_URL}/speech-to-text`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          body: formData,
        }
      );

      const data = await response.json();

      console.log('Speech API response:', data);

      if (!response.ok) {
        throw new Error(
          data?.error ||
          `Speech-to-text request failed: ${response.status}`
        );
      }

      return data;
    } catch (error) {
      console.error('transcribeAudio error:', error);
      throw error;
    }
  },

  // AI Services (longer timeout — LLM calls can legitimately take >8s)
  async extractCraftInfo(transcript: string, language: string, conversationHistory: any[] = []): Promise<any> {
    return request('/ai/extract-info', {
      method: 'POST',
      timeoutMs: AI_TIMEOUT_MS,
      body: JSON.stringify({ transcript, language, conversationHistory }),
    });
  },

  async generateDescription(productData: any, artisanLanguage: string, targetLanguage: string): Promise<any> {
    return request('/ai/generate-description', {
      method: 'POST',
      timeoutMs: AI_TIMEOUT_MS,
      body: JSON.stringify({ productData, artisanLanguage, targetLanguage }),
    });
  },

  async getPricingRecommendation(productData: any, language: string): Promise<any> {
    return request('/ai/pricing-recommendation', {
      method: 'POST',
      timeoutMs: AI_TIMEOUT_MS,
      body: JSON.stringify({ productData, language }),
    });
  },

  async translateText(text: string, fromLang: string, toLang: string): Promise<{ translatedText: string; fromLang: string; toLang: string }> {
    return request('/ai/translate', {
      method: 'POST',
      timeoutMs: AI_TIMEOUT_MS,
      body: JSON.stringify({ text, fromLang, toLang }),
    });
  },

  async customerSearch(query: string, language: string): Promise<any> {
    return request('/ai/customer-search', {
      method: 'POST',
      timeoutMs: AI_TIMEOUT_MS,
      body: JSON.stringify({ query, language }),
    });
  },

  async getOrderGuidance(question: string, product: any, language: string): Promise<any> {
    return request('/ai/order-guidance', {
      method: 'POST',
      timeoutMs: AI_TIMEOUT_MS,
      body: JSON.stringify({ question, product, language }),
    });
  },
};