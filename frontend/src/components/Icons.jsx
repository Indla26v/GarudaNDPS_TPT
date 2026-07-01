/**
 * Mono-colored 2D SVG icon library.
 * Each icon uses a single meaningful color for clarity and consistency.
 * All icons accept size (px) and optional color override.
 */

const Icon = ({ children, size = 18, color = 'currentColor', className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={{ flexShrink: 0 }}
  >
    {children}
  </svg>
);

// ─── Navigation Icons ───────────────────────────────────────────────
export const IconDashboard = ({ size, color = '#e97a1f' }) => (
  <Icon size={size} color={color}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="4" rx="1" />
    <rect x="14" y="11" width="7" height="10" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </Icon>
);

export const IconOffender = ({ size, color = '#b45309' }) => (
  <Icon size={size} color={color}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>
);

export const IconConsumer = ({ size, color = '#2563eb' }) => (
  <Icon size={size} color={color}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

export const IconCases = ({ size, color = '#0ea5e9' }) => (
  <Icon size={size} color={color}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="15" y2="16" />
  </Icon>
);

export const IconFieldStaff = ({ size, color = '#059669' }) => (
  <Icon size={size} color={color}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </Icon>
);

export const IconSurveillance = ({ size, color = '#7c3aed' }) => (
  <Icon size={size} color={color}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const IconFinance = ({ size, color = '#16a34a' }) => (
  <Icon size={size} color={color}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </Icon>
);

export const IconNetwork = ({ size, color = '#6366f1' }) => (
  <Icon size={size} color={color}>
    <circle cx="12" cy="5" r="3" />
    <circle cx="5" cy="19" r="3" />
    <circle cx="19" cy="19" r="3" />
    <line x1="12" y1="8" x2="5" y2="16" />
    <line x1="12" y1="8" x2="19" y2="16" />
  </Icon>
);

export const IconReports = ({ size, color = '#64748b' }) => (
  <Icon size={size} color={color}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </Icon>
);

export const IconMap = ({ size, color = '#0891b2' }) => (
  <Icon size={size} color={color}>
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </Icon>
);

export const IconTrash = ({ size, color = '#dc2626' }) => (
  <Icon size={size} color={color}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Icon>
);

export const IconEdit = ({ size, color = '#d97706' }) => (
  <Icon size={size} color={color}>
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Icon>
);

export const IconUsers = ({ size, color = '#8b5cf6' }) => (
  <Icon size={size} color={color}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

export const IconBuilding = ({ size, color = '#6366f1' }) => (
  <Icon size={size} color={color}>
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <line x1="9" y1="6" x2="9" y2="6.01" />
    <line x1="15" y1="6" x2="15" y2="6.01" />
    <line x1="9" y1="10" x2="9" y2="10.01" />
    <line x1="15" y1="10" x2="15" y2="10.01" />
    <line x1="9" y1="14" x2="9" y2="14.01" />
    <line x1="15" y1="14" x2="15" y2="14.01" />
    <line x1="9" y1="18" x2="15" y2="18" />
  </Icon>
);

export const IconAuditLog = ({ size, color = '#475569' }) => (
  <Icon size={size} color={color}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </Icon>
);

export const IconImport = ({ size, color = '#0ea5e9' }) => (
  <Icon size={size} color={color}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Icon>
);

// ─── Dashboard KPI / Status Icons ────────────────────────────────────

export const IconClipboard = ({ size, color = '#3b82f6' }) => (
  <Icon size={size} color={color}>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </Icon>
);

export const IconLock = ({ size, color = '#22c55e' }) => (
  <Icon size={size} color={color}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
);

export const IconRunning = ({ size, color = '#ef4444' }) => (
  <Icon size={size} color={color}>
    <circle cx="12" cy="5" r="3" />
    <path d="M7 21l3-9 2 3 2-3 3 9" />
    <line x1="12" y1="8" x2="12" y2="12" />
  </Icon>
);

export const IconHourglass = ({ size, color = '#f59e0b' }) => (
  <Icon size={size} color={color}>
    <path d="M5 22h14" />
    <path d="M5 2h14" />
    <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
    <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
  </Icon>
);

export const IconScale = ({ size, color = '#8b5cf6' }) => (
  <Icon size={size} color={color}>
    <line x1="12" y1="3" x2="12" y2="21" />
    <polyline points="1 12 5 8 9 12" />
    <polyline points="15 12 19 8 23 12" />
    <path d="M1 12a4 4 0 0 0 8 0" />
    <path d="M15 12a4 4 0 0 0 8 0" />
    <line x1="5" y1="8" x2="19" y2="8" />
  </Icon>
);

export const IconCheckCircle = ({ size, color = '#06b6d4' }) => (
  <Icon size={size} color={color}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </Icon>
);

export const IconPackage = ({ size, color = '#f59e0b' }) => (
  <Icon size={size} color={color}>
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </Icon>
);

export const IconDollar = ({ size, color = '#22c55e' }) => (
  <Icon size={size} color={color}>
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </Icon>
);

export const IconCar = ({ size, color = '#ec4899' }) => (
  <Icon size={size} color={color}>
    <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
    <circle cx="6.5" cy="16.5" r="2.5" />
    <circle cx="16.5" cy="16.5" r="2.5" />
  </Icon>
);

export const IconBell = ({ size, color = '#d97706' }) => (
  <Icon size={size} color={color}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </Icon>
);

export const IconMegaphone = ({ size, color = '#64748b' }) => (
  <Icon size={size} color={color}>
    <path d="M3 11l18-5v12L3 13v-2z" />
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
  </Icon>
);

export const IconSearch = ({ size, color = '#64748b' }) => (
  <Icon size={size} color={color}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </Icon>
);

export const IconChart = ({ size, color = '#3b82f6' }) => (
  <Icon size={size} color={color}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </Icon>
);

export const IconTool = ({ size, color = '#78716c' }) => (
  <Icon size={size} color={color}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </Icon>
);

export const IconChain = ({ size, color = '#475569' }) => (
  <Icon size={size} color={color}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Icon>
);

export const IconWarning = ({ size, color = '#f59e0b' }) => (
  <Icon size={size} color={color}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </Icon>
);

export const IconShield = ({ size, color = '#dc2626' }) => (
  <Icon size={size} color={color}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </Icon>
);

export const IconVehicle = ({ size, color = '#ec4899' }) => (
  <Icon size={size} color={color}>
    <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2" />
    <circle cx="6.5" cy="16.5" r="2.5" />
    <circle cx="16.5" cy="16.5" r="2.5" />
  </Icon>
);

export const IconPlus = ({ size, color = 'currentColor' }) => (
  <Icon size={size} color={color}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </Icon>
);

export const IconArrowRight = ({ size, color = 'currentColor' }) => (
  <Icon size={size} color={color}>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </Icon>
);

export const IconRefresh = ({ size, color = 'currentColor' }) => (
  <Icon size={size} color={color}>
    <path d="M23 4v6h-6" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </Icon>
);

// ─── Icon Mapping (for lookups by key) ───────────────────────────────
const ICON_MAP = {
  plus: IconPlus,
  arrowRight: IconArrowRight,
  refresh: IconRefresh,
  dashboard: IconDashboard,
  offender: IconOffender,
  consumer: IconConsumer,
  cases: IconCases,
  fieldStaff: IconFieldStaff,
  surveillance: IconSurveillance,
  finance: IconFinance,
  network: IconNetwork,
  reports: IconReports,
  map: IconMap,
  trash: IconTrash,
  edit: IconEdit,
  users: IconUsers,
  building: IconBuilding,
  auditLog: IconAuditLog,
  import: IconImport,
  clipboard: IconClipboard,
  lock: IconLock,
  running: IconRunning,
  hourglass: IconHourglass,
  scale: IconScale,
  checkCircle: IconCheckCircle,
  package: IconPackage,
  dollar: IconDollar,
  car: IconCar,
  bell: IconBell,
  megaphone: IconMegaphone,
  search: IconSearch,
  chart: IconChart,
  tool: IconTool,
  chain: IconChain,
  warning: IconWarning,
  shield: IconShield,
  vehicle: IconVehicle,
};

export default ICON_MAP;
