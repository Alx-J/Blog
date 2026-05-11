import Link from 'next/link';

export default function FeaturedPost({ post }) {
  if (!post) return null;

  return (
    <section className="featured section">
      <div className="featured-inner">
        <div className="featured-visual reveal">
          <div className="featured-visual-bg" />
          <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="200" cy="200" r="160" stroke="red" strokeWidth="0.5" />
            <circle cx="200" cy="200" r="120" stroke="red" strokeWidth="0.5" />
            <circle cx="200" cy="200" r="80"  stroke="red" strokeWidth="0.5" />
            <polygon points="200,40 238,158 360,158 264,232 300,350 200,276 100,350 136,232 40,158 162,158" fill="none" stroke="red" strokeWidth="0.8" />
            <line x1="200" y1="40"  x2="200" y2="360" stroke="red" strokeWidth="0.4" />
            <line x1="40"  y1="200" x2="360" y2="200" stroke="red" strokeWidth="0.4" />
            <line x1="71"  y1="71"  x2="329" y2="329" stroke="red" strokeWidth="0.4" />
            <line x1="329" y1="71"  x2="71"  y2="329" stroke="red" strokeWidth="0.4" />
            <circle cx="200" cy="200" r="12" stroke="red" strokeWidth="1" />
            <circle cx="200" cy="200" r="4"  fill="red" />
          </svg>
          <div className="featured-tag">✦ Latest Post</div>
          <div className="featured-num">01</div>
        </div>

        <div className="reveal reveal-delay-1">
          <div className="featured-category">{post.category}</div>
          <div className="featured-divider" />
          <h2 className="featured-title">{post.title}</h2>
          <p className="featured-excerpt">{post.description}</p>
          <div className="featured-meta">
            <span>{post.date}</span>
            <span className="dot" />
            <span>{post.readTime}</span>
          </div>
          <Link href={`/blog/${post.slug}`} className="btn-primary" style={{ marginTop: '1.5rem' }}>
            Read Article →
          </Link>
        </div>
      </div>
    </section>
  );
}
