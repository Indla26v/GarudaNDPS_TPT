/**
 * GARUDA — Role Hierarchy & Permission Matrix
 * 
 * Defines the exact role ranking and maps each role to its
 * allowed capabilities across the platform.
 */

// Role hierarchy ranked from highest (0) to lowest (5)
export const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN:     0,
  SP:        1,
  DSP:       2,
  CI:        3,
  SI:        4,
  CONSTABLE: 5,
};

export type UserRole = keyof typeof ROLE_HIERARCHY;

/**
 * Returns true if `role` is at least as high as `minimumRole`
 * in the hierarchy (lower number = higher authority).
 */
export function hasMinimumRole(role: string, minimumRole: string): boolean {
  const roleRank = ROLE_HIERARCHY[role];
  const minRank  = ROLE_HIERARCHY[minimumRole];
  if (roleRank === undefined || minRank === undefined) return false;
  return roleRank <= minRank;
}

/**
 * Feature-level permission matrix.
 * Each key is a capability; the value is the set of roles that have it.
 */
export const PERMISSIONS: Record<string, Set<string>> = {
  // Admin-only
  USER_MANAGEMENT:     new Set(['ADMIN']),
  AUDIT_LOGS:          new Set(['ADMIN']),
  ASSIGN_PS:           new Set(['ADMIN']),
  ASSIGN_SP:           new Set(['ADMIN']),
  EXECUTE_DELETION:    new Set(['ADMIN']),

  // SP + Admin
  DISTRICT_ANALYTICS:  new Set(['ADMIN', 'SP']),
  VIEW_ALL_PS:         new Set(['ADMIN', 'SP']),
  OFFICER_DIRECTORY:   new Set(['ADMIN', 'SP']),
  APPROVE_DELETION:    new Set(['SP']),

  // DSP and above
  APPROVE_EDIT:        new Set(['DSP']),
  REQUEST_DELETION:    new Set(['DSP']),

  // CI, SI can request edits (routed to DSP)
  REQUEST_EDIT:        new Set(['CI', 'SI']),

  // CI and above can escalate deletion flags
  ESCALATE_DELETION:   new Set(['SI', 'CI']),

  // Everyone can add cases
  ADD_CASE:            new Set(['ADMIN', 'DSP', 'CI', 'SI', 'CONSTABLE']),

  // Everyone can view own PS data
  VIEW_OWN_PS:         new Set(['ADMIN', 'SP', 'DSP', 'CI', 'SI', 'CONSTABLE']),

  // Everyone can search entire database
  SEARCH_DISTRICT:     new Set(['ADMIN', 'SP', 'DSP', 'CI', 'SI', 'CONSTABLE']),

  // Everyone can flag for deletion
  FLAG_DELETION:       new Set(['ADMIN', 'SP', 'DSP', 'CI', 'SI', 'CONSTABLE']),

  // Edit records: DSP approves, CI/SI request, Constable cannot
  EDIT_RECORDS:        new Set(['ADMIN', 'DSP']),
};

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: string, permission: string): boolean {
  const allowed = PERMISSIONS[permission];
  if (!allowed) return false;
  return allowed.has(role);
}
