import { getAuthPayload, validateCsrf } from '../../../../lib/auth';
import { deletePostFromGitHub } from '../../../../lib/github';
import { rateLimit, getClientIp } from '../../../../lib/rateLimit';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const payload = await getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  const csrfValid = await validateCsrf(req);
  if (!csrfValid) return res.status(403).json({ error: 'Invalid CSRF token.' });

  const ip = getClientIp(req);
  const rl = rateLimit(`delete-post:${ip}`, 20, 60 * 60 * 1000);
  if (!rl.success) return res.status(429).json({ error: 'Too many requests. Wait before deleting again.' });

  const { slug } = req.query;
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return res.status(400).json({ error: 'Invalid post slug.' });
  }

  const { sha } = req.body || {};
  if (!sha || typeof sha !== 'string' || !/^[a-f0-9]{40}$/.test(sha)) {
    return res.status(400).json({ error: 'Valid file SHA required.' });
  }

  try {
    await deletePostFromGitHub(slug, sha);
    console.info(`[ADMIN DELETE POST] "${slug}" at ${new Date().toISOString()}`);
    return res.status(200).json({ success: true, message: `Post "${slug}" deleted.` });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ error: 'Post not found on GitHub.' });
    if (err.status === 409) return res.status(409).json({ error: 'File was modified — refresh and try again.' });
    return res.status(500).json({ error: 'Failed to delete post from GitHub.' });
  }
}
