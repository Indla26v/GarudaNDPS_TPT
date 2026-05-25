import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(username, password);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.message);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, var(--color-garuda-900) 0%, #0d1f3c 50%, var(--color-garuda-800) 100%)' }}
    >
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl font-black text-white"
            style={{
              background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-300))',
              boxShadow: 'var(--shadow-glow)',
            }}
          >
            N
          </div>
          <h1 className="text-2xl font-bold tracking-tight px-4" style={{ color: 'var(--color-garuda-50)', lineHeight: '1.2' }}>
            NDPS Monitoring & Intelligence Management System
          </h1>
          <p className="text-xs mt-2 uppercase tracking-wider font-semibold" style={{ color: 'var(--color-accent-400)' }}>
            Tirupati District Police & Excise Department
          </p>
        </div>

        {/* Login Card */}
        <div
          className="rounded-xl p-8"
          style={{
            background: 'rgba(26, 42, 74, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid var(--color-garuda-600)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-garuda-100)' }}>Sign in to your account</h2>

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm animate-fade-in"
              style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-danger-400)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-garuda-300)' }}>Username</label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
                style={{
                  background: 'var(--color-garuda-700)',
                  border: '1px solid var(--color-garuda-600)',
                  color: 'var(--color-garuda-50)',
                }}
                placeholder="Enter username"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-garuda-300)' }}>Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-all duration-200"
                style={{
                  background: 'var(--color-garuda-700)',
                  border: '1px solid var(--color-garuda-600)',
                  color: 'var(--color-garuda-50)',
                }}
                placeholder="Enter password"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-200 cursor-pointer"
              style={{
                background: loading
                  ? 'var(--color-garuda-600)'
                  : 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-400))',
                boxShadow: loading ? 'none' : 'var(--shadow-glow)',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: 'var(--color-garuda-500)' }}>
            Authorized personnel only. All access is monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
