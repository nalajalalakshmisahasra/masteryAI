import { StorageAdapter } from './storage';
import { ApiAdapter } from './api';

/**
 * Mobile Authentication Adapter
 *
 * Development authentication for Expo Go.
 *
 * Authentication:
 * - Register: Name + Phone + 4-digit PIN + Role
 * - Login: Phone + 4-digit PIN
 * - No real OTP is required
 *
 * Development token:
 *   dev:<phone>
 *
 * Example:
 *   9848012345 -> dev:9848012345
 */

/* =========================================================
   USER TYPES
========================================================= */

export interface AuthUser {
  uid: string;
  phone: string;
  name: string;

  email?: string;

  location?: string;

  pin?: string;

  role: 'ARTISAN' | 'CUSTOMER' | 'ADMIN';

  completedOnboarding: boolean;

  token?: string;
}

/* =========================================================
   OTP TYPES
========================================================= */

export interface VerificationSession {
  verificationId: string;
  phoneNumber: string;
  isDevelopmentMock: boolean;
}

/* =========================================================
   DEMO ACCOUNTS
========================================================= */

export const DEV_TEST_ACCOUNTS: Record<
  string,
  {
    name: string;
    role: 'ARTISAN' | 'CUSTOMER';
    pin?: string;
  }
> = {
  '9848012345': {
    name: 'రామయ్య ఆచారి (Ramayya Achari)',
    role: 'ARTISAN',
    pin: '1234',
  },

  '9820044556': {
    name: 'విక్రమ్ శర్మ (Vikram Sharma)',
    role: 'CUSTOMER',
    pin: '1234',
  },
};

/* =========================================================
   AUTH PROVIDER INTERFACE
========================================================= */

export interface IAuthProvider {
  /**
   * Development OTP
   */
  sendOtp(
    phone: string,
  ): Promise<VerificationSession>;

  /**
   * Development OTP verification
   */
  verifyOtp(
    verificationId: string,
    otp: string,
    phone: string,
    name?: string,
    role?: 'ARTISAN' | 'CUSTOMER',
  ): Promise<AuthUser>;

  /**
   * Register with:
   * Name + Phone + PIN + Role
   */
  register(
    name: string,
    phone: string,
    pin: string,
    role: 'ARTISAN' | 'CUSTOMER',
    language?: string,
  ): Promise<AuthUser>;

  /**
   * Login with:
   * Phone + PIN
   */
  login(
    phone: string,
    pin: string,
  ): Promise<AuthUser>;

  /**
   * Logout
   */
  signOut(): Promise<void>;

  /**
   * Restore current session
   */
  getCurrentUser(): Promise<AuthUser | null>;
}

/* =========================================================
   DEVELOPMENT AUTH PROVIDER
========================================================= */

