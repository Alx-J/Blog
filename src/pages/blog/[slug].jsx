import Head from 'next/head';
import Link from 'next/link';
import { useEffect } from 'react';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { getAllPostsFromGitHub, getPostFromGitHub } from '../../lib/github';
import { parseFrontmatter, buildPostMeta, estimateReadTime, renderMarkdown } from '../../lib/markdown';

export default function BlogPost({ post }) {
  // ── Hooks must always be called before any conditional return ──
  useEffect(() => {
    if (!post) return;
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [post]);

  if (!post) {
    return (
      <>
        <Navbar />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
          <p style={{ fontFamily: 'Cinzel', color: 'var(--red)', fontSize: '1.5rem' }}>Post Not Found</p>
          <Link href="/" className="btn-secondary">← Back Home</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{post.title} — DEVIL&apos;S EDGE</title>
        <meta name="description" content={post.description} />
        <meta property="og:title" content={`${post.title} — DEVIL'S EDGE`} />
        <meta property="og:description" content={post.description} />
      </Head>

      <Navbar />

      {/* Post Hero */}
      <div className="post-hero">
        <div className="post-hero-bg" />
        <div className="post-hero-inner">
          <Link href="/" className="post-back">Back to all posts</Link>

          <div className="post-hero-cat">{post.category}</div>
          <h1 className="post-hero-title">{post.title}</h1>

          <div className="post-hero-meta">
            <span>{post.date}</span>
            <span className="dot">·</span>
            <span>{post.readTime}</span>
            {post.tags?.length > 0 && (
              <>
                <span className="dot">·</span>
                <div className="post-tags">
                  {post.tags.map(t => (
                    <span className="post-tag" key={t}>#{t}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Article */}
      <main>
        <div className="article-wrap">
          <article
            className="article-body"
            dangerouslySetInnerHTML={{ __html: post.htmlContent }}
          />
        </div>
      </main>

      <Footer />
    </>
  );
}

export async function getStaticPaths() {
  try {
    const files = await getAllPostsFromGitHub();
    return {
      paths: files.map(f => ({ params: { slug: f.slug } })),
      fallback: 'blocking', // generate new pages on demand
    };
  } catch {
    return { paths: [], fallback: 'blocking' };
  }
}

export async function getStaticProps({ params }) {
  try {
    const { content } = await getPostFromGitHub(params.slug);
    const { frontmatter, body } = parseFrontmatter(content);
    const meta = buildPostMeta(frontmatter, params.slug);
    const htmlContent = await renderMarkdown(body);
    const readTime = estimateReadTime(body);

    return {
      props: { post: { ...meta, htmlContent, readTime } },
      revalidate: 60,
    };
  } catch (err) {
    if (err.status === 404) return { notFound: true };
    return { notFound: true };
  }
}
