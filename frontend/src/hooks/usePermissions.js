/**
 * GARUDA — usePermissions Hook
 *
 * Roles = Police Ranks: ADMIN, SP, ASP, DSP, CI, SI, CONSTABLE
 * Departments = Org Units: ADMINISTRATION, OPERATIONS, INTELLIGENCE, FIN_CELL, TECH_CELL, ANALYST, LEGAL, STF
 * Access = Role rank + Department membership
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

export function usePermissions() {
  const user = JSON.parse(localStorage.getItem('garuda_user') || '{}');
  const role = user.role || '';
  const department = user.department || '';

  return useMemo(() => {
    const rank = ROLE_HIERARCHY[role] ?? 99;

    const hasMinRole = (minRole) => {
      if (role === 'ADMIN') return true;
      const minRank = ROLE_HIERARCHY[minRole] ?? 0;
      return rank <= minRank;
    };

    const inDepartment = (...depts) => depts.includes(department);

    const hasPermission = (key) => {
      if (role === 'ADMIN') return true;
      // SP and ASP can access everything except admin pages
      if (hasMinRole('ASP') && !['USER_MANAGEMENT', 'AUDIT_LOGS', 'TEAM_MANAGEMENT'].includes(key)) return true;

      const PERM_MAP = {
        DASHBOARD_VIEW:     () => hasMinRole('CONSTABLE'),
        DASHBOARD_FULL:     () => hasMinRole('SP'),
        OFFENDER_VIEW:      () => hasMinRole('CONSTABLE'),
        OFFENDER_CREATE:    () => hasMinRole('SI'),
        OFFENDER_EDIT:      () => hasMinRole('SI'),
        CASE_VIEW:          () => hasMinRole('CONSTABLE'),
        CASE_CREATE:        () => hasMinRole('SI'),
        CASE_APPROVE:       () => hasMinRole('CI'),
        FIELD_ENTRY:        () => hasMinRole('CONSTABLE') && inDepartment('OPERATIONS', 'STF'),
        FIELD_VERIFY:       () => hasMinRole('SI') && inDepartment('OPERATIONS', 'STF'),
        TECH_VIEW_ALL:      () => hasMinRole('CONSTABLE') && inDepartment('TECH_CELL', 'ANALYST', 'STF', 'INTELLIGENCE'),
        TECH_ADD:           () => hasMinRole('SI') && inDepartment('TECH_CELL', 'ANALYST', 'STF'),
        FIN_VIEW_ALL:       () => hasMinRole('CONSTABLE') && inDepartment('FIN_CELL', 'ANALYST', 'STF', 'INTELLIGENCE'),
        FIN_ADD:            () => hasMinRole('SI') && inDepartment('FIN_CELL', 'STF'),
        NET_VIEW_ALL:       () => hasMinRole('CONSTABLE') && inDepartment('ANALYST', 'TECH_CELL', 'STF', 'INTELLIGENCE'),
        NET_BUILD:          () => hasMinRole('SI') && inDepartment('ANALYST', 'STF'),
        REPORTS_VIEW:       () => hasMinRole('SI'),
        REPORTS_CUSTOM:     () => hasMinRole('CI'),
        USER_MANAGEMENT:    () => role === 'ADMIN',
        AUDIT_LOGS:         () => role === 'ADMIN',
        TEAM_MANAGEMENT:    () => role === 'ADMIN',
        DISTRICT_ANALYTICS: () => hasMinRole('DSP'),
        EDIT_APPROVE:       () => hasMinRole('CI'),
        EDIT_REQUEST:       () => hasMinRole('SI'),
      };

      return PERM_MAP[key] ? PERM_MAP[key]() : false;
    };

    return {
      role,
      department,
      hasMinRole,
      hasPermission,
      inDepartment,

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

      // Page-level shortcuts
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

      canViewDistrictAnalytics: hasMinRole('DSP'),
      canViewUserManagement: role === 'ADMIN',
      canViewAuditLogs: role === 'ADMIN',
      canApproveEdit: hasMinRole('CI'),
      canRequestEdit: hasMinRole('SI'),
    };
  }, [role, department]);
}
