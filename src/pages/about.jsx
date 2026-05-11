import Head from 'next/head';
import { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { getAboutFromGitHub } from '../lib/github';
import { parseFrontmatter, renderMarkdown } from '../lib/markdown';

export default function About({ htmlContent, title }) {
  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <Head>
        <title>About — DANTE</title>
        <meta name="description" content="About the author of Blog" />
      </Head>

      <Navbar />

      <div className="about-hero">
        <div className="about-hero-bg" />
        <div className="about-hero-inner">
          <p className="about-eyebrow">The Person Behind the Blade</p>
          <h1 className="about-title">
            {title || <><span>About</span> Me</>}
          </h1>
        </div>
      </div>

      <main>
        <div className="article-wrap">
          {htmlContent
            ? <article className="article-body" dangerouslySetInnerHTML={{ __html: htmlContent }} />
            : (
              <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--white-dim)' }}>
                <p style={{ fontFamily: 'Share Tech Mono', fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                  About page not set up yet.
                </p>
                <p style={{ fontFamily: 'Crimson Text', fontSize: '1rem', marginTop: '1rem', fontStyle: 'italic' }}>
                  Upload an <code style={{ fontSize: '0.85rem', background: 'var(--surface)', padding: '2px 6px', border: '1px solid var(--border)' }}>about.md</code> file from the admin panel to populate this page.
                </p>
              </div>
            )
          }
        </div>
      </main>

      <Footer />
    </>
  );
}

export async function getStaticProps() {
  try {
    const { content } = await getAboutFromGitHub();
    if (!content) return { props: { htmlContent: '', title: '' }, revalidate: 60 };
    const { frontmatter, body } = parseFrontmatter(content);
    const htmlContent = await renderMarkdown(body);
    return {
      props: { htmlContent, title: frontmatter.title || '' },
      revalidate: 60,
    };
  } catch {
    return { props: { htmlContent: '', title: '' }, revalidate: 30 };
  }
}
