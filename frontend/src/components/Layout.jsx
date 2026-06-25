import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import apLogo from '../assets/Appolice(emblem).png';
import garudaLogo from '../assets/Garuda_logo.png';
import cmPhoto from '../assets/hcYSD6hIE5ps-20Aagn4hwbA_zFMHouPHepwjcXoZss.avif';
import apEmblem from '../assets/Emblem_of_Andhra_Pradesh.svg.png';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import api from '../api/axios';
import GlobalLoader from './GlobalLoader';
import {
  IconDashboard, IconOffender, IconConsumer, IconCases, IconFieldStaff,
  IconSurveillance, IconFinance, IconNetwork, IconReports, IconMap,
  IconTrash, IconEdit, IconUsers, IconBuilding, IconAuditLog, IconImport,
  IconShield, IconVehicle,
} from './Icons';

/**
 * Build navigation items dynamically based on user permissions AND department.
 * Items only appear if the user has the required permission + department.
 * SP/ASP do NOT get blanket access to Intelligence items — they must be
 * in the correct department.
 * Grouped by section for visual clarity.
 */
function useNavItems() {
  const perms = usePermissions();

  // All roles see operational sections
  // SP also sees Administration section
  // Department-restricted items check the user's actual department
  const sections = [
    {
      title: 'Operations',
      items: [
        { path: '/dashboard', label: 'Dashboard', icon: IconDashboard, show: true },
        { path: '/cases', label: 'Cases', icon: IconCases, show: true },
        { path: '/consumers', label: 'Consumers', icon: IconConsumer, show: true },
        { path: '/offenders', label: 'Offenders', icon: IconOffender, show: true },
        { path: '/vehicles-seized', label: 'Vehicles Seized', icon: IconVehicle, show: true },
        { path: '/enforcement', label: 'Enforcement', icon: IconShield, show: true },
        {
          path: '/mobile', label: 'Field Staff', icon: IconFieldStaff,
          show: perms.canFieldEntry || perms.canSurveillanceReport || perms.canVerifyAccused
        },
      ],
    },
    {
      title: 'Intelligence',
      items: [
        {
          path: '/surveillance', label: 'Surveillance', icon: IconSurveillance,
          show: perms.canViewAllTech || perms.canAddTechIntel
        },
        {
          path: '/finance', label: 'Financial', icon: IconFinance,
          show: perms.canViewAllFinance
        },
        {
          path: '/network', label: 'Network Map', icon: IconNetwork,
          show: perms.canViewAllNetwork || perms.canBuildNetwork
        },
      ],
    },
    {
      title: 'Reports',
      items: [
        {
          path: '/reports', label: 'Reports', icon: IconReports,
          show: perms.canViewAllReports || perms.canBuildCustomReport
        },
        {
          path: '/district-analytics', label: 'District Analytics', icon: IconMap,
          show: perms.canViewDistrictAnalytics
        },
      ],
    },
    {
      title: 'Workflows',
      items: [
        { path: '/deletion-requests', label: 'Deletions', icon: IconTrash, show: true },
        {
          path: '/edit-requests', label: 'Edit Requests', icon: IconEdit,
          show: perms.canApproveEdit || perms.canRequestEdit
        },
      ],
    },
  ];

  // SP (system admin) also sees Administration section
  if (perms.isSP) {
    sections.push({
      title: 'Administration',
      items: [
        { path: '/admin/users', label: 'User Management', icon: IconUsers, show: true },
        { path: '/admin/teams', label: 'Team Management', icon: IconBuilding, show: true },
        { path: '/admin/audit-logs', label: 'Audit Logs', icon: IconAuditLog, show: true },
        { path: '/admin/import', label: 'DPR Import', icon: IconImport, show: true },
      ],
    });
  }

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
  SP: { bg: '#8b5cf6', text: '#fff' },
  ASP: { bg: '#6366f1', text: '#fff' },
  SDPO: { bg: '#3b82f6', text: '#fff' },
  SHO: { bg: '#22c55e', text: '#fff' },
  CONSTABLE: { bg: '#6b7280', text: '#fff' },
};

/** Display-friendly role labels */
const ROLE_LABELS = {
  SP: 'SP',
  ASP: 'ASP',
  SDPO: 'SDPO (DSP)',
  SHO: 'SHO (CI/SI)',
  CONSTABLE: 'Constable',
};

