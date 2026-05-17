import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

/**
 * Build navigation items dynamically based on user permissions.
 * Items only appear if the user has the required permission.
 * Grouped by section for visual clarity.
 */
function useNavItems() {
  const perms = usePermissions();

  // Admin only sees Administration section
  if (perms.isAdmin) {
    return [
      {
        title: 'Administration',
        items: [
          { path: '/admin/users', label: 'User Management', icon: '👥', show: true },
          { path: '/admin/teams', label: 'Team Management', icon: '🏢', show: true },
          { path: '/admin/audit-logs', label: 'Audit Logs', icon: '📜', show: true },
        ],
      },
    ];
  }

  // All other roles see operational sections (but NOT Administration)
  const sections = [
    {
      title: 'Operations',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: '📊', show: true },
        { path: '/offenders', label: 'Offenders', icon: '👤', show: true },
        { path: '/cases', label: 'Cases', icon: '📋', show: true },
        { path: '/mobile', label: 'Field Staff', icon: '📱',
          show: perms.canFieldEntry || perms.canSurveillanceReport || perms.canVerifyAccused || perms.hasMinRole('SP') },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        { path: '/surveillance', label: 'Surveillance', icon: '📡',
          show: perms.canViewAllTech || perms.canAddTechIntel || perms.hasMinRole('CI') },
        { path: '/finance', label: 'Financial', icon: '💰',
          show: perms.canViewAllFinance || perms.isFinCell || perms.hasMinRole('DSP') },
        { path: '/network', label: 'Network Map', icon: '🕸️',
          show: perms.canViewAllNetwork || perms.canBuildNetwork || perms.hasMinRole('DSP') },
      ],
    },
    {
      title: 'Reports',
      items: [
        { path: '/reports', label: 'Reports', icon: '📄',
          show: perms.canViewAllReports || perms.canBuildCustomReport || perms.hasMinRole('SI') },
        { path: '/district-analytics', label: 'District Analytics', icon: '🗺️',
          show: perms.canViewDistrictAnalytics },
      ],
    },
    {
      title: 'Workflows',
      items: [
        { path: '/deletion-requests', label: 'Deletions', icon: '🗑️', show: true },
        { path: '/edit-requests', label: 'Edit Requests', icon: '✏️',
          show: perms.canApproveEdit || perms.canRequestEdit },
      ],
    },
  ];

  return sections
    .map(section => ({
      ...section,
      items: section.items.filter(item => item.show),
    }))
    .filter(section => section.items.length > 0);
}

/**
 * Role badge color mapping for the header — all 15 roles.
 */
const ROLE_COLORS = {
  ADMIN:     { bg: '#ef4444', text: '#fff' },
  SP:        { bg: '#8b5cf6', text: '#fff' },
  ASP:       { bg: '#6366f1', text: '#fff' },
  DSP:       { bg: '#3b82f6', text: '#fff' },
  CI:        { bg: '#22c55e', text: '#fff' },
  SI:        { bg: '#f59e0b', text: '#000' },
  CONSTABLE: { bg: '#6b7280', text: '#fff' },
};

/** Display-friendly role labels */
const ROLE_LABELS = {
  ADMIN:     'Admin',
  SP:        'SP',
  ASP:       'ASP',
  DSP:       'DSP',
  CI:        'CI (SHO)',
  SI:        'SI',
  CONSTABLE: 'Constable',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const navSections = useNavItems();
  const roleColor = ROLE_COLORS[user?.role] || ROLE_COLORS.CONSTABLE;
  const roleLabel = ROLE_LABELS[user?.role] || user?.role;

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

        {/* Nav Items — grouped by section, conditionally rendered based on role */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navSections.map((section, si) => (
            <div key={section.title} className={si > 0 ? 'mt-4' : ''}>
              {sidebarOpen && (
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
                  style={{ color: 'var(--color-garuda-500)' }}
                >
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
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
                      <span className="text-base flex-shrink-0">{item.icon}</span>
                      {sidebarOpen && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
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
                {roleLabel}
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
