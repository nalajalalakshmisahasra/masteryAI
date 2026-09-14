import AsyncStorage from '@react-native-async-storage/async-storage';

import { StorageAdapter } from './storage';
import { ApiAdapter } from './api';

export type AppLanguage =
  | 'en'
  | 'te'
  | 'hi'
  | 'ta'
  | 'kn'
  | 'mr'
  | 'bn'
  | 'ml'
  | 'gu'
  | 'pa'
  | 'or'
  | 'as'
  | 'ur';

export interface AuthLocation {
  displayName: string;
  village?: string;
  district?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
}

export interface AuthUser {
  uid: string;
  phone: string;
  name: string;
  language?: AppLanguage;
  location?: AuthLocation;
  role: 'ARTISAN' | 'CUSTOMER' | 'ADMIN';
  completedOnboarding: boolean;
  token?: string;
}

export interface IAuthProvider {
  register(
    name: string,
    phone: string,
    pin: string,
    role?: 'ARTISAN' | 'CUSTOMER',
    language?: AppLanguage,
    location?: AuthLocation,
  ): Promise<AuthUser>;

  login(phone: string, pin: string): Promise<AuthUser>;

  signOut(): Promise<void>;

  getCurrentUser(): Promise<AuthUser | null>;
}

interface RegisteredAccount {
  name: string;
  phone: string;
  pin: string;
  role: 'ARTISAN' | 'CUSTOMER';
  language: AppLanguage;
  location?: AuthLocation;
}

interface DevAccount extends RegisteredAccount {}

const REGISTERED_ACCOUNTS_KEY =
  'craft_mastery_registered_accounts';

const DEV_ACCOUNTS: Record<string, DevAccount> = {
  '9848012345': {
    name: 'రామయ్య ఆచారి',
    phone: '9848012345',
    pin: '1234',
    role: 'ARTISAN',
    language: 'te',
    location: {
      displayName: 'Narsapur, West Godavari, Andhra Pradesh',
      district: 'West Godavari',
      state: 'Andhra Pradesh',
    },
  },

  '9820044556': {
    name: 'विक्रम शर्मा',
    phone: '9820044556',
    pin: '1234',
    role: 'CUSTOMER',
    language: 'hi',
  },
};

class DevAuthProvider implements IAuthProvider {
  private cleanPhone(phone: string): string {
    return phone.replace(/\D/g, '').slice(-10);
  }

  private async getRegisteredAccounts(): Promise<
    Record<string, RegisteredAccount>
  > {
    try {
      const raw = await AsyncStorage.getItem(
        REGISTERED_ACCOUNTS_KEY,
      );

      if (!raw) {
        return {};
      }

      return JSON.parse(raw);
    } catch (error) {
      console.warn(
        '[AuthAdapter] Could not read registered accounts:',
        error,
      );
      return {};
    }
  }

  private async saveRegisteredAccount(
    account: RegisteredAccount,
  ): Promise<void> {
    const accounts = await this.getRegisteredAccounts();

    accounts[account.phone] = account;

    await AsyncStorage.setItem(
      REGISTERED_ACCOUNTS_KEY,
      JSON.stringify(accounts),
    );
  }

  private async saveSession(user: AuthUser): Promise<void> {
    await StorageAdapter.setAuthSession({
      uid: user.uid,
      phone: user.phone,
      name: user.name,
      role: user.role,
      language: user.language,
      location: user.location,
      completedOnboarding: user.completedOnboarding,
      token: user.token,
    });
  }

  async register(
    name: string,
    phone: string,
    pin: string,
    role: 'ARTISAN' | 'CUSTOMER' = 'ARTISAN',
    language: AppLanguage = 'en',
    location?: AuthLocation,
  ): Promise<AuthUser> {
    const cleanPhone = this.cleanPhone(phone);

    if (!name.trim()) {
      throw new Error('Please enter your name.');
    }

    if (cleanPhone.length !== 10) {
      throw new Error(
        'Please enter a valid 10-digit mobile number.',
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      throw new Error(
        'PIN must contain exactly 4 digits.',
      );
    }

    const existingDevAccount =
      DEV_ACCOUNTS[cleanPhone];

    if (existingDevAccount) {
      throw new Error(
        'This mobile number is already registered. Please login.',
      );
    }

    const registeredAccounts =
      await this.getRegisteredAccounts();

    if (registeredAccounts[cleanPhone]) {
      throw new Error(
        'This mobile number is already registered. Please login.',
      );
    }

    const account: RegisteredAccount = {
      name: name.trim(),
      phone: cleanPhone,
      pin,
      role,
      language,
      location,
    };

    // Persist the account separately from the current login session.
    await this.saveRegisteredAccount(account);

    const user: AuthUser = {
      uid: `dev-uid-${cleanPhone}`,
      phone: cleanPhone,
      name: account.name,
      language: account.language,
      location: account.location,
      role: account.role,
      completedOnboarding: true,
      token: `dev:${cleanPhone}`,
    };

    await this.saveSession(user);

    // Backend sync remains best-effort for the prototype.
    ApiAdapter.saveUser({
      phone: user.phone,
      name: user.name,
      role: user.role,
      onboardingComplete: user.completedOnboarding,
    }).catch((err) => {
      console.warn(
        '[AuthAdapter] Backend sync note:',
        err,
      );
    });

    return user;
  }

  async login(
    phone: string,
    pin: string,
  ): Promise<AuthUser> {
    const cleanPhone = this.cleanPhone(phone);

    if (cleanPhone.length !== 10) {
      throw new Error(
        'Please enter a valid 10-digit mobile number.',
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      throw new Error(
        'Please enter your 4-digit PIN.',
      );
    }

    // First check built-in demo accounts.
    const devAccount = DEV_ACCOUNTS[cleanPhone];

    if (devAccount) {
      if (devAccount.pin !== pin) {
        throw new Error('Incorrect PIN.');
      }

      const user: AuthUser = {
        uid: `dev-uid-${cleanPhone}`,
        phone: devAccount.phone,
        name: devAccount.name,
        language: devAccount.language,
        location: devAccount.location,
        role: devAccount.role,
        completedOnboarding: true,
        token: `dev:${cleanPhone}`,
      };

      await this.saveSession(user);
      return user;
    }

    // Then check accounts that were actually registered in this app.
    const registeredAccounts =
      await this.getRegisteredAccounts();

    const account = registeredAccounts[cleanPhone];

    // IMPORTANT: do not create an account during login.
    if (!account) {
      throw new Error(
        'Account not found. Please register first.',
      );
    }

    if (account.pin !== pin) {
      throw new Error('Incorrect PIN.');
    }

    const user: AuthUser = {
      uid: `dev-uid-${cleanPhone}`,
      phone: account.phone,
      name: account.name,
      language: account.language,
      location: account.location,
      role: account.role,
      completedOnboarding: true,
      token: `dev:${cleanPhone}`,
    };

    await this.saveSession(user);

    return user;
  }

  async signOut(): Promise<void> {
    // Only clear the active session.
    // Registered accounts stay saved so the user can login again.
    await StorageAdapter.clearAuthSession();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const session =
      await StorageAdapter.getAuthSession();

    if (!session) {
      return null;
    }

    return {
      uid:
        session.uid ||
        `uid-${session.phone}`,
      phone: session.phone,
      name: session.name,
      language: session.language as
        | AppLanguage
        | undefined,
      location: session.location,
      role: session.role,
      completedOnboarding:
        session.completedOnboarding,
      token: session.token,
    };
  }
}

export const DEV_AUTH_ENABLED = true;

export const AuthAdapter: IAuthProvider =
  new DevAuthProvider();
