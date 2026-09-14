import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mobile Storage Adapter
 * Stores CraftMastery authentication and user preferences.
 */

const STORAGE_KEYS = {
  LANGUAGE: 'craft_mastery_lang',
  AUTH: 'craft_mastery_auth',
  SPEECH_ENABLED: 'craft_mastery_speech_enabled',
  ONBOARDED_PREFIX: 'craft_mastery_onboarded_',
  HAS_SEEN_HERO: 'craft_mastery_has_seen_hero',
} as const;

export interface StoredAuthLocation {
  displayName: string;
  village?: string;
  district?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

export interface StoredAuthSession {
  uid?: string;
  role: 'ARTISAN' | 'CUSTOMER' | 'ADMIN';
  phone: string;
  name: string;

  /**
   * Language selected by the user at the beginning.
   */
  language?: string;

  /**
   * Location selected during registration.
   */
  location?: StoredAuthLocation;

  completedOnboarding: boolean;
  token?: string;
}

export const StorageAdapter = {
  // -------------------------------------------------------
  // Generic storage
  // -------------------------------------------------------

  async getItem<T = string>(
    key: string,
  ): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);

      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as unknown as T;
      }
    } catch (err) {
      console.warn(
        `[StorageAdapter] Failed to get "${key}":`,
        err,
      );

      return null;
    }
  },

  async setItem<T = any>(
    key: string,
    value: T,
  ): Promise<void> {
    try {
      const serialized =
        typeof value === 'string'
          ? value
          : JSON.stringify(value);

      await AsyncStorage.setItem(
        key,
        serialized,
      );
    } catch (err) {
      console.warn(
        `[StorageAdapter] Failed to set "${key}":`,
        err,
      );
    }
  },

  async removeItem(
    key: string,
  ): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (err) {
      console.warn(
        `[StorageAdapter] Failed to remove "${key}":`,
        err,
      );
    }
  },

  // -------------------------------------------------------
  // Language
  // -------------------------------------------------------

  async getSelectedLanguage(): Promise<string | null> {
    return this.getItem<string>(
      STORAGE_KEYS.LANGUAGE,
    );
  },

  async setSelectedLanguage(
    langCode: string,
  ): Promise<void> {
    await this.setItem(
      STORAGE_KEYS.LANGUAGE,
      langCode,
    );
  },

  // -------------------------------------------------------
  // Authentication session
  // -------------------------------------------------------

  async getAuthSession(): Promise<StoredAuthSession | null> {
    return this.getItem<StoredAuthSession>(
      STORAGE_KEYS.AUTH,
    );
  },

  async setAuthSession(
    session: StoredAuthSession,
  ): Promise<void> {
    await this.setItem(
      STORAGE_KEYS.AUTH,
      session,
    );
  },

  async clearAuthSession(): Promise<void> {
    await this.removeItem(
      STORAGE_KEYS.AUTH,
    );
  },

  // -------------------------------------------------------
  // Onboarding
  // -------------------------------------------------------

  async isOnboarded(
    phone: string,
  ): Promise<boolean> {
    const value =
      await this.getItem<string>(
        `${STORAGE_KEYS.ONBOARDED_PREFIX}${phone}`,
      );

    return value === 'true';
  },

  async setOnboarded(
    phone: string,
  ): Promise<void> {
    await this.setItem(
      `${STORAGE_KEYS.ONBOARDED_PREFIX}${phone}`,
      'true',
    );
  },

  // -------------------------------------------------------
  // Speech
  // -------------------------------------------------------

  async isSpeechEnabled(): Promise<boolean> {
    const value =
      await this.getItem<string>(
        STORAGE_KEYS.SPEECH_ENABLED,
      );

    return value === null
      ? true
      : value === 'true';
  },

  async setSpeechEnabled(
    enabled: boolean,
  ): Promise<void> {
    await this.setItem(
      STORAGE_KEYS.SPEECH_ENABLED,
      enabled ? 'true' : 'false',
    );
  },

  // -------------------------------------------------------
  // Hero
  // -------------------------------------------------------

  async hasSeenHero(): Promise<boolean> {
    const value =
      await this.getItem<string>(
        STORAGE_KEYS.HAS_SEEN_HERO,
      );

    return value === 'true';
  },

  async setHasSeenHero(
    seen: boolean = true,
  ): Promise<void> {
    await this.setItem(
      STORAGE_KEYS.HAS_SEEN_HERO,
      seen ? 'true' : 'false',
    );
  },
};