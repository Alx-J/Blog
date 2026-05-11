import { getAuthPayload, validateCsrf } from '../../../lib/auth';
import { uploadPostToGitHub, uploadProjectToGitHub, uploadAboutToGitHub, getPostFromGitHub, getProjectFromGitHub, getAboutFromGitHub } from '../../../lib/github';
import { validateMarkdownFile } from '../../../lib/markdown';
import { rateLimit, getClientIp } from '../../../lib/rateLimit';

export const config = {
  api: { bodyParser: { sizeLimit: '600kb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = await getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return res.status(403).json({ error: 'Invalid CSRF token.' });

  const ip = getClientIp(req);
  const rl = rateLimit(`upload:${ip}`, 30, 60 * 60 * 1000);
  if (!rl.success) return res.status(429).json({ error: 'Too many uploads. Try again later.' });

  const { filename, content, type = 'post' } = req.body || {};

  // ── About page: different rules (any filename saved as about.md) ──
  if (type === 'about') {
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required.' });
    }
    if (content.length > 500_000) {
      return res.status(400).json({ error: 'File too large (max 500KB).' });
    }
    try {
      const { sha: existingSha } = await getAboutFromGitHub();
      await uploadAboutToGitHub(content, existingSha);
      console.info(`[ADMIN] About page updated at ${new Date().toISOString()}`);
      return res.status(200).json({ success: true, message: 'About page updated on GitHub.' });
    } catch (err) {
      console.error('[ADMIN ABOUT] Upload error:', err.message);
      return res.status(500).json({ error: 'Failed to save about page to GitHub.' });
    }
  }

  // ── Posts and Projects: strict filename validation ────────────
  const errors = validateMarkdownFile(filename, content);
  if (errors.length) return res.status(400).json({ error: errors[0] });

  const slug = filename.replace(/\.md$/, '');

  try {
    let existingSha = null;

    if (type === 'project') {
      try { existingSha = (await getProjectFromGitHub(slug)).sha; } catch (e) { if (e.status !== 404) throw e; }
      await uploadProjectToGitHub(filename, content, existingSha);
    } else {
      try { existingSha = (await getPostFromGitHub(slug)).sha; } catch (e) { if (e.status !== 404) throw e; }
      await uploadPostToGitHub(filename, content, existingSha);
    }

    const action = existingSha ? 'updated' : 'created';
    console.info(`[ADMIN UPLOAD] ${type} "${filename}" ${action} at ${new Date().toISOString()}`);
    return res.status(200).json({
      success: true,
      message: `"${filename}" ${action} on GitHub. Site rebuilds in ~2 minutes.`,
    });
  } catch (err) {
    console.error(`[ADMIN UPLOAD] Failed "${filename}":`, err.message);
    return res.status(500).json({ error: 'Failed to commit file to GitHub.' });
  }
}
