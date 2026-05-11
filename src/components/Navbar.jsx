import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

export default function Navbar() {
  const [scrolled, setScrolled]   = useState(false);
  const [menuOpen, setMenuOpen]   = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Close menu on route change / resize
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const handleMouseEnter = () => {
    const el = imgRef.current;
    if (!el) return;
    el.classList.remove('wink');
    void el.offsetWidth;
    el.classList.add('wink');
  };
  const handleMouseLeave = () => imgRef.current?.classList.remove('wink');

  return (
    <>
      <style>{`
        .logo-img-wrap {
          width: 38px; height: 38px; border-radius: 50%;
          overflow: hidden; border: 1.5px solid #cc1111;
          flex-shrink: 0; cursor: pointer;
          transition: border-color 0.3s, box-shadow 0.3s;
        }
        .nav-logo:hover .logo-img-wrap {
          border-color: #ff2222;
          box-shadow: 0 0 14px rgba(204,17,17,0.4);
        }
        .logo-img {
          width: 100%; height: 100%; object-fit: cover;
          display: block; transform-origin: center bottom;
        }
        .logo-img.wink { animation: wink-anim 0.65s ease forwards; }
        @keyframes wink-anim {
          0%   { transform: rotate(0deg)  scale(1)    scaleY(1);    filter: brightness(1); }
          18%  { transform: rotate(-8deg) scale(1.13) scaleY(1);    filter: brightness(1.1) drop-shadow(0 0 6px #cc1111); }
          30%  { transform: rotate(-8deg) scale(1.13) scaleY(0.06); filter: brightness(1.1) drop-shadow(0 0 6px #cc1111); }
          44%  { transform: rotate(-8deg) scale(1.13) scaleY(1);    filter: brightness(1.1) drop-shadow(0 0 6px #cc1111); }
          62%  { transform: rotate(-4deg) scale(1.06) scaleY(1);    filter: brightness(1.05); }
          100% { transform: rotate(0deg)  scale(1)    scaleY(1);    filter: brightness(1); }
        }

        /* ── Hamburger button ── */
        .hamburger {
          display: none;
          flex-direction: column; justify-content: center;
          gap: 5px; width: 36px; height: 36px;
          background: none; border: none; cursor: pointer;
          padding: 4px; z-index: 1100;
        }
        .hamburger span {
          display: block; width: 22px; height: 1.5px;
          background: #f0ece8; transition: all 0.3s; transform-origin: center;
        }
        .hamburger.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
        .hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .hamburger.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

        /* ── Mobile menu overlay ── */
        .mobile-menu {
          display: none;
          position: fixed; inset: 0; z-index: 1050;
          background: rgba(8,8,8,0.97);
          flex-direction: column; align-items: center; justify-content: center;
          gap: 0;
          border-top: 1px solid #4a1010;
        }
        .mobile-menu.open { display: flex; }
        .mobile-menu-link {
          font-family: 'Cinzel', serif; font-size: 1.2rem; font-weight: 600;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: #a09890; text-decoration: none;
          padding: 1.2rem 2rem; width: 100%; text-align: center;
          border-bottom: 1px solid #2a0a0a;
          transition: color 0.3s, background 0.3s;
        }
        .mobile-menu-link:hover { color: #f0ece8; background: rgba(204,17,17,0.05); }
        .mobile-menu-htb {
          font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: #cc1111; text-decoration: none;
          border: 1px solid #cc1111; padding: 14px 40px;
          margin-top: 2rem; transition: all 0.3s;
        }
        .mobile-menu-htb:hover { background: #cc1111; color: #f0ece8; }

        @media (max-width: 900px) {
          .hamburger { display: flex; }
          .nav-cta   { display: none; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <Link
          href="/"
          className="nav-logo"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="logo-mark">A</div>
        </Link>

        {/* Desktop links */}
        <ul className="nav-links">
          <li><Link href="/#writeups">Write-ups</Link></li>
          <li><Link href="/#projects">Projects</Link></li>
          <li><Link href="/about">About</Link></li>
        </ul>

        {/* Desktop HTB button */}
        <a
          href="https://app.hackthebox.com/users/627461"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-cta"
        >
          HACKTHEBOX
        </a>

        {/* Hamburger — mobile only */}
        <button
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Toggle menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      {/* ── Mobile menu ── */}
      <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
        <Link href="/#writeups" className="mobile-menu-link" onClick={closeMenu}>Write-ups</Link>
        <Link href="/#projects" className="mobile-menu-link" onClick={closeMenu}>Projects</Link>
        <Link href="/about"     className="mobile-menu-link" onClick={closeMenu}>About</Link>
        <a
          href="https://app.hackthebox.com/users/627461"
          target="_blank"
          rel="noopener noreferrer"
          className="mobile-menu-htb"
          onClick={closeMenu}
        >
          HACKTHEBOX
        </a>
      </div>
    </>
  );
}
