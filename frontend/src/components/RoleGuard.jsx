/**
 * GARUDA — RoleGuard Component
 * 
 * Wraps route elements to restrict access based on permissions and department.
 * Shows the NoAccess page if the user lacks the required permission/department.
 * 
 * Props:
 *   permission  — Permission key to check (e.g., 'TECH_VIEW_ALL')
 *   minRole     — Minimum role rank required (e.g., 'CI')
 *   departments — Array of allowed departments (e.g., ['TECH_CELL', 'ANALYST'])
 *   children    — The protected component
 *   fallback    — Optional custom fallback component
 */
import { usePermissions } from '../hooks/usePermissions';
import NoAccess from '../pages/NoAccess';

export default function RoleGuard({ permission, minRole, departments, children, fallback }) {
  const perms = usePermissions();

  let allowed = true;

  // Check permission key (includes both role rank AND department check)
  if (permission) {
    allowed = perms.hasPermission(permission);
  }

  // Check minimum role (additional constraint on top of permission)
  if (minRole) {
    allowed = allowed && perms.hasMinRole(minRole);
  }

  // Check department membership (standalone department restriction)
  if (departments && departments.length > 0) {
    // ADMIN bypasses department check
    if (!perms.isAdmin) {
      allowed = allowed && departments.includes(perms.department);
    }
  }

  if (!allowed) {
    if (fallback) return fallback;
    return <NoAccess />;
  }

  return children;
}
