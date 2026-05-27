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
      style={{ background: 'linear-gradient(135deg, var(--color-garuda-800) 0%, var(--color-garuda-600) 100%)' }}
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
            background: '#ffffff',
            border: '1px solid var(--color-garuda-700)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-garuda-100)' }}>Sign in to your account</h2>

          {error && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm animate-fade-in"
              style={{ background: 'rgba(220, 38, 38, 0.08)', color: 'var(--color-danger-500)', border: '1px solid rgba(220, 38, 38, 0.2)' }}
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
                className="input"
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
                className="input"
                placeholder="Enter password"
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg w-full"
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
