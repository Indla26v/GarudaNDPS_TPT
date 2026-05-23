/**
 * GARUDA — Role & Permission Configuration
 * 
 * Roles = Police Ranks: ADMIN, SP, ASP, DSP, CI, SI, CONSTABLE
 * Departments = Organizational Units: ADMINISTRATION, OPERATIONS, INTELLIGENCE, FIN_CELL, TECH_CELL, ANALYST, LEGAL, STF
 * Access = Role rank + Department membership
 */

// ── Role hierarchy (rank order, lower = more powerful) ─────────────────
export const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN:     0,
  SP:        1,
  ASP:       2,
  DSP:       3,
  CI:        4,
  SI:        5,
  CONSTABLE: 6,
};

export const ROLE_LABELS: Record<string, string> = {
  ADMIN:     'Admin',
  SP:        'SP',
  ASP:       'ASP',
  DSP:       'DSP',
  CI:        'CI (SHO)',
  SI:        'SI',
  CONSTABLE: 'Constable',
};

export const DEPARTMENTS = [
  'ADMINISTRATION',
  'OPERATIONS',
  'INTELLIGENCE',
  'FIN_CELL',
  'TECH_CELL',
  'ANALYST',
  'LEGAL',
  'STF',
] as const;

export const DEPARTMENT_LABELS: Record<string, string> = {
  ADMINISTRATION: 'Administration',
  OPERATIONS:     'Operations',
  INTELLIGENCE:   'Intelligence',
  FIN_CELL:       'Financial Cell',
  TECH_CELL:      'Tech Cell',
  ANALYST:        'Analyst',
  LEGAL:          'Legal',
  STF:            'Special Task Force',
};

// ── Permission matrix ──────────────────────────────────────────────────
// Access is determined by a combination of role rank AND department.
// Page-level permissions keyed by page → which departments can see it.

export const PERMISSIONS = {
  // Page 1: Dashboard — all roles can see their own level
  DASHBOARD_VIEW:       { minRole: 'CONSTABLE' },
  DASHBOARD_FULL:       { minRole: 'SP' },

  // Page 2: Offender Database — all operational staff
  OFFENDER_VIEW:        { minRole: 'CONSTABLE' },
  OFFENDER_CREATE:      { minRole: 'SI' },
  OFFENDER_EDIT:        { minRole: 'SI' },

  // Page 3: Case Management — operational departments
  CASE_VIEW:            { minRole: 'CONSTABLE' },
  CASE_CREATE:          { minRole: 'SI' },
  CASE_EDIT:            { minRole: 'SI' },
  CASE_APPROVE:         { minRole: 'CI' },
  // Legacy route keys (Phase 0 alignment)
  ADD_CASE:             { minRole: 'SI' },
  EDIT_RECORDS:           { minRole: 'SI' },

  // Page 4: Field Staff — field personnel
  FIELD_ENTRY:          { minRole: 'CONSTABLE', departments: ['OPERATIONS', 'STF'] },
  FIELD_VERIFY:         { minRole: 'SI', departments: ['OPERATIONS', 'STF'] },

  // Page 5: Technical Surveillance — restricted to specific departments
  TECH_VIEW_ALL:        { minRole: 'CONSTABLE', departments: ['TECH_CELL', 'ANALYST', 'STF', 'INTELLIGENCE'] },
  TECH_ADD:             { minRole: 'SI', departments: ['TECH_CELL', 'ANALYST', 'STF'] },

  // Page 6: Financial Analysis — restricted to specific departments
  FIN_VIEW_ALL:         { minRole: 'CONSTABLE', departments: ['FIN_CELL', 'ANALYST', 'STF', 'INTELLIGENCE'] },
  FIN_ADD:              { minRole: 'SI', departments: ['FIN_CELL', 'STF'] },

  // Page 7: Network & Chain Analysis — restricted to specific departments
  NET_VIEW_ALL:         { minRole: 'CONSTABLE', departments: ['ANALYST', 'TECH_CELL', 'STF', 'INTELLIGENCE'] },
  NET_BUILD:            { minRole: 'SI', departments: ['ANALYST', 'STF'] },

  // Page 8: Reports — mostly open for reads
  REPORTS_VIEW:         { minRole: 'SI' },
  REPORTS_CUSTOM:       { minRole: 'CI' },

  // Page 9: Admin & User Management — ADMIN only
  USER_MANAGEMENT:      { minRole: 'ADMIN' },
  AUDIT_LOGS:           { minRole: 'ADMIN' },
  TEAM_MANAGEMENT:      { minRole: 'ADMIN' },

  // Workflows
  DISTRICT_ANALYTICS:   { minRole: 'DSP' },
  EDIT_APPROVE:         { minRole: 'CI' },
  EDIT_REQUEST:         { minRole: 'SI' },
};

/**
 * Check if a user with the given role and department has a specific permission.
 */
export function hasPermission(
  userRole: string,
  userDepartment: string,
  permissionKey: keyof typeof PERMISSIONS
): boolean {
  const perm = PERMISSIONS[permissionKey];
  if (!perm) return false;

  // ADMIN bypasses all checks
  if (userRole === 'ADMIN') return true;

  // Check role rank
  const userRank = ROLE_HIERARCHY[userRole];
  const requiredRank = ROLE_HIERARCHY[perm.minRole];
  if (userRank === undefined || requiredRank === undefined) return false;
  if (userRank > requiredRank) return false;

  // Check department restriction (if any)
  if ('departments' in perm && perm.departments) {
    if (!perm.departments.includes(userDepartment as any)) return false;
  }

  return true;
}
