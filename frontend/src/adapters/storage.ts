import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Mobile Storage Adapter
 *
 * Uses React Native AsyncStorage.
 * Stores authentication, profile information,
 * language and application settings.
 */

const STORAGE_KEYS = {
  LANGUAGE: 'craft_mastery_lang',
  AUTH: 'craft_mastery_auth',
  SPEECH_ENABLED: 'craft_mastery_speech_enabled',
  ONBOARDED_PREFIX: 'craft_mastery_onboarded_',
  HAS_SEEN_HERO: 'craft_mastery_has_seen_hero',
} as const;

export interface StoredAuthSession {
  role: 'ARTISAN' | 'CUSTOMER' | 'ADMIN';

  phone: string;

  name: string;

  email?: string;

  location?: string;

  /**
   * Four digit PIN used by the development authentication flow.
   */
  pin?: string;

  completedOnboarding: boolean;

  token?: string;
}

export const StorageAdapter = {
  // =====================================================
  // GENERIC STORAGE
  // =====================================================

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
        `[StorageAdapter] Failed to get item "${key}":`,
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
        `[StorageAdapter] Failed to set item "${key}":`,
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
        `[StorageAdapter] Failed to remove item "${key}":`,
        err,
      );
    }
  },

  // =====================================================
  // LANGUAGE
  // =====================================================

  async getSelectedLanguage(): Promise<
    string | null
  > {
    return this.getItem<string>(
      STORAGE_KEYS.LANGUAGE,
    );
  },

  async setSelectedLanguage(
    langCode: string,
  ): Promise<void> {
    return this.setItem(
      STORAGE_KEYS.LANGUAGE,
      langCode,
    );
  },

  // =====================================================
  // AUTH SESSION
  // =====================================================

  async getAuthSession(): Promise<
    StoredAuthSession | null
  > {
    return this.getItem<StoredAuthSession>(
      STORAGE_KEYS.AUTH,
    );
  },

  async setAuthSession(
    session: StoredAuthSession,
  ): Promise<void> {
    return this.setItem(
      STORAGE_KEYS.AUTH,
      session,
    );
  },

  async clearAuthSession(): Promise<void> {
    await this.removeItem(
      STORAGE_KEYS.AUTH,
    );

    // removeItem() swallows AsyncStorage errors and only
    // console.warns, so verify the key is actually gone.
    // If it isn't, throw so callers (AuthAdapter.signOut)
    // find out the session was NOT cleared, instead of
    // silently thinking sign-out succeeded.
    const stillPresent =
      await this.getAuthSession();

    if (stillPresent) {
      throw new Error(
        'Failed to clear auth session from storage.',
      );
    }
  },

  // =====================================================
  // PROFILE
  // =====================================================

  async updateAuthSession(
    updates: Partial<StoredAuthSession>,
  ): Promise<StoredAuthSession | null> {
    const current =
      await this.getAuthSession();

    if (!current) {
      return null;
    }

    const updated: StoredAuthSession = {
      ...current,
      ...updates,
    };

    await this.setAuthSession(updated);

    return updated;
  },

  async getProfile(): Promise<{
    name: string;
    phone: string;
    email: string;
    location: string;
    pin: string;
  } | null> {
    const session =
      await this.getAuthSession();

    if (!session) {
      return null;
    }

    return {
      name: session.name || '',
      phone: session.phone || '',
      email: session.email || '',
      location:
        session.location ||
        'Andhra Pradesh, India',
      pin: session.pin || '',
    };
  },

  async updateProfile(
    data: {
      name?: string;
      email?: string;
      location?: string;
    },
  ): Promise<StoredAuthSession | null> {
    return this.updateAuthSession({
      ...(data.name !== undefined
        ? { name: data.name }
        : {}),

      ...(data.email !== undefined
        ? { email: data.email }
        : {}),

      ...(data.location !== undefined
        ? { location: data.location }
        : {}),
    });
  },

  // =====================================================
  // PIN
  // =====================================================

  async getPin(): Promise<string | null> {
    const session =
      await this.getAuthSession();

    return session?.pin || null;
  },

  async setPin(
    pin: string,
  ): Promise<boolean> {
    if (!/^\d{4}$/.test(pin)) {
      return false;
    }

    const session =
      await this.getAuthSession();

    if (!session) {
      return false;
    }

    await this.setAuthSession({
      ...session,
      pin,
    });

    return true;
  },

  async verifyPin(
    pin: string,
  ): Promise<boolean> {
    const savedPin =
      await this.getPin();

    if (!savedPin) {
      return false;
    }

    return savedPin === pin;
  },

  // =====================================================
  // ONBOARDING
  // =====================================================

  async isOnboarded(
    phone: string,
  ): Promise<boolean> {
    const res =
      await this.getItem<string>(
        `${STORAGE_KEYS.ONBOARDED_PREFIX}${phone}`,
      );

    return res === 'true';
  },

  async setOnboarded(
    phone: string,
  ): Promise<void> {
    return this.setItem(
      `${STORAGE_KEYS.ONBOARDED_PREFIX}${phone}`,
      'true',
    );
  },

  // =====================================================
  // SPEECH
  // =====================================================

  async isSpeechEnabled(): Promise<boolean> {
    const val =
      await this.getItem<string>(
        STORAGE_KEYS.SPEECH_ENABLED,
      );

    return val === null
      ? true
      : val === 'true';
  },

  async setSpeechEnabled(
    enabled: boolean,
  ): Promise<void> {
    return this.setItem(
      STORAGE_KEYS.SPEECH_ENABLED,
      enabled ? 'true' : 'false',
    );
  },

  // =====================================================
  // HERO
  // =====================================================

  async hasSeenHero(): Promise<boolean> {
    const val =
      await this.getItem<string>(
        STORAGE_KEYS.HAS_SEEN_HERO,
      );

    return val === 'true';
  },

  async setHasSeenHero(
    seen: boolean = true,
  ): Promise<void> {
    return this.setItem(
      STORAGE_KEYS.HAS_SEEN_HERO,
      seen ? 'true' : 'false',
    );
  },
};