/**
 * GARUDA — No Access Page
 * 
 * Shown when a user navigates to a page they don't have permission for.
 * Displays their current role and department with a clear message.
 */
import { Link } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { IconLock } from '../components/Icons';

const DEPARTMENT_LABELS = {
  ADMINISTRATION: 'Administration',
  OPERATIONS:     'Operations',
  INTELLIGENCE:   'Intelligence',
  FIN_CELL:       'Financial Cell',
  TECH_CELL:      'Tech Cell',
  ANALYST:        'Analyst',
  LEGAL:          'Legal',
  STF:            'Special Task Force',
};

const ROLE_LABELS = {
  ADMIN:     'Admin',
  SP:        'Superintendent of Police',
  ASP:       'Asst. Superintendent of Police',
  DSP:       'Deputy Superintendent of Police',
  CI:        'Circle Inspector',
  SI:        'Sub-Inspector',
  CONSTABLE: 'Constable',
};

export default function NoAccess() {
  const perms = usePermissions();
  const roleLabel = ROLE_LABELS[perms.role] || perms.role;
  const deptLabel = DEPARTMENT_LABELS[perms.department] || perms.department;

  return (
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div
        className="text-center p-10 rounded-2xl max-w-lg mx-auto"
        style={{
          background: 'linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95))',
          border: '1px solid var(--color-garuda-700)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Animated lock icon */}
        <div
          className="mx-auto mb-6 flex items-center justify-center rounded-full"
          style={{
            width: 80,
            height: 80,
            background: 'linear-gradient(135deg, #ef444422, #dc262622)',
            border: '2px solid #ef444444',
            animation: 'pulse 2s ease-in-out infinite',
          }}
        >
          <IconLock size={36} color="#ef4444" />
        </div>

        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--color-garuda-50)' }}
        >
          Access Restricted
        </h1>

        <p
          className="text-sm mb-6 leading-relaxed"
          style={{ color: 'var(--color-garuda-400)' }}
        >
          You don't have permission to access this page. This section is restricted
          based on your role and department assignment.
        </p>

        {/* User info card */}
        <div
          className="rounded-xl p-4 mb-6 text-left"
          style={{
            background: 'var(--color-garuda-800)',
            border: '1px solid var(--color-garuda-700)',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--color-garuda-500)' }}>
              Your Role
            </span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#3b82f622', color: '#60a5fa' }}
            >
              {roleLabel}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: 'var(--color-garuda-500)' }}>
              Department
            </span>
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: '#22c55e22', color: '#4ade80' }}
            >
              {deptLabel || 'Not Assigned'}
            </span>
          </div>
        </div>

        <p
          className="text-xs mb-6"
          style={{ color: 'var(--color-garuda-500)' }}
        >
          Contact your administrator if you believe this is an error.
        </p>

        {/* Action buttons */}
        <div className="flex gap-3 justify-center">
          <Link
            to="/dashboard"
            className="btn btn-primary"
          >
            ← Go to Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="btn btn-secondary"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
