import { getAuthPayload } from '../../../../lib/auth';
import { getAllPostsFromGitHub, getPostFromGitHub } from '../../../../lib/github';
import { parseFrontmatter, buildPostMeta, estimateReadTime } from '../../../../lib/markdown';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = await getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const files = await getAllPostsFromGitHub();
    const posts = (await Promise.all(
      files.map(async (file) => {
        try {
          const { content, sha } = await getPostFromGitHub(file.slug);
          const { frontmatter, body } = parseFrontmatter(content);
          const meta = buildPostMeta(frontmatter, file.slug);
          return { ...meta, readTime: estimateReadTime(body), sha };
        } catch {
          return { slug: file.slug, title: file.slug.replace(/-/g, ' '), category: '—', date: '—', rawDate: '1970-01-01', readTime: '—', tags: [], description: '', sha: file.sha };
        }
      })
    )).sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

    return res.status(200).json({ posts });
  } catch (err) {
    console.error('[ADMIN POSTS]', err.message);
    return res.status(500).json({ error: 'Failed to fetch posts from GitHub.' });
  }
}
