/**
 * In-memory rate limiter using sliding window.
 * NOTE: On serverless (Vercel/Netlify) each function instance has its own
 * memory. For strict production rate limiting, replace with Upstash Redis:
 * https://github.com/upstash/ratelimit
 */

const store = new Map(); // key → [timestamps]

/**
 * @param {string} key       - identifier (e.g. IP + route)
 * @param {number} limit     - max requests allowed
 * @param {number} windowMs  - sliding window in ms
 * @returns {{ success: boolean, remaining: number, resetAt: number }}
 */
export function rateLimit(key, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Prune old entries
  const timestamps = (store.get(key) || []).filter(t => t > windowStart);

  if (timestamps.length >= limit) {
    const oldest = timestamps[0];
    return {
      success: false,
      remaining: 0,
      resetAt: oldest + windowMs,
    };
  }

  timestamps.push(now);
  store.set(key, timestamps);

  // Clean store periodically to prevent memory bloat
  if (store.size > 5000) {
    for (const [k, ts] of store.entries()) {
      if (ts.every(t => t < windowStart)) store.delete(k);
    }
  }

  return {
    success: true,
    remaining: limit - timestamps.length,
    resetAt: now + windowMs,
  };
}

/**
 * Get client IP from Next.js request (handles proxies)
 */
export function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
