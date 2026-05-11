import { useEffect } from 'react';
import Head from 'next/head';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import FeaturedPost from '../components/FeaturedPost';
import PostsGrid from '../components/PostsGrid';
import Projects from '../components/Projects';
import Footer from '../components/Footer';
import { getAllPostsFromGitHub, getPostFromGitHub, getAllProjectsFromGitHub, getProjectFromGitHub } from '../lib/github';
import { parseFrontmatter, buildPostMeta, buildProjectMeta, estimateReadTime } from '../lib/markdown';

export default function Home({ posts, projects }) {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [posts, projects]);

  return (
    <>
      <Head>
        <title>DANTE</title>
        <meta name="description" content="The systems were already broken. I just gave them a more dramatic ending. - welcome to the Devil’s Workshop." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />
      <Hero postCount={posts?.length || 0} />

      {posts?.length > 0 && <FeaturedPost post={posts[0]} />}

      <section className="posts-section section" id="writeups">
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div className="section-header reveal">
            <div>
              <p className="section-label">Write-ups</p>
              <h2 className="section-title">Blood &amp; <span>Bytes</span></h2>
            </div>
          </div>
          <PostsGrid posts={posts} />
        </div>
      </section>

      <section className="quote-section reveal">
        <p className="quote-text">
          &quot;Your SIEM dashboard lighting up <br />red isn&apos;t <em>an incident</em>.
          That&apos;s my entrance theme.&quot;
        </p>
        <p className="quote-attribution">— Personal Manifesto, Draft #9</p>
      </section>

      <Projects projects={projects} />
      <Footer />
    </>
  );
}

export async function getStaticProps() {
  try {
    // ── Fetch posts ──────────────────────────────────────────────
    const postFiles = await getAllPostsFromGitHub();
    const posts = (await Promise.all(
      postFiles.map(async f => {
        try {
          const { content, sha } = await getPostFromGitHub(f.slug);
          const { frontmatter, body } = parseFrontmatter(content);
          return { ...buildPostMeta(frontmatter, f.slug), readTime: estimateReadTime(body), sha };
        } catch { return null; }
      })
    )).filter(Boolean).sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

    // ── Fetch projects ───────────────────────────────────────────
    const projectFiles = await getAllProjectsFromGitHub();
    const projects = (await Promise.all(
      projectFiles.map(async f => {
        try {
          const { content } = await getProjectFromGitHub(f.slug);
          const { frontmatter } = parseFrontmatter(content);
          return buildProjectMeta(frontmatter, f.slug);
        } catch { return null; }
      })
    )).filter(Boolean).sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));

    return { props: { posts, projects }, revalidate: 60 };
  } catch (err) {
    console.error('getStaticProps error:', err.message);
    return { props: { posts: [], projects: [] }, revalidate: 30 };
  }
}
