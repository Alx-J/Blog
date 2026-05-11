import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import DropZone from '../../components/admin/DropZone';
import PostsTable from '../../components/admin/PostsTable';
import ImageDropZone from '../../components/admin/ImageDropZone';

export default function AdminDashboard() {
  const router = useRouter();
  const [csrf, setCsrf] = useState('');
  const [posts, setPosts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [images, setImages] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingImages, setLoadingImages] = useState(true);
  const [status, setStatus] = useState(null);

  // ── Auth ──────────────────────────────────────────────────────
  useEffect(() => {
    const token = sessionStorage.getItem('csrf_token');
    if (!token) { router.push('/admin/login'); return; }
    setCsrf(token);
  }, [router]);

  // ── Status toast ──────────────────────────────────────────────
  const showStatus = useCallback((type, msg) => {
    setStatus({ type, msg });
    setTimeout(() => setStatus(null), 5000);
  }, []);

  // ── Fetch posts ───────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!csrf) return;
    setLoadingPosts(true);
    try {
      const res = await fetch('/api/admin/posts', { headers: { 'X-CSRF-Token': csrf } });
      if (res.status === 401) { router.push('/admin/login'); return; }
      const data = await res.json();
      setPosts(data.posts || []);
    } catch (e) { showStatus('error', e.message); }
    finally { setLoadingPosts(false); }
  }, [csrf, router, showStatus]);

  // ── Fetch projects ────────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    if (!csrf) return;
    setLoadingProjects(true);
    try {
      const res = await fetch('/api/admin/projects', { headers: { 'X-CSRF-Token': csrf } });
      if (res.status === 401) { router.push('/admin/login'); return; }
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (e) { showStatus('error', e.message); }
    finally { setLoadingProjects(false); }
  }, [csrf, router, showStatus]);

  // ── Fetch images ──────────────────────────────────────────────
  const fetchImages = useCallback(async () => {
    if (!csrf) return;
    setLoadingImages(true);
    try {
      const res = await fetch('/api/admin/images', { headers: { 'X-CSRF-Token': csrf } });
      const data = await res.json();
      setImages(data.images || []);
    } catch { }
    finally { setLoadingImages(false); }
  }, [csrf]);

  useEffect(() => {
    if (csrf) { fetchPosts(); fetchProjects(); fetchImages(); }
  }, [csrf, fetchPosts, fetchProjects, fetchImages]);

  // ── Logout ────────────────────────────────────────────────────
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    sessionStorage.removeItem('csrf_token');
    router.push('/admin/login');
  };

  // ── Delete image ──────────────────────────────────────────────
  const deleteImage = async (img) => {
    try {
      const res = await fetch('/api/admin/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
        body: JSON.stringify({ filename: img.name, sha: img.sha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showStatus('success', `✓ "${img.name}" deleted.`);
      fetchImages();
    } catch (e) { showStatus('error', `✗ ${e.message}`); }
  };

  return (
    <>
      <Head>
        <title>Admin — DANTE</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <div className="admin-page">
        <nav className="nav scrolled">
          <Link href="/" className="nav-logo"><div className="logo-mark">A</div></Link>
          <span style={{ fontFamily: "'Share Tech Mono'", fontSize: '0.62rem', letterSpacing: '0.3em', color: 'var(--red)', textTransform: 'uppercase' }}>
            Admin Panel
          </span>
          <button className="admin-logout" onClick={logout}>Logout</button>
        </nav>

        <div className="admin-wrap">

          {/* Header */}
          <div className="admin-header">
            <div>
              <p style={{ fontFamily: "'Share Tech Mono'", fontSize: '0.62rem', letterSpacing: '0.35em', color: 'var(--red)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                — Content Management
              </p>
              <h1 className="admin-title">The <span>Den</span></h1>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link href="/" className="btn-view" style={{ padding: '8px 16px' }}>← View Site</Link>
              <button className="admin-logout" onClick={logout}>Logout</button>
            </div>
          </div>

          {/* Status bar */}
          {status && (
            <div className={`status-bar ${status.type}`}>
              <span className="status-dot-sm" />{status.msg}
            </div>
          )}

          {/* ── ROW 1: Write-ups + Projects drop zones ── */}
          <div style={{ marginBottom: '2.5rem' }}>
            <p className="admin-section-title">
              Upload Content
              <span>Obsidian frontmatter · ![[images]] · GFM supported</span>
            </p>
            <div className="admin-grid-2">
              <div>
                <p style={{ fontFamily: "'Share Tech Mono'", fontSize: '0.6rem', letterSpacing: '0.25em', color: 'var(--white-dim)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                  ✍ Write-ups → content/
                </p>
                <DropZone
                  type="post"
                  icon="📝"
                  label="Drop Write-up (.md)"
                  csrfToken={csrf}
                  onSuccess={msg => { showStatus('success', `✓ ${msg}`); fetchPosts(); }}
                  onError={msg => showStatus('error', `✗ ${msg}`)}
                />
              </div>
              <div>
                <p style={{ fontFamily: "'Share Tech Mono'", fontSize: '0.6rem', letterSpacing: '0.25em', color: 'var(--white-dim)', textTransform: 'uppercase', marginBottom: '0.6rem' }}>
                  ⚙ Projects → content/projects/
                </p>
                <DropZone
                  type="project"
                  icon="🛠"
                  label="Drop Project (.md)"
                  csrfToken={csrf}
                  onSuccess={msg => { showStatus('success', `✓ ${msg}`); fetchProjects(); }}
                  onError={msg => showStatus('error', `✗ ${msg}`)}
                />
              </div>
            </div>
          </div>

          {/* ── ROW 2: Images + About ── */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div className="admin-grid-2">
              <div>
                <p className="admin-section-title">
                  Images
                  <span>Upload then use /images/filename.png in markdown</span>
                </p>
                <ImageDropZone
                  csrfToken={csrf}
                  onSuccess={(name, path) => {
                    showStatus('success', `✓ "${name}" uploaded — use: ${path}`);
                    fetchImages();
                  }}
                  onError={msg => showStatus('error', `✗ ${msg}`)}
                />
                {/* Image grid */}
                {!loadingImages && images.length > 0 && (
                  <div className="image-grid">
                    {images.map(img => (
                      <div className="image-thumb" key={img.name} title={img.name}>
                        <img src={img.url} alt={img.name} />
                        <div className="image-thumb-overlay">
                          <span className="image-thumb-name">{img.name}</span>
                          <span className="image-thumb-path">/images/{img.name}</span>
                          <button className="image-thumb-del" onClick={() => deleteImage(img)}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="admin-section-title">
                  About Page
                  <span>Replaces content/about.md on GitHub</span>
                </p>
                <DropZone
                  type="about"
                  icon="👤"
                  label="Drop about.md"
                  csrfToken={csrf}
                  onSuccess={msg => showStatus('success', `✓ ${msg}`)}
                  onError={msg => showStatus('error', `✗ ${msg}`)}
                />
                <p style={{ fontFamily: "'Share Tech Mono'", fontSize: '0.58rem', letterSpacing: '0.12em', color: 'var(--white-dim)', marginTop: '0.75rem', lineHeight: '1.7' }}>
                  File must be named <span style={{ color: 'var(--red)' }}>about.md</span> — any filename will be saved as the about page. Supports images, code blocks, and full markdown.
                </p>
              </div>
            </div>
          </div>

          {/* ── ROW 3: Published Write-ups ── */}
          <div className="admin-table-wrap">
            <p className="admin-section-title">
              Published Write-ups
              <span>{loadingPosts ? 'loading…' : `${posts.length} post${posts.length !== 1 ? 's' : ''}`}</span>
            </p>
            {loadingPosts
              ? <div className="admin-empty"><div className="spinner" style={{ margin: '0 auto 1rem' }} /><p>Fetching from GitHub…</p></div>
              : <PostsTable posts={posts} csrfToken={csrf}
                  onDeleteSuccess={msg => { showStatus('success', `✓ ${msg}`); fetchPosts(); }}
                  onDeleteError={msg => showStatus('error', `✗ ${msg}`)}
                  onRefresh={fetchPosts}
                  viewPrefix="/blog"
                />
            }
          </div>

          {/* ── ROW 4: Published Projects ── */}
          <div className="admin-table-wrap">
            <p className="admin-section-title">
              Published Projects
              <span>{loadingProjects ? 'loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}</span>
            </p>
            {loadingProjects
              ? <div className="admin-empty"><div className="spinner" style={{ margin: '0 auto 1rem' }} /><p>Fetching from GitHub…</p></div>
              : <PostsTable posts={projects} csrfToken={csrf}
                  onDeleteSuccess={msg => { showStatus('success', `✓ ${msg}`); fetchProjects(); }}
                  onDeleteError={msg => showStatus('error', `✗ ${msg}`)}
                  onRefresh={fetchProjects}
                  viewPrefix="/projects"
                  deleteEndpoint="/api/admin/projects"
                />
            }
          </div>

          {/* How it works */}
          <div style={{ marginTop: '2rem', padding: '1.25rem', border: '1px solid var(--border)', fontFamily: "'Share Tech Mono'", fontSize: '0.6rem', color: 'var(--white-dim)', letterSpacing: '0.1em', lineHeight: '2' }}>
            <p style={{ color: 'var(--red)', marginBottom: '0.4rem', letterSpacing: '0.2em' }}>HOW IT WORKS</p>
            <p>① Upload any .md file → committed to GitHub automatically</p>
            <p>② For images: upload image first → copy the path → paste into your .md</p>
            <p>③ Obsidian ![[image.png]] links auto-resolve if image is uploaded</p>
            <p>④ Vercel detects the push and rebuilds — live in ~2 min</p>
          </div>

        </div>
      </div>
    </>
  );
}