/** Display-friendly department labels */
const DEPT_LABELS = {
  POLICE: 'Police',
  CYBER_ANALYTICS: 'Cyber Analytics',
  EXCISE: 'Excise',
};

/** Full roles labels for dropdown profile header */
const ROLE_FULL_LABELS = {
  SP: 'Superintendent of Police (SP)',
  ASP: 'Assistant Superintendent of Police (ASP)',
  SDPO: 'Sub-Divisional Police Officer (SDPO/DSP)',
  SHO: 'Station House Officer (SHO/CI/SI)',
  CONSTABLE: 'Police Constable',
};

/** Full department labels for dropdown profile badge */
const DEPT_FULL_LABELS = {
  POLICE: 'Police Department',
  CYBER_ANALYTICS: 'Cyber Analytics (STF)',
  EXCISE: 'Excise Department',
}; export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [policeStationName, setPoliceStationName] = useState(null);
  const [darkMode] = useState(() => {
    return localStorage.getItem('dart_dark_mode') === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    if (user?.policeStationId) {
      api.get('/police-stations')
        .then(res => {
          const matched = res.data?.data?.find(s => String(s.id) === String(user.policeStationId));
          if (matched) {
            setPoliceStationName(matched.name);
          }
        })
        .catch(err => console.error('Failed to fetch police station name:', err));
    }
  }, [user?.policeStationId]);

  const navSections = useNavItems();
  const roleColor = ROLE_COLORS[user?.role] || ROLE_COLORS.CONSTABLE;
  const roleLabel = ROLE_LABELS[user?.role] || user?.role;
  const deptLabel = DEPT_LABELS[user?.department] || user?.department;

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Backdrop overlay on mobile */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ---- Sidebar ---- */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col transform ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } md:translate-x-0 md:static md:flex md:flex-col ${sidebarOpen ? 'md:w-64' : 'md:w-16'
          } transition-all duration-300`}
        style={{ background: '#e8750a', borderRight: '1px solid rgba(255,255,255,0.15)' }}
      >
        {/* Brand */}
        <div className={`flex items-center ${sidebarOpen ? 'justify-between px-4' : 'justify-center px-2'} md:justify-center py-5`} style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
          <img
            src={apLogo}
            alt="AP Police Logo"
            className={`${sidebarOpen || mobileSidebarOpen ? 'w-24 h-24' : 'w-12 h-12'} object-contain flex-shrink-0 bg-white rounded-full p-0.5 transition-all duration-300`}
          />
          {/* Close button on mobile */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="p-1.5 rounded-lg text-white hover:bg-white/10 md:hidden cursor-pointer"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Nav Items — grouped by section, conditionally rendered based on role + department */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navSections.map((section, si) => (
            <div key={section.title} className={si > 0 ? 'mt-5' : ''}>
              {(sidebarOpen || mobileSidebarOpen) && (
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest px-3 mb-2"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                >
                  {section.title}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = location.pathname === item.path ||
                    (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                  const NavIcon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      id={`nav-${item.path.replace(/\//g, '-').replace(/^-/, '')}`}
                      onClick={() => setMobileSidebarOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200"
                      style={{
                        background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
                        color: active ? '#fff' : 'rgba(255,255,255,0.8)',
                      }}
                      onMouseOver={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                      onMouseOut={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <NavIcon size={18} color={active ? '#fff' : 'rgba(255,255,255,0.75)'} />
                      {(sidebarOpen || mobileSidebarOpen) && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Profile in Sidebar */}
        <div className="relative" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full flex items-center gap-3 p-3 text-white hover:bg-white/10 transition-colors cursor-pointer select-none text-left"
          >
            {/* Avatar Initials */}
            <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm bg-white/20 text-white border border-white/10 flex-shrink-0">
              {user?.fullName ? user.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'RK'}
            </div>
            {/* Name/Details */}
            {(sidebarOpen || mobileSidebarOpen) && (
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-xs truncate m-0 text-white">
                  {user?.fullName || 'Rama Krishna'}
                </p>
                <p className="text-[10px] text-white/70 truncate mt-0.5 mb-0">
                  {(roleLabel || 'ASP')} | {(deptLabel || 'STF')}
                </p>
              </div>
            )}
            {/* Chevron */}
            {(sidebarOpen || mobileSidebarOpen) && (
              <svg
                className={`w-3.5 h-3.5 text-white/70 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
              </svg>
            )}
          </button>

          {/* Floating Dropdown for Sidebar Profile */}
          {dropdownOpen && (
            <>
              {/* Overlay backdrop */}
              <div
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setDropdownOpen(false)}
              />

              <div
                id="user-profile-dropdown"
                className="absolute z-50 rounded-xl border shadow-lg overflow-hidden text-left bg-white dark:bg-slate-900 border-gray-200 dark:border-gray-700/60"
                style={{
                  bottom: '100%',
                  left: (sidebarOpen || mobileSidebarOpen) ? '12px' : '64px',
                  width: (sidebarOpen || mobileSidebarOpen) ? 'calc(100% - 24px)' : '280px',
                  marginBottom: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2)',
                }}
              >
                {/* User Header Section */}
                <div className="p-4 flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900/40 shadow-xs mb-2 select-none">
                    {user?.fullName ? user.fullName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'RK'}
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white truncate w-full" style={{ fontSize: '15px', margin: 0 }}>
                    {user?.fullName || 'Rama Krishna'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs truncate w-full mt-0.5">
                    {ROLE_FULL_LABELS[user?.role] || 'Assistant Superintendent of Police (ASP)'}
                  </p>
                  <div className="mt-2.5">
                    <span className="inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
                      {DEPT_FULL_LABELS[user?.department] || 'STF - Special Task Force'}
                    </span>
                  </div>
                </div>

                {/* Allotted PS Info */}
                <div className="px-4 py-3 border-t border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider" style={{ margin: 0 }}>
                      Allotted PS / Unit
                    </p>
                    <p className="text-xs text-gray-800 dark:text-gray-200 font-semibold truncate mt-0.5" style={{ margin: 0 }}>
                      {policeStationName || (user?.policeStationId ? `PS ID: ${user.policeStationId}` : 'HQ Command Center')}
                    </p>
                  </div>
                </div>

                {/* Logout Button */}
                <div className="p-2 bg-gray-50/50 dark:bg-gray-900/10">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg font-bold transition-all duration-150 cursor-pointer border-none bg-transparent"
                    style={{ fontSize: '13px' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout Session
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="hidden md:block px-4 py-3 text-sm transition-colors cursor-pointer"
          style={{ color: 'rgba(255,255,255,0.65)', borderTop: '1px solid rgba(255,255,255,0.15)' }}
        >
          {sidebarOpen ? '← Collapse' : '→'}
        </button>
      </aside>

      {/* ---- Main Content ---- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header
          className="grid grid-cols-3 items-center px-2 sm:px-6 py-2 md:py-3 min-h-[70px] md:min-h-[101px] gap-2 sm:gap-4 flex-shrink-0"
          style={{ background: 'var(--color-header-bg, #fff)', borderBottom: '1px solid var(--color-garuda-700)' }}
        >
          {/* Left section: Hamburger and Garuda Logo */}
          <div className="flex items-center gap-1.5 sm:gap-4 h-full justify-start">
            {/* Hamburger menu for mobile */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-1.5 -ml-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 md:hidden cursor-pointer flex items-center justify-center"
              aria-label="Open sidebar"
            >
              <svg className="w-5.5 h-5.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <img
              src={garudaLogo}
              alt="Garuda Logo"
              className="h-9 sm:h-18 md:h-24 max-w-[110px] sm:max-w-none object-contain"
            />
          </div>

          {/* Middle section: Centered AP State Emblem */}
          <div className="flex items-center justify-center">
            <img
              src={apEmblem}
              alt="Andhra Pradesh State Emblem"
              className="h-9 sm:h-22 object-contain"
            />
          </div>

          {/* Right section: CM Photo */}
          <div className="flex items-center justify-end">
            <img
              src={cmPhoto}
              alt="AP CM Photo"
              className="h-11 sm:h-20 md:h-28 object-contain rounded-md shadow-md border border-gray-200/50 dark:border-slate-800"
            />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 relative" style={{ background: 'var(--color-garuda-900)' }}>
          <GlobalLoader />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
