import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Trigger wink animation — remove and re-add class so it replays on every hover
  const handleMouseEnter = () => {
    const el = imgRef.current;
    if (!el) return;
    el.classList.remove('wink');
    void el.offsetWidth; // force reflow to restart animation
    el.classList.add('wink');
  };

  const handleMouseLeave = () => {
    imgRef.current?.classList.remove('wink');
  };

  return (
    <>
      <style>{`
        .logo-img-wrap {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          overflow: hidden;
          border: 1.5px solid #cc1111;
          flex-shrink: 0;
          cursor: pointer;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .nav-logo:hover .logo-img-wrap {
          border-color: #ff2222;
          box-shadow: 0 0 14px rgba(204,17,17,0.4);
        }
        .logo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transform-origin: center bottom;
        }
        .logo-img.wink {
          animation: wink-anim 0.65s ease forwards;
        }
        @keyframes wink-anim {
          0%   { transform: rotate(0deg)   scale(1)    scaleY(1);    filter: brightness(1); }
          18%  { transform: rotate(-8deg)  scale(1.13) scaleY(1);    filter: brightness(1.1) drop-shadow(0 0 6px #cc1111); }
          30%  { transform: rotate(-8deg)  scale(1.13) scaleY(0.06); filter: brightness(1.1) drop-shadow(0 0 6px #cc1111); }
          44%  { transform: rotate(-8deg)  scale(1.13) scaleY(1);    filter: brightness(1.1) drop-shadow(0 0 6px #cc1111); }
          62%  { transform: rotate(-4deg)  scale(1.06) scaleY(1);    filter: brightness(1.05); }
          100% { transform: rotate(0deg)   scale(1)    scaleY(1);    filter: brightness(1); }
        }
      `}</style>

      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <Link href="/" className="nav-logo">
        <div className="logo-mark">A</div>
            
        </Link>
        <ul className="nav-links">
          <li><Link href="/#writeups">Write-ups</Link></li>
          <li><Link href="/#projects">Projects</Link></li>
          <li><Link href="/about">About</Link></li>
        </ul>

        <a
          href="https://app.hackthebox.com/users/627461"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-cta"
        >
          HACKTHEBOX
        </a>
      </nav>
    </>
  );
}
