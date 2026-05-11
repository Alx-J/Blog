import { getAuthPayload } from '../../../../lib/auth';
import { getAllProjectsFromGitHub, getProjectFromGitHub } from '../../../../lib/github';
import { parseFrontmatter, buildProjectMeta } from '../../../../lib/markdown';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const payload = await getAuthPayload(req);
  if (!payload) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const files = await getAllProjectsFromGitHub();
    const projects = (await Promise.all(
      files.map(async (file) => {
        try {
          const { content, sha } = await getProjectFromGitHub(file.slug);
          const { frontmatter } = parseFrontmatter(content);
          const meta = buildProjectMeta(frontmatter, file.slug);
          return { ...meta, sha };
        } catch {
          return { slug: file.slug, title: file.slug.replace(/-/g, ' '), description: '—', tags: [], status: 'wip', repo: null, rawDate: '1970-01-01', sha: file.sha };
        }
      })
    )).sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

    return res.status(200).json({ projects });
  } catch (err) {
    console.error('[ADMIN PROJECTS]', err.message);
    return res.status(500).json({ error: 'Failed to fetch projects from GitHub.' });
  }
}
