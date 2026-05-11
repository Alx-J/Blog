import { getAuthPayload, validateCsrf } from '../../../../lib/auth';
import { getAllImagesFromGitHub, deleteImageFromGitHub } from '../../../../lib/github';
import { rateLimit, getClientIp } from '../../../../lib/rateLimit';

export default async function handler(req, res) {
  const payload = await getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  // ── GET: list all uploaded images ─────────────────────────────
  if (req.method === 'GET') {
    try {
      const images = await getAllImagesFromGitHub();
      return res.status(200).json({ images });
    } catch (err) {
      console.error('[ADMIN IMAGES GET]', err.message);
      return res.status(500).json({ error: 'Failed to fetch images.' });
    }
  }

  // ── DELETE: remove an image ────────────────────────────────────
  if (req.method === 'DELETE') {
    const csrfValid = await validateCsrf(req);
    if (!csrfValid) return res.status(403).json({ error: 'Invalid CSRF token.' });

    const ip = getClientIp(req);
    const rl = rateLimit(`delete-img:${ip}`, 30, 60 * 60 * 1000);
    if (!rl.success) return res.status(429).json({ error: 'Too many requests.' });

    const { filename, sha } = req.body || {};
    if (!filename || typeof filename !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename.' });
    }
    if (!sha || !/^[a-f0-9]{40}$/.test(sha)) {
      return res.status(400).json({ error: 'Valid SHA required.' });
    }

    try {
      await deleteImageFromGitHub(filename, sha);
      console.info(`[ADMIN DELETE IMG] "${filename}" at ${new Date().toISOString()}`);
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to delete image from GitHub.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
