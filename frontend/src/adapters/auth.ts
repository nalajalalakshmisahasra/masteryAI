import { StorageAdapter, StoredAuthSession } from './storage';
import { ApiAdapter } from './api';
import {
  getAuth,
  getIdToken,
  getIdTokenResult,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
} from '@react-native-firebase/auth';

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
      token: `dev:${user.phone}`,
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
class NativeFirebaseProvider implements IAuthProvider {
  private readonly confirmations = new Map<string, { confirm(otp: string): Promise<any> }>();

  async sendOtp(phone: string): Promise<VerificationSession> {
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const confirmation = await signInWithPhoneNumber(getAuth(), `+91${cleanPhone}`);
    const verificationId = confirmation.verificationId;
    this.confirmations.set(verificationId, confirmation);
    return { verificationId, phoneNumber: cleanPhone, isDevelopmentMock: false };
  }

  async verifyOtp(
    verificationId: string,
    otp: string,
    _phone: string,
    name?: string,
  ): Promise<AuthUser> {
    const confirmation = this.confirmations.get(verificationId);
    if (!confirmation) throw new Error('OTP session not found. Please request a new code.');
    const result = await confirmation.confirm(otp);
    this.confirmations.delete(verificationId);
    const firebaseUser = result.user;
    const tokenResult = await getIdTokenResult(firebaseUser, true);
    const role = tokenResult.claims.role === 'ARTISAN' || tokenResult.claims.role === 'ADMIN'
      ? tokenResult.claims.role
      : 'CUSTOMER';
    const phone = (firebaseUser.phoneNumber || '').replace(/\D/g, '').slice(-10);
    const token = await getIdToken(firebaseUser);
    const existing = await StorageAdapter.getAuthSession();
    const user: AuthUser = {
      uid: firebaseUser.uid,
      phone,
      name: firebaseUser.displayName || name || existing?.name || 'Customer Buyer',
      role,
      completedOnboarding: existing?.completedOnboarding || false,
      token,
    };
    await StorageAdapter.setAuthSession(user);
    await ApiAdapter.saveUser({ name: user.name, onboardingComplete: user.completedOnboarding });
    return user;
  }

  async signOut(): Promise<void> {
    await firebaseSignOut(getAuth());
    await StorageAdapter.clearAuthSession();
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const firebaseUser = getAuth().currentUser;
    if (!firebaseUser) {
      await StorageAdapter.clearAuthSession();
      return null;
    }
    const tokenResult = await getIdTokenResult(firebaseUser);
    const role = tokenResult.claims.role === 'ARTISAN' || tokenResult.claims.role === 'ADMIN'
      ? tokenResult.claims.role
      : 'CUSTOMER';
    const token = await getIdToken(firebaseUser);
    const session = await StorageAdapter.getAuthSession();
    return {
      uid: firebaseUser.uid,
      phone: (firebaseUser.phoneNumber || '').replace(/\D/g, '').slice(-10),
      name: firebaseUser.displayName || session?.name || 'Customer Buyer',
      role,
      completedOnboarding: session?.completedOnboarding || false,
      token,
    };
  }
}

// Temporary prototype mode: use mock authentication.
// Firebase OTP is not required for testing the registration flow.
export const DEV_AUTH_ENABLED = true;

export const AuthAdapter: IAuthProvider = new DevAuthProvider();