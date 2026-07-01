/**
 * GARUDA — Role & Permission Configuration
 * 
 * Roles = Police Ranks: SP, ASP, SDPO, SHO, CONSTABLE
 * Departments = Organizational Units: POLICE, CYBER_ANALYTICS, EXCISE
 * 
 * ACCESS RULES:
 *   - Role rank determines base capability (higher rank = more power)
 *   - Department membership determines which modules a user can access
 *   - SP bypasses all checks (system admin)
 */

// ── Role hierarchy (rank order, lower = more powerful) ─────────────────
export const ROLE_HIERARCHY: Record<string, number> = {
  SP:        0,
  ASP:       1,
  SDPO:      2,
  SHO:       3,
  CONSTABLE: 4,
};

export const ROLE_LABELS: Record<string, string> = {
  SP:        'SP',
  ASP:       'ASP',
  SDPO:      'SDPO (DSP)',
  SHO:       'SHO (CI/SI)',
  CONSTABLE: 'Constable',
};

export const DEPARTMENTS = [
  'POLICE',
  'CYBER_ANALYTICS',
  'EXCISE',
] as const;

export const DEPARTMENT_LABELS: Record<string, string> = {
  POLICE:          'Police',
  CYBER_ANALYTICS: 'Cyber Analytics (STF)',
  EXCISE:          'Excise Officer',
};

// ── Permission matrix ──────────────────────────────────────────────────
// Access is determined by a combination of role rank AND department.
// If `departments` is specified, the user's department MUST match one of them.
// SP bypasses all checks.

export const PERMISSIONS = {
  // Page 1: Dashboard — all roles can see their own level
  DASHBOARD_VIEW:       { minRole: 'CONSTABLE' },
  DASHBOARD_FULL:       { minRole: 'SP' },

  // Page 2: Offender Database — all operational staff
  OFFENDER_VIEW:        { minRole: 'CONSTABLE' },
  OFFENDER_CREATE:      { minRole: 'SHO' },
  OFFENDER_EDIT:        { minRole: 'SHO' },

  // Page 3: Case Management — operational departments
  CASE_VIEW:            { minRole: 'CONSTABLE' },
  CASE_CREATE:          { minRole: 'SHO' },
  CASE_EDIT:            { minRole: 'SHO' },
  CASE_APPROVE:         { minRole: 'SHO' },
  // Legacy route keys (Phase 0 alignment)
  ADD_CASE:             { minRole: 'SHO' },
  EDIT_RECORDS:         { minRole: 'SHO' },

  // Page 4: Field Staff — field personnel (department-restricted)
  FIELD_ENTRY:          { minRole: 'CONSTABLE', departments: ['POLICE', 'CYBER_ANALYTICS'] },
  FIELD_VERIFY:         { minRole: 'SHO', departments: ['POLICE', 'CYBER_ANALYTICS'] },

  // Page 5: Technical Surveillance — restricted to specific departments
  TECH_VIEW_ALL:        { minRole: 'CONSTABLE', departments: ['CYBER_ANALYTICS'] },
  TECH_ADD:             { minRole: 'SHO', departments: ['CYBER_ANALYTICS'] },

  // Page 6: Financial Analysis — restricted to specific departments
  FIN_VIEW_ALL:         { minRole: 'CONSTABLE', departments: ['CYBER_ANALYTICS'] },
  FIN_ADD:              { minRole: 'SHO', departments: ['CYBER_ANALYTICS'] },

  // Page 7: Network & Chain Analysis — restricted to specific departments
  NET_VIEW_ALL:         { minRole: 'CONSTABLE', departments: ['CYBER_ANALYTICS'] },
  NET_BUILD:            { minRole: 'SHO', departments: ['CYBER_ANALYTICS'] },

  // Page 8: Reports — mostly open for reads
  REPORTS_VIEW:         { minRole: 'SHO' },
  REPORTS_CUSTOM:       { minRole: 'SHO' },

  // Page 9: Admin & User Management — SP only
  USER_MANAGEMENT:      { minRole: 'SP' },
  AUDIT_LOGS:           { minRole: 'SP' },
  TEAM_MANAGEMENT:      { minRole: 'SP' },

  // Workflows
  DISTRICT_ANALYTICS:   { minRole: 'ASP' },
  EDIT_APPROVE:         { minRole: 'SHO' },
  EDIT_REQUEST:         { minRole: 'SHO' },

  // Enforcement
  ENFORCEMENT_VIEW:     { minRole: 'CONSTABLE' },
  ENFORCEMENT_CREATE:   { minRole: 'CONSTABLE' },
  ENFORCEMENT_REVIEW:   { minRole: 'SHO' },

  // Offender deletion (separate from edit)
  OFFENDER_DELETE:      { minRole: 'SP' },

  // Data import
  IMPORT_DATA:          { minRole: 'SP' },

  // Vehicles (Seized)
  VEHICLE_VIEW:         { minRole: 'CONSTABLE' },
  VEHICLE_EDIT:         { minRole: 'SHO' },

  // Intelligence module
  INTEL_VIEW:           { minRole: 'SHO' },
  INTEL_CREATE:         { minRole: 'SHO' },

  // Informer Management
  INFORMER_VIEW:        { minRole: 'SHO', departments: ['POLICE', 'CYBER_ANALYTICS'] },
  INFORMER_CREATE:      { minRole: 'SHO', departments: ['POLICE', 'CYBER_ANALYTICS'] },

  // Finance Intelligence (Page 6) — owned by the Cyber Analytics cell.
  // NOTE: the spec references a `FIN_CELL` department, which does not exist in
  // this codebase (departments are POLICE / CYBER_ANALYTICS / EXCISE). Finance
  // is scoped to CYBER_ANALYTICS to match the existing FIN_VIEW_ALL/FIN_ADD gating.
  FINANCE_VIEW:         { minRole: 'CONSTABLE', departments: ['CYBER_ANALYTICS'] },
  FINANCE_UPLOAD:       { minRole: 'SHO', departments: ['CYBER_ANALYTICS'] },
  FINANCE_ANALYZE:      { minRole: 'SHO', departments: ['CYBER_ANALYTICS'] },

  // Excise-specific (EXCISE department can access their own station's core pages)
  EXCISE_OFFENDER_VIEW: { minRole: 'CONSTABLE', departments: ['EXCISE'] },
  EXCISE_CASE_VIEW:     { minRole: 'CONSTABLE', departments: ['EXCISE'] },
};

/**
 * Check if a user with the given role and department has a specific permission.
 * 
 * SP bypasses all checks (system admin).
 */
export function hasPermission(
  userRole: string,
  userDepartment: string,
  permissionKey: keyof typeof PERMISSIONS
): boolean {
  const perm = PERMISSIONS[permissionKey];
  if (!perm) return false;

  // SP bypasses all checks
  if (userRole === 'SP') return true;

  // Check role rank
  const userRank = ROLE_HIERARCHY[userRole];
  const requiredRank = ROLE_HIERARCHY[perm.minRole];
  if (userRank === undefined || requiredRank === undefined) return false;
  if (userRank > requiredRank) return false;

  // Check department restriction (if any) — applies to ALL roles including ASP
  if ('departments' in perm && perm.departments) {
    if (!perm.departments.includes(userDepartment as any)) return false;
  }

  return true;
}
