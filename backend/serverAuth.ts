import {
  cert,
  getApps,
  initializeApp,
  applicationDefault,
} from 'firebase-admin/app';

import { getAuth } from 'firebase-admin/auth';

import type {
  NextFunction,
  Request,
  Response,
} from 'express';


// ============================================================
// Types
// ============================================================

export type UserRole =
  | 'ARTISAN'
  | 'CUSTOMER'
  | 'ADMIN';

export interface AuthIdentity {
  uid: string;
  phone: string;
  role: UserRole;
}


// ============================================================
// Express request typing
// ============================================================

declare global {
  namespace Express {
    interface Request {
      auth?: AuthIdentity;
    }
  }
}


// ============================================================
// Development accounts
//
// These are only special demo accounts.
//
// IMPORTANT:
// Any other valid 10-digit phone number is also accepted.
// Unknown development users default to ARTISAN.
// ============================================================

const DEV_ACCOUNTS: Record<
  string,
  {
    role: Exclude<UserRole, 'ADMIN'>;
  }
> = {
  '9848012345': {
    role: 'ARTISAN',
  },

  '9820044556': {
    role: 'CUSTOMER',
  },
};


// ============================================================
// Helpers
// ============================================================

function isRole(
  value: unknown,
): value is UserRole {
  return (
    value === 'ARTISAN' ||
    value === 'CUSTOMER' ||
    value === 'ADMIN'
  );
}


function normalizePhone(
  value: unknown,
): string {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(-10);
}


// ============================================================
// Development authentication
//
// Frontend creates:
//
//     dev:9848012345
//     dev:9820044556
//     dev:9876543210
//     dev:9123456789
//
// IMPORTANT:
//
// Any valid 10-digit phone number is accepted.
//
// Known accounts keep their configured role.
// Unknown accounts become ARTISAN in development.
// ============================================================

function getDevelopmentIdentity(
  token: string,
): AuthIdentity | null {

  /**
   * Accept only:
   *
   * dev:<exactly 10 digits>
   */
  const match =
    /^dev:([0-9]{10})$/.exec(
      token.trim(),
    );

  if (!match) {
    return null;
  }

  const phone =
    normalizePhone(match[1]);

  if (!/^\d{10}$/.test(phone)) {
    return null;
  }

  /**
   * Check predefined demo account.
   *
   * If found, use its role.
   */
  const account =
    DEV_ACCOUNTS[phone];

  /**
   * IMPORTANT:
   *
   * If the phone number is NOT in
   * DEV_ACCOUNTS, do NOT reject it.
   *
   * Instead create a development
   * ARTISAN identity.
   */
  const role: Exclude<UserRole, 'ADMIN'> =
    account?.role ||
    'ARTISAN';

  return {
    uid:
      `dev-uid-${phone}`,

    phone,

    role,
  };
}


// ============================================================
// Firebase Admin
// ============================================================

function getFirebaseAdminAuth() {

  /**
   * Firebase Admin should only be
   * initialized once.
   */
  if (getApps().length === 0) {

    const serviceAccountJson =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {

      try {

        const serviceAccount =
          JSON.parse(
            serviceAccountJson,
          );

        initializeApp({
          credential:
            cert(serviceAccount),
        });

      } catch (error) {

        console.error(
          '[Firebase] Invalid FIREBASE_SERVICE_ACCOUNT_JSON:',
          error,
        );

        throw new Error(
          'Invalid FIREBASE_SERVICE_ACCOUNT_JSON',
        );
      }

    } else {

      /**
       * Use Firebase credentials
       * supplied through environment.
       */
      initializeApp({
        credential:
          applicationDefault(),
      });
    }
  }

  return getAuth();
}


// ============================================================
// Bearer token
// ============================================================

function getBearerToken(
  req: Request,
): string | null {

  const header =
    req.header('authorization');

  if (!header) {
    return null;
  }

  /**
   * Accept:
   *
   * Authorization: Bearer TOKEN
   */
  const match =
    /^Bearer\s+(.+)$/i.exec(
      header.trim(),
    );

  if (!match) {
    return null;
  }

  const token =
    match[1].trim();

  return token || null;
}


// ============================================================
// Authentication middleware
// ============================================================

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {

  const token =
    getBearerToken(req);


  // ----------------------------------------------------------
  // No token
  // ----------------------------------------------------------

  if (!token) {

    return res.status(401).json({
      error:
        'Authentication required',
    });
  }


  // ----------------------------------------------------------
  // DEVELOPMENT AUTH
  //
  // IMPORTANT:
  //
  // Check development token BEFORE
  // Firebase authentication.
  //
  // This allows:
  //
  // dev:9848012345
  // dev:9876543210
  // dev:9123456789
  //
  // etc.
  // ----------------------------------------------------------

  const developmentIdentity =
    getDevelopmentIdentity(token);

  if (developmentIdentity) {

    req.auth =
      developmentIdentity;

    console.log(
      '[DEV AUTH] Authenticated:',
      {
        uid:
          developmentIdentity.uid,

        phone:
          developmentIdentity.phone,

        role:
          developmentIdentity.role,
      },
    );

    return next();
  }


  // ----------------------------------------------------------
  // Firebase authentication
  //
  // If it is not a development token,
  // treat it as a real Firebase ID token.
  // ----------------------------------------------------------

  try {

    const decoded =
      await getFirebaseAdminAuth()
        .verifyIdToken(token);


    // --------------------------------------------------------
    // Role
    // --------------------------------------------------------

    const role =
      isRole(decoded.role)
        ? decoded.role
        : 'CUSTOMER';


    // --------------------------------------------------------
    // Phone number
    // --------------------------------------------------------

    const phone =
      normalizePhone(
        decoded.phone_number,
      );


    if (!phone) {

      return res.status(403).json({
        error:
          'A verified phone number is required',
      });
    }


    // --------------------------------------------------------
    // Store authenticated identity
    // --------------------------------------------------------

    req.auth = {
      uid:
        decoded.uid,

      phone,

      role,
    };


    return next();

  } catch (error) {

    console.warn(
      '[Auth] Firebase token verification failed:',
      error instanceof Error
        ? error.message
        : error,
    );


    return res.status(401).json({
      error:
        'Invalid or expired authentication token',
    });
  }
}


// ============================================================
// Role authorization
// ============================================================

export function requireRole(
  ...roles: UserRole[]
) {

  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {

    if (!req.auth) {

      return res.status(401).json({
        error:
          'Authentication required',
      });
    }


    if (
      !roles.includes(
        req.auth.role,
      )
    ) {

      return res.status(403).json({
        error:
          'Insufficient permissions',
      });
    }


    return next();
  };
}


// ============================================================
// Phone comparison
// ============================================================

export function samePhone(
  left: unknown,
  right: unknown,
): boolean {

  const leftPhone =
    normalizePhone(left);

  const rightPhone =
    normalizePhone(right);

  if (
    !leftPhone ||
    !rightPhone
  ) {
    return false;
  }

  return leftPhone === rightPhone;
}


// ============================================================
// Firebase role provisioning
// ============================================================

export async function provisionRole(
  uid: string,
  role: Exclude<UserRole, 'ADMIN'>,
): Promise<void> {

  await getFirebaseAdminAuth()
    .setCustomUserClaims(
      uid,
      {
        role,
      },
    );
}