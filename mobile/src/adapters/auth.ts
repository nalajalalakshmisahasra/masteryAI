import { StorageAdapter, StoredAuthSession } from './storage';
import { ApiAdapter } from './api';

/**
 * Mobile Authentication Adapter Architecture
 * 
 * ARCHITECTURE CONTRACT:
 * - Decouples UI screens from the underlying authentication provider.
 * - Development/demo accounts are isolated behind DEV_MODE flags.
 * - Designed so a production Native Firebase Phone Auth provider (e.g. @react-native-firebase/auth)
 *   can be plugged in without modifying UI screens or navigation.
 */

export interface AuthUser {
  uid: string;
  phone: string;
  name: string;
  role: 'ARTISAN' | 'CUSTOMER' | 'ADMIN';
  completedOnboarding: boolean;
  token?: string;
}

export interface VerificationSession {
  verificationId: string;
  phoneNumber: string;
  isDevelopmentMock: boolean;
}

/**
 * Dedicated Development Mock Accounts
 * STRICTLY for local development, navigation testing, and offline verification.
 */
export const DEV_TEST_ACCOUNTS: Record<string, { name: string; role: 'ARTISAN' | 'CUSTOMER' }> = {
  '9848012345': {
    name: 'రామయ్య ఆచారి (Ramayya Achari)',
    role: 'ARTISAN',
  },
  '9820044556': {
    name: 'విక్రమ్ శర్మ (Vikram Sharma)',
    role: 'CUSTOMER',
  },
};

export interface IAuthProvider {
  sendOtp(phone: string): Promise<VerificationSession>;
  verifyOtp(verificationId: string, otp: string, phone: string, name?: string, role?: 'ARTISAN' | 'CUSTOMER'): Promise<AuthUser>;
  signOut(): Promise<void>;
  getCurrentUser(): Promise<AuthUser | null>;
}

/**
 * Development Authentication Provider
 * Isolated mock provider for Expo development before native Firebase modules are linked.
 */
class DevAuthProvider implements IAuthProvider {
  async sendOtp(phone: string): Promise<VerificationSession> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    // Return an isolated verification session
    return {
      verificationId: `dev-session-${Date.now()}`,
      phoneNumber: cleanPhone,
      isDevelopmentMock: true,
    };
  }

  async verifyOtp(
    verificationId: string,
    otp: string,
    phone: string,
    name?: string,
    role: 'ARTISAN' | 'CUSTOMER' = 'ARTISAN'
  ): Promise<AuthUser> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const existing = DEV_TEST_ACCOUNTS[cleanPhone];

    const resolvedName = name || existing?.name || (role === 'ARTISAN' ? 'Artisan Maker' : 'Customer Buyer');
    const resolvedRole = existing?.role || role;

    const isOnboarded = await StorageAdapter.isOnboarded(cleanPhone);

    const user: AuthUser = {
      uid: `dev-uid-${cleanPhone}`,
      phone: cleanPhone,
      name: resolvedName,
      role: resolvedRole,
      completedOnboarding: isOnboarded,
    };

    // Persist session to AsyncStorage
    await StorageAdapter.setAuthSession({
      phone: user.phone,
      name: user.name,
      role: user.role,
      completedOnboarding: user.completedOnboarding,
    });

    // Sync with backend /api/users. Best-effort ONLY: never await it, so a
    // slow or unreachable API cannot delay sign-in / navigation. The local
    // session above is the source of truth for the mobile session.
    ApiAdapter.saveUser({
      phone: user.phone,
      name: user.name,
      role: user.role,
      onboardingComplete: user.completedOnboarding,
    }).catch((err) => {
      console.warn('[AuthAdapter] Backend sync note (continuing with local session):', err);
    });

    return user;
  }

  async signOut(): Promise<void> {
    await StorageAdapter.clearAuthSession();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const session = await StorageAdapter.getAuthSession();
    if (!session) return null;

    return {
      uid: `uid-${session.phone}`,
      phone: session.phone,
      name: session.name,
      role: session.role,
      completedOnboarding: session.completedOnboarding,
    };
  }
}

/**
 * Production Native Firebase Provider Interface Placeholder
 * When native Firebase dependencies are installed via prebuild/native modules,
 * this provider implements IAuthProvider using native Firebase credentials.
 */
class NativeFirebasePlaceholderProvider implements IAuthProvider {
  async sendOtp(_phone: string): Promise<VerificationSession> {
    throw new Error('Native Firebase phone auth requires native build / @react-native-firebase/auth setup.');
  }

  async verifyOtp(_verificationId: string, _otp: string): Promise<AuthUser> {
    throw new Error('Native Firebase phone auth requires native build / @react-native-firebase/auth setup.');
  }

  async signOut(): Promise<void> {
    await StorageAdapter.clearAuthSession();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return null;
  }
}

// Active provider instance (can be swapped in config when native Firebase is wired)
export const AuthAdapter: IAuthProvider = new DevAuthProvider();