class DevAuthProvider
  implements IAuthProvider {

  /* =======================================================
     PHONE HELPERS
  ======================================================= */

  /**
   * Normalize phone number to last 10 digits.
   */
  private cleanPhone(phone: string): string {
    return String(phone || '')
      .replace(/\D/g, '')
      .slice(-10);
  }

  /**
   * Validate phone number.
   */
  private validatePhone(phone: string): void {
    if (!/^\d{10}$/.test(phone)) {
      throw new Error(
        'Please enter a valid 10-digit mobile number.',
      );
    }
  }

  /* =======================================================
     PIN HELPERS
  ======================================================= */

  /**
   * Validate 4-digit PIN.
   */
  private validatePin(pin: string): void {
    if (!/^\d{4}$/.test(pin)) {
      throw new Error(
        'PIN must contain exactly 4 digits.',
      );
    }
  }

  /* =======================================================
     OTP - DEVELOPMENT ONLY
  ======================================================= */

  /**
   * Create development OTP session.
   *
   * No real SMS is sent.
   */
  async sendOtp(
    phone: string,
  ): Promise<VerificationSession> {

    const cleanPhone =
      this.cleanPhone(phone);

    this.validatePhone(cleanPhone);

    return {
      verificationId:
        `dev-session-${Date.now()}`,

      phoneNumber:
        cleanPhone,

      isDevelopmentMock:
        true,
    };
  }

  /**
   * Verify development OTP.
   *
   * Any valid OTP with at least 4 characters
   * is accepted during development.
   */
  async verifyOtp(
    verificationId: string,
    otp: string,
    phone: string,
    name?: string,
    role: 'ARTISAN' | 'CUSTOMER' = 'ARTISAN',
  ): Promise<AuthUser> {

    const cleanPhone =
      this.cleanPhone(phone);

    this.validatePhone(cleanPhone);

    if (!verificationId) {
      throw new Error(
        'Verification session not found.',
      );
    }

    if (!otp || otp.length < 4) {
      throw new Error(
        'Please enter a valid OTP.',
      );
    }

    const existing =
      DEV_TEST_ACCOUNTS[cleanPhone];

    const resolvedName =
      name?.trim() ||
      existing?.name ||
      'Artisan Maker';

    const resolvedRole =
      existing?.role ||
      role;

    const previousSession =
      await StorageAdapter.getAuthSession();

    const isSameUser =
      previousSession?.phone === cleanPhone;

    const developmentToken =
      `dev:${cleanPhone}`;

    const user: AuthUser = {
      uid:
        `dev-uid-${cleanPhone}`,

      phone:
        cleanPhone,

      name:
        isSameUser
          ? (
              previousSession?.name ||
              resolvedName
            )
          : resolvedName,

      email:
        isSameUser
          ? (
              previousSession?.email ||
              ''
            )
          : '',

      location:
        isSameUser
          ? (
              previousSession?.location ||
              'Andhra Pradesh, India'
            )
          : 'Andhra Pradesh, India',

      pin:
        isSameUser
          ? (
              previousSession?.pin ||
              ''
            )
          : '',

      role:
        isSameUser
          ? (
              previousSession?.role ||
              resolvedRole
            )
          : resolvedRole,

      completedOnboarding:
        true,

      token:
        developmentToken,
    };

    await StorageAdapter.setAuthSession({
      phone:
        user.phone,

      name:
        user.name,

      email:
        user.email,

      location:
        user.location,

      pin:
        user.pin,

      role:
        user.role,

      completedOnboarding:
        user.completedOnboarding,

      token:
        user.token,
    });

    console.log(
      '[AUTH] User authenticated:',
      {
        phone: user.phone,
        role: user.role,
        token: user.token,
      },
    );

    ApiAdapter.saveUser({
      phone:
        user.phone,

      name:
        user.name,

      email:
        user.email,

      location:
        user.location,

      role:
        user.role,

      onboardingComplete:
        user.completedOnboarding,
    }).catch((err) => {
      console.warn(
        '[AuthAdapter] Backend sync note:',
        err,
      );
    });

    return user;
  }

  /* =======================================================
     REGISTER
  ======================================================= */

  /**
   * Register a new user.
   *
   * Fields:
   * - Name
   * - Phone
   * - 4-digit PIN
   * - Role
   * - Language
   */
  async register(
    name: string,
    phone: string,
    pin: string,
    role: 'ARTISAN' | 'CUSTOMER',
    language?: string,
  ): Promise<AuthUser> {

    const cleanPhone =
      this.cleanPhone(phone);

    this.validatePhone(cleanPhone);

    if (!name.trim()) {
      throw new Error(
        'Please enter your name.',
      );
    }

    this.validatePin(pin);

    /* -------------------------------------------------------
       Demo account handling
    ------------------------------------------------------- */

    const demoAccount =
      DEV_TEST_ACCOUNTS[cleanPhone];

    /**
     * If this is a predefined demo account,
     * use its role/name unless explicitly changed
     * by the registration flow.
     */
    const resolvedName =
      name.trim() ||
      demoAccount?.name ||
      'Artisan Maker';

    const resolvedRole =
      role ||
      demoAccount?.role ||
      'ARTISAN';

    /* -------------------------------------------------------
       Check current session
    ------------------------------------------------------- */

    const existingSession =
      await StorageAdapter.getAuthSession();

    /**
     * If the same phone is already logged in,
     * don't create another registration.
     */
    if (
      existingSession &&
      existingSession.phone === cleanPhone
    ) {
      throw new Error(
        'An account with this mobile number is already active. Please logout first.',
      );
    }

    /* -------------------------------------------------------
       Create user
    ------------------------------------------------------- */

    const user: AuthUser = {
      uid:
        `dev-uid-${cleanPhone}`,

      phone:
        cleanPhone,

      name:
        resolvedName,

      email:
        '',

      location:
        'Andhra Pradesh, India',

      pin:
        pin,

      role:
        resolvedRole,

      completedOnboarding:
        true,

      token:
        `dev:${cleanPhone}`,
    };

    /* -------------------------------------------------------
       Save authentication session
    ------------------------------------------------------- */

    await StorageAdapter.setAuthSession({
      phone:
        user.phone,

      name:
        user.name,

      email:
        user.email,

      location:
        user.location,

      pin:
        user.pin,

      role:
        user.role,

      completedOnboarding:
        user.completedOnboarding,

      token:
        user.token,
    });

    console.log(
      '[AUTH] User registered:',
      {
        phone: user.phone,
        role: user.role,
        language,
      },
    );

    /* -------------------------------------------------------
       Sync with backend
    ------------------------------------------------------- */

    ApiAdapter.saveUser({
      phone:
        user.phone,

      name:
        user.name,

      email:
        user.email,

      location:
        user.location,

      role:
        user.role,

      onboardingComplete:
        user.completedOnboarding,
    }).catch((err) => {
      console.warn(
        '[AuthAdapter] Backend registration sync note:',
        err,
      );
    });

    return user;
  }

  /* =======================================================
     LOGIN
  ======================================================= */

  /**
   * Login using:
   * Phone + 4-digit PIN
   */
  async login(
    phone: string,
    pin: string,
  ): Promise<AuthUser> {

    const cleanPhone =
      this.cleanPhone(phone);

    this.validatePhone(cleanPhone);

    this.validatePin(pin);

    /* -------------------------------------------------------
       Check predefined demo account first
    ------------------------------------------------------- */

    const demoAccount =
      DEV_TEST_ACCOUNTS[cleanPhone];

    /* -------------------------------------------------------
       Get stored session
    ------------------------------------------------------- */

    const session =
      await StorageAdapter.getAuthSession();

    /**
     * If the stored session belongs to this
     * phone number, validate its PIN.
     */
    if (
      session &&
      session.phone === cleanPhone
    ) {

      if (
        session.pin &&
        session.pin !== pin
      ) {
        throw new Error(
          'Incorrect PIN. Please try again.',
        );
      }

      const token =
        session.token ||
        `dev:${cleanPhone}`;

      const user: AuthUser = {
        uid:
          `dev-uid-${cleanPhone}`,

        phone:
          cleanPhone,

        name:
          session.name ||
          demoAccount?.name ||
          'Artisan Maker',

        email:
          session.email ||
          '',

        location:
          session.location ||
          'Andhra Pradesh, India',

        pin:
          session.pin ||
          pin,

        role:
          session.role ||
          demoAccount?.role ||
          'ARTISAN',

        completedOnboarding:
          session.completedOnboarding ??
          true,

        token:
          token,
      };

      await StorageAdapter.setAuthSession({
        phone:
          user.phone,

        name:
          user.name,

        email:
          user.email,

        location:
          user.location,

        pin:
          user.pin,

        role:
          user.role,

        completedOnboarding:
          user.completedOnboarding,

        token:
          user.token,
      });

      console.log(
        '[AUTH] User logged in:',
        {
          phone: user.phone,
          role: user.role,
        },
      );

      return user;
    }

    /* -------------------------------------------------------
       Demo accounts
    ------------------------------------------------------- */

    if (demoAccount) {

      /**
       * Demo accounts use PIN 1234.
       *
       * This makes the predefined development
       * accounts available even when no session
       * currently exists.
       */
      const demoPin =
        demoAccount.pin || '1234';

      if (pin !== demoPin) {
        throw new Error(
          'Incorrect PIN. Demo account PIN is 1234.',
        );
      }

      const user: AuthUser = {
        uid:
          `dev-uid-${cleanPhone}`,

        phone:
          cleanPhone,

        name:
          demoAccount.name,

        email:
          '',

        location:
          'Andhra Pradesh, India',

        pin:
          pin,

        role:
          demoAccount.role,

        completedOnboarding:
          true,

        token:
          `dev:${cleanPhone}`,
      };

      await StorageAdapter.setAuthSession({
        phone:
          user.phone,

        name:
          user.name,

        email:
          user.email,

        location:
          user.location,

        pin:
          user.pin,

        role:
          user.role,

        completedOnboarding:
          user.completedOnboarding,

        token:
          user.token,
      });

      console.log(
        '[AUTH] Demo user logged in:',
        {
          phone: user.phone,
          role: user.role,
        },
      );

      return user;
    }

    /* -------------------------------------------------------
       No account found
    ------------------------------------------------------- */

    throw new Error(
      'No account found with this mobile number. Please register first.',
    );
  }

  /* =======================================================
     SIGN OUT
  ======================================================= */

  async signOut(): Promise<void> {
    await StorageAdapter.clearAuthSession();

    console.log(
      '[AUTH] User signed out.',
    );
  }

  /* =======================================================
     GET CURRENT USER
  ======================================================= */

  async getCurrentUser(): Promise<AuthUser | null> {

    const session =
      await StorageAdapter.getAuthSession();

    if (!session) {
      return null;
    }

    const cleanPhone =
      this.cleanPhone(session.phone);

    this.validatePhone(cleanPhone);

    const token =
      session.token ||
      `dev:${cleanPhone}`;

    /**
     * Repair old session if token is missing.
     */
    if (!session.token) {

      await StorageAdapter.setAuthSession({
        ...session,

        phone:
          cleanPhone,

        token:
          token,
      });
    }

    return {
      uid:
        `dev-uid-${cleanPhone}`,

      phone:
        cleanPhone,

      name:
        session.name ||
        'Artisan Maker',

      email:
        session.email ||
        '',

      location:
        session.location ||
        'Andhra Pradesh, India',

      pin:
        session.pin ||
        '',

      role:
        session.role ||
        'ARTISAN',

      completedOnboarding:
        session.completedOnboarding ??
        true,

      token:
        token,
    };
  }
}

/* =========================================================
   DEVELOPMENT AUTH MODE
========================================================= */

/**
 * Keep true while testing with Expo Go.
 */
export const DEV_AUTH_ENABLED =
  true;

/* =========================================================
   APPLICATION AUTH PROVIDER
========================================================= */

export const AuthAdapter:
  IAuthProvider =
    new DevAuthProvider();