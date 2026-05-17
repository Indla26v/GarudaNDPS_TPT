/**
 * GARUDA — RoleGuard Component
 * 
 * Wraps route elements to restrict access based on permissions.
 * Shows an "Access Denied" screen if the user lacks the required permission.
 */
import { usePermissions } from '../hooks/usePermissions';

export default function RoleGuard({ permission, minRole, children, fallback }) {
  const perms = usePermissions();

  let allowed = true;

  if (permission) {
    allowed = perms.hasPermission(permission);
  }

  if (minRole) {
    allowed = allowed && perms.hasMinRole(minRole);
  }

  if (!allowed) {
    if (fallback) return fallback;

    return (
      <div className="flex items-center justify-center h-64 text-center">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--color-garuda-50)' }}>
            Access Denied
          </h2>
          <p className="text-sm mt-2" style={{ color: 'var(--color-garuda-400)' }}>
            You don't have permission to access this page.
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-garuda-500)' }}>
            Current role: <strong>{perms.role}</strong>
          </p>
        </div>
      </div>
    );
  }

  return children;
}
