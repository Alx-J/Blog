import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed.');
        setPassword('');
        return;
      }

      // Store CSRF token in sessionStorage for use in admin requests
      sessionStorage.setItem('csrf_token', data.csrfToken);
      router.push('/admin');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Admin Login — DANTE</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="login-wrap">
        <div className="login-bg" />
        <div className="login-orb" />

        <div className="login-box">
          <div className="login-box-corner tl" />
          <div className="login-box-corner tr" />
          <div className="login-box-corner bl" />
          <div className="login-box-corner br" />

          {/* Sigil */}
          <svg viewBox="0 0 120 120" width="60" height="60" style={{ display: 'block', margin: '0 auto 1.5rem', opacity: 0.3 }}>
            <circle cx="60" cy="60" r="55" stroke="#cc1111" strokeWidth="0.8" fill="none" />
            <polygon points="60,8 72,48 112,48 80,72 92,112 60,88 28,112 40,72 8,48 48,48" fill="none" stroke="#cc1111" strokeWidth="0.8" />
            <circle cx="60" cy="60" r="6" stroke="#cc1111" strokeWidth="0.8" fill="none" />
            <circle cx="60" cy="60" r="2" fill="#cc1111" />
          </svg>

          <div className="login-logo">Devil&apos;s Edge</div>
          <div className="login-sub">Admin Access</div>

          <form onSubmit={handleLogin} autoComplete="off">
            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Access Key
              </label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="form-error">
                ⚠ {error}
              </div>
            )}

            <button type="submit" className="form-submit" disabled={loading || !password}>
              {loading ? 'Authenticating…' : 'Enter'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
