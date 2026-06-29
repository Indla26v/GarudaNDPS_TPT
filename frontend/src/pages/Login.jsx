import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apLogo from '../assets/Appolice(emblem).png';
import garudaLogo from '../assets/Garuda_logo.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [idleLogout, setIdleLogout] = useState(false);
  const { login, loading } = useAuth();
  const navigate = useNavigate();

  // Check if user was logged out due to inactivity
  useEffect(() => {
    if (sessionStorage.getItem('garuda_idle_logout') === 'true') {
      setIdleLogout(true);
      sessionStorage.removeItem('garuda_idle_logout');
    }
  }, []);

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

  const handleQuickLogin = async (usr) => {
    setUsername(usr);
    setPassword('password123');
    setError('');
    const result = await login(usr, 'password123');
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
        <div className="flex items-center justify-center gap-8 mb-8">
          <img 
            src={apLogo}
            alt="AP Police Logo" 
            className="w-24 h-24 object-contain drop-shadow-lg"
          />
          <img 
            src={garudaLogo}
            alt="Garuda Logo" 
            className="w-auto h-24 object-contain drop-shadow-lg"
          />
        </div>

        {/* Login Card */}
        <div
          className="rounded-xl p-8"
          style={{
            background: 'var(--color-garuda-800)',
            border: '1px solid var(--color-garuda-700)',
            boxShadow: 'var(--shadow-elevated)',
          }}
        >
          <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--color-garuda-100)' }}>Sign in to your account</h2>

          {idleLogout && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-sm animate-fade-in flex items-center gap-2"
              style={{ background: 'rgba(234, 179, 8, 0.08)', color: '#b45309', border: '1px solid rgba(234, 179, 8, 0.25)' }}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Session expired due to 15 minutes of inactivity. Please sign in again.
            </div>
          )}

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
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input pr-10"
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                  tabIndex="-1"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
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

          {/* Quick Login Section */}
          <div className="mt-6 pt-5 border-t" style={{ borderColor: 'var(--color-garuda-700)' }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2.5 text-center" style={{ color: 'var(--color-garuda-400)' }}>Developer Quick Logins</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleQuickLogin('sp')} className="btn btn-secondary text-xs text-left cursor-pointer transition-all p-2 flex items-center justify-start gap-1">
                👑 District SP
              </button>
              <button onClick={() => handleQuickLogin('asp')} className="btn btn-secondary text-xs text-left cursor-pointer transition-all p-2 flex items-center justify-start gap-1">
                ⚡ Task Force ASP
              </button>
              <button onClick={() => handleQuickLogin('sdpo')} className="btn btn-secondary text-xs text-left cursor-pointer transition-all p-2 flex items-center justify-start gap-1">
                👮 Renigunta SDPO
              </button>
              <button onClick={() => handleQuickLogin('sho')} className="btn btn-secondary text-xs text-left cursor-pointer transition-all p-2 flex items-center justify-start gap-1">
                📝 Station SHO
              </button>
              <button onClick={() => handleQuickLogin('cyber_sdpo')} className="btn btn-secondary text-xs text-left cursor-pointer transition-all p-2 flex items-center justify-start gap-1">
                🌐 Cyber SDPO
              </button>
              <button onClick={() => handleQuickLogin('excise_sho')} className="btn btn-secondary text-xs text-left cursor-pointer transition-all p-2 flex items-center justify-start gap-1">
                🍇 Excise SHO
              </button>
            </div>
          </div>

          <p className="text-xs text-center mt-6" style={{ color: 'var(--color-garuda-500)' }}>
            Authorized personnel only. All access is monitored.
          </p>
        </div>
      </div>
    </div>
  );
}
