import { getAuthPayload, validateCsrf } from '../../../../lib/auth';
import { uploadImageToGitHub, getAllImagesFromGitHub } from '../../../../lib/github';
import { rateLimit, getClientIp } from '../../../../lib/rateLimit';

export const config = {
  api: { bodyParser: { sizeLimit: '8mb' } }, // images can be larger
};

const ALLOWED_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const SAFE_FILENAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g|gif|webp|svg)$/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = await getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return res.status(403).json({ error: 'Invalid CSRF token.' });

  const ip = getClientIp(req);
  const rl = rateLimit(`upload-img:${ip}`, 50, 60 * 60 * 1000);
  if (!rl.success) return res.status(429).json({ error: 'Too many uploads. Try again later.' });

  const { filename, base64 } = req.body || {};

  // ── Validate filename ─────────────────────────────────────────
  if (!filename || !SAFE_FILENAME.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename. Use alphanumeric characters, dots, hyphens only.' });
  }
  if (!ALLOWED_EXT.test(filename)) {
    return res.status(400).json({ error: 'Only PNG, JPG, GIF, WebP, and SVG files are allowed.' });
  }

  // ── Validate base64 ───────────────────────────────────────────
  if (!base64 || typeof base64 !== 'string') {
    return res.status(400).json({ error: 'Image data is required.' });
  }
  const sizeBytes = Math.ceil((base64.length * 3) / 4);
  if (sizeBytes > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image too large (max 5MB).' });
  }

  try {
    // Check if image already exists (get SHA for update)
    let existingSha = null;
    try {
      const existing = await getAllImagesFromGitHub();
      const found = existing.find(i => i.name.toLowerCase() === filename.toLowerCase());
      if (found) existingSha = found.sha;
    } catch { /* ignore — new file */ }

    await uploadImageToGitHub(filename, base64, existingSha);

    console.info(`[ADMIN IMG UPLOAD] "${filename}" at ${new Date().toISOString()}`);
    return res.status(200).json({
      success: true,
      path: `/images/${filename}`,
      message: `"${filename}" uploaded. Use /images/${filename} in your markdown.`,
    });
  } catch (err) {
    console.error('[ADMIN IMG UPLOAD]', err.message);
    return res.status(500).json({ error: 'Failed to upload image to GitHub.' });
  }
}
