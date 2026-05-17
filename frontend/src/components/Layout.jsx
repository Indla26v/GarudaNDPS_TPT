import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Build navigation items dynamically based on user permissions.
 * Items only appear if the user has the required permission.
 */
function useNavItems() {
  const perms = usePermissions();

  const items = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊', show: true },
    { path: '/offenders', label: 'Offenders', icon: '👤', show: true },
    { path: '/cases', label: 'Cases', icon: '📁', show: true },
    { path: '/deletion-requests', label: 'Deletions', icon: '🗑️', show: true },
    { path: '/edit-requests', label: 'Edit Requests', icon: '✏️', show: perms.canApproveEdit || perms.canRequestEdit },
    { path: '/district-analytics', label: 'District Analytics', icon: '📈', show: perms.canViewDistrictAnalytics },
    { path: '/admin/users', label: 'User Management', icon: '👥', show: perms.canViewUserManagement },
    { path: '/admin/audit-logs', label: 'Audit Logs', icon: '📋', show: perms.canViewAuditLogs },
  ];

  return items.filter(item => item.show);
}

/**
 * Role badge color mapping for the header.
 */
const ROLE_COLORS = {
  ADMIN:     { bg: '#ef4444', text: '#fff' },
  SP:        { bg: '#8b5cf6', text: '#fff' },
  DSP:       { bg: '#3b82f6', text: '#fff' },
  CI:        { bg: '#22c55e', text: '#fff' },
  SI:        { bg: '#f59e0b', text: '#000' },
  CONSTABLE: { bg: '#6b7280', text: '#fff' },
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navItems = useNavItems();
  const roleColor = ROLE_COLORS[user?.role] || ROLE_COLORS.CONSTABLE;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ---- Sidebar ---- */}
      <aside
        className={`${sidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 flex flex-col`}
        style={{ background: 'var(--color-garuda-800)', borderRight: '1px solid var(--color-garuda-700)' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 px-4 py-5" style={{ borderBottom: '1px solid var(--color-garuda-700)' }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--color-accent-500), var(--color-accent-400))' }}
          >
            G
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-bold tracking-wide" style={{ color: 'var(--color-garuda-50)' }}>GARUDA</h1>
              <p className="text-xs" style={{ color: 'var(--color-garuda-400)' }}>Anti-Drug Intelligence</p>
            </div>
          )}
        </div>

        {/* Nav Items — conditionally rendered based on role permissions */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                id={`nav-${item.path.replace(/\//g, '-').replace(/^-/, '')}`}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active ? 'text-white' : 'hover:text-white'
                }`}
                style={{
                  background: active ? 'var(--color-garuda-600)' : 'transparent',
                  color: active ? 'white' : 'var(--color-garuda-300)',
                }}
              >
                <span className="text-lg">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="px-4 py-3 text-sm transition-colors cursor-pointer"
          style={{ color: 'var(--color-garuda-400)', borderTop: '1px solid var(--color-garuda-700)' }}
        >
          {sidebarOpen ? '← Collapse' : '→'}
        </button>
      </aside>

      {/* ---- Main Content ---- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="flex items-center justify-between px-6 py-3"
          style={{ background: 'var(--color-garuda-800)', borderBottom: '1px solid var(--color-garuda-700)' }}
        >
          <div />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium" style={{ color: 'var(--color-garuda-100)' }}>{user?.fullName}</p>
              <span
                className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: roleColor.bg, color: roleColor.text }}
              >
                {user?.role}
              </span>
            </div>
            <button
              id="btn-logout"
              onClick={logout}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer"
              style={{ background: 'var(--color-garuda-700)', color: 'var(--color-garuda-200)' }}
            >
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--color-garuda-900)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
