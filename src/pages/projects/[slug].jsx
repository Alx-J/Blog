import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getAllProjectsFromGitHub, getProjectFromGitHub } from '../../lib/github';
import { parseFrontmatter, buildProjectMeta, renderMarkdown, estimateReadTime } from '../../lib/markdown';

export default function ProjectPage({ project }) {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  if (!project) return null;

  return (
    <>
      <Head>
        <title>{project.title} — DEVIL&apos;S EDGE</title>
        <meta name="description" content={project.description} />
      </Head>

      <Navbar />

      <div className="project-hero">
        <div className="project-hero-bg" />
        <div className="project-hero-inner">
          <Link href="/#projects" className="project-back">Back to projects</Link>

          <h1 className="project-hero-title">{project.title}</h1>
          <p className="project-hero-desc">{project.description}</p>

          <div className="project-hero-meta">
            <div className={`project-status status-${project.status === 'live' ? 'live' : 'wip'}`}>
              <div className="status-dot" />
              {project.status === 'live' ? 'Live' : 'In Progress'}
            </div>

            {project.tags?.map(t => (
              <span className="post-tag" key={t}>#{t}</span>
            ))}

            {project.repo && (
              <a href={project.repo} target="_blank" rel="noopener noreferrer" className="project-repo-btn">
                ↗ GitHub Repo
              </a>
            )}
          </div>
        </div>
      </div>

      <main>
        <div className="article-wrap">
          {project.htmlContent
            ? <article className="article-body" dangerouslySetInnerHTML={{ __html: project.htmlContent }} />
            : <p style={{ color: 'var(--white-dim)', fontStyle: 'italic' }}>No detailed writeup yet.</p>
          }
        </div>
      </main>

      <Footer />
    </>
  );
}

export async function getStaticPaths() {
  try {
    const files = await getAllProjectsFromGitHub();
    return { paths: files.map(f => ({ params: { slug: f.slug } })), fallback: 'blocking' };
  } catch {
    return { paths: [], fallback: 'blocking' };
  }
}

export async function getStaticProps({ params }) {
  try {
    const { content } = await getProjectFromGitHub(params.slug);
    const { frontmatter, body } = parseFrontmatter(content);
    const meta = buildProjectMeta(frontmatter, params.slug);
    const htmlContent = body.trim() ? await renderMarkdown(body) : '';
    return { props: { project: { ...meta, htmlContent, readTime: estimateReadTime(body) } }, revalidate: 60 };
  } catch (e) {
    if (e.status === 404) return { notFound: true };
    return { notFound: true };
  }
}
