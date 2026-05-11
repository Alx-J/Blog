import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const getSecret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || 'change-this-in-production');

// ── Token Creation ─────────────────────────────────────────────
export async function createAuthToken() {
  const csrf = crypto.randomBytes(32).toString('hex');
  const token = await new SignJWT({ role: 'admin', csrf })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecret());
  return { token, csrf };
}

// ── Token Verification ─────────────────────────────────────────
export async function verifyAuthToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload;
  } catch {
    return null;
  }
}

// ── Get auth payload from Next.js API req ─────────────────────
export async function getAuthPayload(req) {
  const token = req.cookies?.auth_token;
  if (!token) return null;
  return verifyAuthToken(token);
}

// ── Password verification ──────────────────────────────────────
export async function verifyPassword(plainText) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    // Dev fallback — plain text comparison (never use in prod)
    console.warn('⚠️  No ADMIN_PASSWORD_HASH set — using plain ADMIN_PASSWORD (dev only)');
    return plainText === process.env.ADMIN_PASSWORD;
  }
  return bcrypt.compareSync(plainText, hash);
}

// ── CSRF validation ────────────────────────────────────────────
export async function validateCsrf(req) {
  const payload = await getAuthPayload(req);
  if (!payload) return false;
  const csrfHeader = req.headers['x-csrf-token'];
  if (!csrfHeader) return false;
  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(csrfHeader),
    Buffer.from(payload.csrf || '')
  );
}

// ── Cookie options ─────────────────────────────────────────────
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 8, // 8 hours
  path: '/',
};
