import { useState } from 'react';
import Link from 'next/link';

export default function Footer() {
  const [email, setEmail] = useState('');
  const [joined, setJoined] = useState(false);

  const handleSubscribe = () => {
    if (email && email.includes('@')) {
      setJoined(true);
      setEmail('');
    }
  };

  return (
    <>
      {/* Contact / Newsletter */}
      <section className="contact section" id="contact">
        <div className="contact-inner">
          <p className="section-label" style={{ justifyContent: 'center' }}>Stay in the Loop</p>
          <h2 className="section-title reveal">Never Miss a <span>Drop</span></h2>
          <p className="contact-subtitle reveal">
            New write-ups, project launches, and occasional rants — straight to your inbox.
          </p>
          <div className="subscribe-form reveal">
            {joined ? (
              <p style={{ fontFamily: 'Share Tech Mono', fontSize: '0.75rem', color: '#22cc66', letterSpacing: '0.2em' }}>
                ✓ YOU&apos;RE IN — STAY SHARP.
              </p>
            ) : (
              <>
                <input
                  type="email"
                  className="subscribe-input"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
                />
                <button className="subscribe-btn" onClick={handleSubscribe}>Subscribe</button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="about">
        <div className="footer-inner">
          <div>
            <Link href="/" className="nav-logo" style={{ marginBottom: '1.2rem', display: 'inline-flex' }}>
              <div className="logo-mark">A</div>
              Dante&apos;s blog
            </Link>
            <p className="footer-tagline">
              A blog about figuring out how things work right after somebody else breaks them.
            </p>
            <div className="social-links">
              <a href="#" className="social-link">GH</a>
              <a href="#" className="social-link">LI</a>
              <a href="#" className="social-link">DS</a>
              <a href="#" className="social-link">SP</a>
            </div>
          </div>

          <div>
            <p className="footer-col-title">Write-ups</p>
            <ul className="footer-links">
              <li><Link href="/#writeups">Security</Link></li>
              <li><Link href="/#writeups">Systems</Link></li>
              <li><Link href="/#writeups">Performance</Link></li>
              <li><Link href="/#writeups">Tools</Link></li>
            </ul>
          </div>

          <div>
            <p className="footer-col-title">Projects</p>
            <ul className="footer-links">
              <li><a href="#">Grimoire</a></li>
              <li><a href="#">Phantom</a></li>
              <li><a href="https://images.meme-arsenal.com/2956f23ac1dfecb0aef3284bc74eb816.jpg">Vergil</a></li>
              <li><a href="#">RedLine</a></li>
            </ul>
          </div>

          <div>
            <p className="footer-col-title">Meta</p>
            <ul className="footer-links">
              <li><Link href="/about">About</Link></li>
              <li><a href="#">RSS Feed</a></li>
              <li><Link href="/#contact">Contact</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Dante&apos;s Blog. All rights reserved.</span>
          <span>Built with blood, sweat &amp; Caffeine.</span>
        </div>
      </footer>
    </>
  );
}
