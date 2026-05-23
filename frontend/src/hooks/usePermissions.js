/**
 * GARUDA — usePermissions Hook
 *
 * Roles = Police Ranks: ADMIN, SP, ASP, DSP, CI, SI, CONSTABLE
 * Departments = Org Units: ADMINISTRATION, OPERATIONS, INTELLIGENCE, FIN_CELL, TECH_CELL, ANALYST, LEGAL, STF
 *
 * ACCESS RULES:
 *   - Role rank determines base capability (higher rank = more power)
 *   - Department membership determines which modules a user can access
 *   - SP/ASP are NOT exempt from department restrictions on Intelligence/Field pages
 *   - ADMIN bypasses all checks
 *
 * DATA SCOPE:
 *   - Station-level (DSP, CI, SI, Constable): data scoped to their Police Station
 *   - District-level (SP, ASP): data for the entire district (all PS)
 */
import { useMemo } from 'react';

const ROLE_HIERARCHY = {
  ADMIN:     0,
  SP:        1,
  ASP:       2,
  DSP:       3,
  CI:        4,
  SI:        5,
  CONSTABLE: 6,
};

const STATION_LEVEL_ROLES = ['DSP', 'CI', 'SI', 'CONSTABLE'];
const DISTRICT_LEVEL_ROLES = ['SP', 'ASP'];

export function usePermissions() {
  const user = JSON.parse(localStorage.getItem('garuda_user') || '{}');
  const role = user.role || '';
  const department = user.department || '';
  const policeStationId = user.policeStationId || null;

  return useMemo(() => {
    const rank = ROLE_HIERARCHY[role] ?? 99;

    /** Does the user meet or exceed the given minimum role? */
    const hasMinRole = (minRole) => {
      if (role === 'ADMIN') return true;
      const minRank = ROLE_HIERARCHY[minRole] ?? 0;
      return rank <= minRank;
    };

    /** Is the user in one of the given departments? */
    const inDepartment = (...depts) => depts.includes(department);

    /** Is this user station-level (sees only their PS data)? */
    const isStationLevel = STATION_LEVEL_ROLES.includes(role);

    /** Is this user district-level (sees all PS data)? */
    const isDistrictLevel = DISTRICT_LEVEL_ROLES.includes(role);

    /**
     * Check a specific permission key.
     * SP/ASP are NOT exempt from department restrictions.
     * Only ADMIN bypasses all checks.
     */
    const hasPermission = (key) => {
      if (role === 'ADMIN') return true;

      const PERM_MAP = {
        // Core Operations — no department restriction
        DASHBOARD_VIEW:     () => hasMinRole('CONSTABLE'),
        DASHBOARD_FULL:     () => hasMinRole('SP'),
        OFFENDER_VIEW:      () => hasMinRole('CONSTABLE'),
        OFFENDER_CREATE:    () => hasMinRole('SI'),
        OFFENDER_EDIT:      () => hasMinRole('SI'),
        CASE_VIEW:          () => hasMinRole('CONSTABLE'),
        CASE_CREATE:        () => hasMinRole('SI'),
        CASE_APPROVE:       () => hasMinRole('CI'),

        // Field Staff — department-restricted (OPERATIONS, STF)
        FIELD_ENTRY:        () => hasMinRole('CONSTABLE') && inDepartment('OPERATIONS', 'STF'),
        FIELD_VERIFY:       () => hasMinRole('SI') && inDepartment('OPERATIONS', 'STF'),

        // Tech Surveillance — department-restricted
        TECH_VIEW_ALL:      () => hasMinRole('CONSTABLE') && inDepartment('TECH_CELL', 'ANALYST', 'STF', 'INTELLIGENCE'),
        TECH_ADD:           () => hasMinRole('SI') && inDepartment('TECH_CELL', 'ANALYST', 'STF'),

        // Financial Analysis — department-restricted
        FIN_VIEW_ALL:       () => hasMinRole('CONSTABLE') && inDepartment('FIN_CELL', 'ANALYST', 'STF', 'INTELLIGENCE'),
        FIN_ADD:            () => hasMinRole('SI') && inDepartment('FIN_CELL', 'STF'),

        // Network & Chain Analysis — department-restricted
        NET_VIEW_ALL:       () => hasMinRole('CONSTABLE') && inDepartment('ANALYST', 'TECH_CELL', 'STF', 'INTELLIGENCE'),
        NET_BUILD:          () => hasMinRole('SI') && inDepartment('ANALYST', 'STF'),

        // Reports — no department restriction
        REPORTS_VIEW:       () => hasMinRole('SI'),
        REPORTS_CUSTOM:     () => hasMinRole('CI'),

        // Admin-only
        USER_MANAGEMENT:    () => role === 'ADMIN',
        AUDIT_LOGS:         () => role === 'ADMIN',
        TEAM_MANAGEMENT:    () => role === 'ADMIN',

        // Workflows — no department restriction
        DISTRICT_ANALYTICS: () => hasMinRole('ASP'),
        EDIT_APPROVE:       () => hasMinRole('CI'),
        EDIT_REQUEST:       () => hasMinRole('SI'),
      };

      return PERM_MAP[key] ? PERM_MAP[key]() : false;
    };

    return {
      role,
      department,
      policeStationId,
      hasMinRole,
      hasPermission,
      inDepartment,

      // Scope flags
      isStationLevel,
      isDistrictLevel,

      // Identity
      isAdmin: role === 'ADMIN',
      isSP: role === 'SP',
      isASP: role === 'ASP',
      isDSP: role === 'DSP',
      isCI: role === 'CI',
      isSI: role === 'SI',

      // Department checks
      isTechCell: department === 'TECH_CELL',
      isFinCell: department === 'FIN_CELL',
      isAnalyst: department === 'ANALYST',
      isSTF: department === 'STF',
      isOperations: department === 'OPERATIONS',
      isIntelligence: department === 'INTELLIGENCE',

      // Page-level shortcuts — these now properly enforce department restrictions
      canViewDashboardFull: hasMinRole('SP'),
      canRegisterCase: hasMinRole('SI'),
      canApproveCase: hasMinRole('CI'),

      canFieldEntry: hasMinRole('CONSTABLE') && inDepartment('OPERATIONS', 'STF'),
      canVerifyAccused: hasMinRole('SI') && inDepartment('OPERATIONS', 'STF'),
      canSurveillanceReport: hasMinRole('SI') && inDepartment('OPERATIONS', 'STF'),

      canViewAllTech: hasMinRole('CONSTABLE') && inDepartment('TECH_CELL', 'ANALYST', 'STF', 'INTELLIGENCE'),
      canAddTechIntel: hasMinRole('SI') && inDepartment('TECH_CELL', 'ANALYST', 'STF'),

      canViewAllFinance: hasMinRole('CONSTABLE') && inDepartment('FIN_CELL', 'ANALYST', 'STF', 'INTELLIGENCE'),
      canViewAllNetwork: hasMinRole('CONSTABLE') && inDepartment('ANALYST', 'TECH_CELL', 'STF', 'INTELLIGENCE'),
      canBuildNetwork: hasMinRole('SI') && inDepartment('ANALYST', 'STF'),

      canViewAllReports: hasMinRole('SI'),
      canBuildCustomReport: hasMinRole('CI'),

      canViewDistrictAnalytics: hasMinRole('ASP'),
      canViewUserManagement: role === 'ADMIN',
      canViewAuditLogs: role === 'ADMIN',
      canApproveEdit: hasMinRole('CI'),
      canRequestEdit: hasMinRole('SI'),
    };
  }, [role, department]);
}
