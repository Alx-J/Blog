import { verifyPassword, createAuthToken, AUTH_COOKIE_OPTIONS } from '../../../lib/auth';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';
import { serialize } from 'cookie';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Rate limit: 5 attempts per 15 min per IP ─────────────────
  const ip = getClientIp(req);
  const rl = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.success) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: `Too many login attempts. Try again in ${Math.ceil(retryAfter / 60)} minutes.`,
    });
  }

  const { password } = req.body || {};

  // ── Input validation ─────────────────────────────────────────
  if (!password || typeof password !== 'string' || password.length > 200) {
    return res.status(400).json({ error: 'Invalid request.' });
  }

  // ── Verify password ──────────────────────────────────────────
  const valid = await verifyPassword(password);
  if (!valid) {
    // Log failed attempt (server-side only)
    console.warn(`[AUTH] Failed login attempt from ${ip} at ${new Date().toISOString()}`);
    // Use generic message — don't reveal whether user/pass was wrong
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // ── Create JWT + CSRF token ──────────────────────────────────
  const { token, csrf } = await createAuthToken();

  // Set httpOnly cookie (JS cannot read this — XSS-safe)
  res.setHeader(
    'Set-Cookie',
    serialize('auth_token', token, AUTH_COOKIE_OPTIONS)
  );

  console.info(`[AUTH] Successful login from ${ip} at ${new Date().toISOString()}`);

  // Return CSRF token in body — client stores in sessionStorage, sends as header
  return res.status(200).json({ success: true, csrfToken: csrf });
}
