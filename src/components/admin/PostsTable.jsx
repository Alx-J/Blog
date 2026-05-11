import { useState } from 'react';
import Link from 'next/link';

export default function PostsTable({
  posts,
  csrfToken,
  onDeleteSuccess,
  onDeleteError,
  onRefresh,
  viewPrefix = '/blog',
  deleteEndpoint = '/api/admin/posts',
}) {
  const [deleting, setDeleting] = useState(null);
  const [confirmSlug, setConfirmSlug] = useState(null);

  const handleDelete = async (slug, sha) => {
    if (confirmSlug !== slug) {
      setConfirmSlug(slug);
      setTimeout(() => setConfirmSlug(s => (s === slug ? null : s)), 3000);
      return;
    }
    setDeleting(slug);
    setConfirmSlug(null);
    try {
      const res = await fetch(`${deleteEndpoint}/${slug}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ sha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      onDeleteSuccess(`"${slug}" deleted from GitHub.`);
      onRefresh();
    } catch (err) {
      onDeleteError(err.message);
    } finally {
      setDeleting(null);
    }
  };

  if (!posts?.length) {
    return <div className="admin-empty"><p>Nothing here yet — upload a .md file above</p></div>;
  }

  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th style={{ width: '48px' }}>#</th>
          <th>Title</th>
          <th>Category / Status</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post, i) => (
          <tr key={post.slug}>
            <td style={{ color: 'var(--red)', fontFamily: "'Bebas Neue'", fontSize: '1.2rem' }}>
              {String(i + 1).padStart(2, '0')}
            </td>
            <td>
              <div className="td-title">{post.title}</div>
              <div style={{ fontSize: '0.58rem', color: 'var(--white-dim)', marginTop: '2px', opacity: 0.5, fontFamily: 'Share Tech Mono' }}>
                {post.slug}.md
              </div>
            </td>
            <td className="td-cat">{post.category || post.status || '—'}</td>
            <td>{post.date || '—'}</td>
            <td>
              <div className="td-actions">
                <Link href={`${viewPrefix}/${post.slug}`} className="btn-view" target="_blank" rel="noopener noreferrer">
                  View ↗
                </Link>
                <button
                  className="btn-delete"
                  disabled={deleting === post.slug}
                  onClick={() => handleDelete(post.slug, post.sha)}
                  style={confirmSlug === post.slug
                    ? { background: 'var(--red)', color: 'var(--white)', borderColor: 'var(--red)' }
                    : {}}
                >
                  {deleting === post.slug ? '…' : confirmSlug === post.slug ? 'Confirm?' : 'Delete'}
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
