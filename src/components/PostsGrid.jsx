import { useEffect, useRef } from 'react';
import Link from 'next/link';

function PostCard({ post, index }) {
  return (
    <Link href={`/blog/${post.slug}`} className="post-card">
      <div className="post-card-corner" />
      <div className="post-number">{String(index + 1).padStart(2, '0')}</div>
      <div className="post-cat">🔴 {post.category}</div>
      <h3 className="post-title">{post.title}</h3>
      <p className="post-excerpt">{post.description}</p>
      <div className="post-footer">
        <span>{post.date} · {post.readTime}</span>
        <span className="post-arrow">→</span>
      </div>
    </Link>
  );
}

export default function PostsGrid({ posts }) {
  const gridRef = useRef(null);

  // Intersection observer for reveal animation on cards
  useEffect(() => {
    if (!gridRef.current) return;
    const cards = gridRef.current.querySelectorAll('.post-card');
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.style.opacity = '1';
          e.target.style.transform = 'translateY(0)';
        }
      }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    cards.forEach((c, i) => {
      c.style.opacity = '0';
      c.style.transform = 'translateY(30px)';
      c.style.transition = `opacity 0.6s ${i * 0.08}s, transform 0.6s ${i * 0.08}s`;
      obs.observe(c);
    });
    return () => obs.disconnect();
  }, [posts]);

  if (!posts?.length) {
    return (
      <div className="posts-empty">
        <div className="posts-empty-icon">🩸</div>
        <p>No write-ups yet — check back soon</p>
      </div>
    );
  }

  return (
    <div className="posts-grid" ref={gridRef}>
      {posts.map((post, i) => (
        <PostCard key={post.slug} post={post} index={i} />
      ))}
    </div>
  );
}
