import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import { AuthUser, UserRole } from './types';

export const SESSION_COOKIE = 'civres_session';

// Demo-grade secret. For a real deployment supply CIVRES_JWT_SECRET in env
// (already excluded from the repo via .gitignore). The fallback keeps local
// dev + the hackathon demo running with zero setup.
const SECRET = new TextEncoder().encode(
  process.env.CIVRES_JWT_SECRET || 'civicresolve-dgp-demo-secret-change-in-prod'
);

export const SESSION_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export async function signSession(user: AuthUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload || typeof payload.userId !== 'string') return null;
    return {
      userId: payload.userId as string,
      role: payload.role as UserRole,
      name: (payload.name as string) || 'User',
      phone: payload.phone as string | undefined,
      email: payload.email as string | undefined,
      departmentId: payload.departmentId as string | undefined,
      jurisdictionCode: payload.jurisdictionCode as string | undefined,
    };
  } catch {
    return null;
  }
}

export async function getSession(req: NextRequest): Promise<AuthUser | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function isRole(user: AuthUser | null, ...roles: UserRole[]): boolean {
  return !!user && roles.includes(user.role);
}

export function denied(message = 'Forbidden: you do not have access to this action.') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function unauthorized(message = 'Authentication required.') {
  return NextResponse.json({ error: message, code: 'AUTH_REQUIRED' }, { status: 401 });
}

// ---------------------------------------------------------------------------
// Simulated OTP (passwordless citizen sign-in). Real SMS/WhatsApp needs a
// provider key; the demo generates the OTP in-memory and returns it so the
// flow can be completed instantly.
//
// Routes are bundled separately by Next.js (dev + prod), so module-level state
// lives on globalThis — same pattern as the civic store — or OTPs would be
// invisible to the verify route.
// ---------------------------------------------------------------------------
const globalForOtp = globalThis as unknown as {
  __civresOtpStore?: Map<string, { otp: string; expiresAt: number }>;
};
const otpStore: Map<string, { otp: string; expiresAt: number }> =
  globalForOtp.__civresOtpStore || new Map();
if (process.env.NODE_ENV !== 'production') globalForOtp.__civresOtpStore = otpStore;

export function issueOtp(phone: string): string {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });
  return otp;
}

export function verifyOtp(phone: string, otp: string): boolean {
  const entry = otpStore.get(phone);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(phone);
    return false;
  }
  const ok = entry.otp === otp;
  if (ok) otpStore.delete(phone);
  return ok;
}

// ---------------------------------------------------------------------------
// Demo accounts for Staff (department) and City Admin. Two departments seeded
// so cross-department isolation (403) can be demonstrated for real.
// ---------------------------------------------------------------------------
export type DemoAccount = { email: string; password: string; user: AuthUser };

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'water@city.gov',
    password: 'demo1234',
    user: {
      userId: 'usr-dept-water',
      role: 'department',
      name: 'Water Field Staff',
      email: 'water@city.gov',
      departmentId: 'DEPT_WATER',
      jurisdictionCode: 'Ward-11',
    },
  },
  {
    email: 'roads@city.gov',
    password: 'demo1234',
    user: {
      userId: 'usr-dept-pwd',
      role: 'department',
      name: 'Roads Field Staff',
      email: 'roads@city.gov',
      departmentId: 'DEPT_PWD',
      jurisdictionCode: 'Ward-11',
    },
  },
  {
    email: 'admin@city.gov',
    password: 'admin1234',
    user: {
      userId: 'usr-admin-001',
      role: 'city_admin',
      name: 'City Admin',
      email: 'admin@city.gov',
      jurisdictionCode: 'CITY-VIZAG',
    },
  },
];

export const CITY_ADMIN_USER_ID = 'usr-admin-001';

export function demoAccountByEmail(email: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === email.trim().toLowerCase());
}

export function createCitizenUser(phone: string, displayName?: string): AuthUser {
  return {
    userId: `usr-cit-${phone}`,
    role: 'citizen',
    name: displayName?.trim() || `Citizen +91 ${phone}`,
    phone,
  };
}