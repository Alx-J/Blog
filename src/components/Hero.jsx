import Link from 'next/link';

export default function Hero({ postCount = 0, proCount = 0 }) {
  return (
    <section className="hero">
      <div className="hero-bg" />
      <div className="hero-shard" />
      <div className="hero-orb" />

      <div className="hero-content">
        <p className="hero-eyebrow">Est. 2021 &nbsp;·&nbsp; Thought I was dead? Hah! Too bad!</p>

        <h1 className="hero-title">
          <span className="line-1">DANTE&apos;S</span>
          <span className="line-2">
            <span className="glitch" data-text="THOUGHTS">THOUGHTS</span>
          </span>
        </h1>

        <p className="hero-subtitle">
          The systems were already broken. I just gave them a more dramatic ending. - welcome to the Devil’s Workshop.
        </p>

        <div className="hero-actions">
          <Link href="#writeups" className="btn-primary">Explore Write-ups</Link>
          <Link href="#projects" className="btn-secondary">View Projects</Link>
        </div>
      </div>

      <div className="hero-stats">
        <div className="stat">
          <div className="stat-num">{postCount}</div>
          <div className="stat-label">Write-ups</div>
        </div>
        <div className="stat">
          <div className="stat-num">{proCount}</div>
          <div className="stat-label">Projects</div>
        </div>
        <div className="stat">
          <div className="stat-num">∞</div>
          <div className="stat-label">Style</div>
        </div>
      </div>

      <div className="scroll-indicator">
        <div className="scroll-line" />
      </div>
    </section>
  );
}