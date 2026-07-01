/**
 * GARUDA — usePermissions Hook
 *
 * Roles = Police Ranks: SP, ASP, SDPO, SHO, CONSTABLE
 * Departments = Org Units: POLICE, CYBER_ANALYTICS, EXCISE
 *
 * ACCESS RULES:
 *   - Role rank determines base capability (higher rank = more power)
 *   - Department membership determines which modules a user can access
 *   - SP bypasses all checks (system admin)
 *
 * DATA SCOPE:
 *   - Station-level (SDPO, SHO, Constable): data scoped to their Police Station
 *   - District-level (SP, ASP): data for the entire district (all PS)
 */
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

const ROLE_HIERARCHY = {
  SP:        0,
  ASP:       1,
  SDPO:      2,
  SHO:       3,
  CONSTABLE: 4,
};

const STATION_LEVEL_ROLES = ['SHO', 'CONSTABLE'];
const DISTRICT_LEVEL_ROLES = ['SP', 'ASP', 'SDPO'];

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || '';
  const department = user?.department || '';
  const policeStationId = user?.policeStationId || null;

  return useMemo(() => {
    const rank = ROLE_HIERARCHY[role] ?? 99;

    /** Does the user meet or exceed the given minimum role? */
    const hasMinRole = (minRole) => {
      if (role === 'SP') return true;
      const minRank = ROLE_HIERARCHY[minRole] ?? 0;
      return rank <= minRank;
    };

    /** Is the user in one of the given departments? */
    const inDepartment = (...depts) => depts.includes(department);

    /** Is this user station-level (sees only their PS data)? */
    const isStationLevel = STATION_LEVEL_ROLES.includes(role) && department !== 'CYBER_ANALYTICS';

    /** Is this user district-level (sees all PS data)? */
    const isDistrictLevel = DISTRICT_LEVEL_ROLES.includes(role) || department === 'CYBER_ANALYTICS';

    /**
     * Check a specific permission key.
     * SP bypasses all checks (system admin).
     */
    const hasPermission = (key) => {
      if (role === 'SP') return true;

      const PERM_MAP = {
        // Core Operations — no department restriction
        DASHBOARD_VIEW:     () => hasMinRole('CONSTABLE'),
        DASHBOARD_FULL:     () => hasMinRole('SP'),
        OFFENDER_VIEW:      () => hasMinRole('CONSTABLE'),
        OFFENDER_CREATE:    () => hasMinRole('SHO'),
        OFFENDER_EDIT:      () => hasMinRole('SHO'),
        CASE_VIEW:          () => hasMinRole('CONSTABLE'),
        CASE_CREATE:        () => hasMinRole('SHO'),
        CASE_APPROVE:       () => hasMinRole('SHO'),

        // Field Staff — department-restricted (POLICE, CYBER_ANALYTICS)
        FIELD_ENTRY:        () => hasMinRole('CONSTABLE') && inDepartment('POLICE', 'CYBER_ANALYTICS'),
        FIELD_VERIFY:       () => hasMinRole('SHO') && inDepartment('POLICE', 'CYBER_ANALYTICS'),

        // Tech Surveillance — department-restricted
        TECH_VIEW_ALL:      () => hasMinRole('CONSTABLE') && inDepartment('CYBER_ANALYTICS'),
        TECH_ADD:           () => hasMinRole('SHO') && inDepartment('CYBER_ANALYTICS'),

        // Financial Analysis — department-restricted
        FIN_VIEW_ALL:       () => hasMinRole('CONSTABLE') && inDepartment('CYBER_ANALYTICS'),
        FIN_ADD:            () => hasMinRole('SHO') && inDepartment('CYBER_ANALYTICS'),

        // Network & Chain Analysis — department-restricted
        NET_VIEW_ALL:       () => hasMinRole('CONSTABLE') && inDepartment('CYBER_ANALYTICS'),
        NET_BUILD:          () => hasMinRole('SHO') && inDepartment('CYBER_ANALYTICS'),

        // Reports — restricted to SP, ASP, SDPO, and CYBER_ANALYTICS
        REPORTS_VIEW:       () => hasMinRole('SDPO') || inDepartment('CYBER_ANALYTICS'),
        REPORTS_CUSTOM:     () => hasMinRole('SDPO') || inDepartment('CYBER_ANALYTICS'),

        // SP-only
        USER_MANAGEMENT:    () => role === 'SP',
        AUDIT_LOGS:         () => role === 'SP',
        TEAM_MANAGEMENT:    () => role === 'SP',

        // Workflows — no department restriction
        DISTRICT_ANALYTICS: () => hasMinRole('ASP'),
        EDIT_APPROVE:       () => hasMinRole('SHO'),
        EDIT_REQUEST:       () => hasMinRole('SHO'),

        // Enforcement
        ENFORCEMENT_VIEW:   () => hasMinRole('CONSTABLE'),
        ENFORCEMENT_CREATE: () => hasMinRole('CONSTABLE'),
        ENFORCEMENT_REVIEW: () => hasMinRole('SHO'),

        // Offender deletion (separate from edit)
        OFFENDER_DELETE:     () => role === 'SP',

        // Data import
        IMPORT_DATA:         () => role === 'SP',

        // Vehicles (Seized)
        VEHICLE_VIEW:        () => hasMinRole('CONSTABLE'),
        VEHICLE_EDIT:        () => hasMinRole('SHO'),

        // Intelligence module
        INTEL_VIEW:          () => hasMinRole('SHO'),
        INTEL_CREATE:        () => hasMinRole('SHO'),

        // Informer Management
        INFORMER_VIEW:       () => hasMinRole('SHO') && inDepartment('POLICE', 'CYBER_ANALYTICS'),
        INFORMER_CREATE:     () => hasMinRole('SHO') && inDepartment('POLICE', 'CYBER_ANALYTICS'),

        // Finance Intelligence (Page 6) — Cyber Analytics cell
        FINANCE_VIEW:        () => hasMinRole('CONSTABLE') && inDepartment('CYBER_ANALYTICS'),
        FINANCE_UPLOAD:      () => hasMinRole('SHO') && inDepartment('CYBER_ANALYTICS'),
        FINANCE_ANALYZE:     () => hasMinRole('SHO') && inDepartment('CYBER_ANALYTICS'),
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
      isAdmin: role === 'SP',
      isSP: role === 'SP',
      isASP: role === 'ASP',
      isSDPO: role === 'SDPO',
      isSHO: role === 'SHO',

      // Department checks
      isPolice: department === 'POLICE',
      isCyberAnalytics: department === 'CYBER_ANALYTICS',
      isExcise: department === 'EXCISE',

      // Page-level shortcuts — these now properly enforce department restrictions
      canViewDashboardFull: hasMinRole('SP'),
      canRegisterCase: hasMinRole('SHO'),
      canApproveCase: hasMinRole('SHO'),

      canFieldEntry: hasMinRole('CONSTABLE') && inDepartment('POLICE', 'CYBER_ANALYTICS'),
      canVerifyAccused: hasMinRole('SHO') && inDepartment('POLICE', 'CYBER_ANALYTICS'),
      canSurveillanceReport: hasMinRole('SHO') && inDepartment('POLICE', 'CYBER_ANALYTICS'),

      canViewAllTech: hasMinRole('CONSTABLE') && inDepartment('CYBER_ANALYTICS'),
      canAddTechIntel: hasMinRole('SHO') && inDepartment('CYBER_ANALYTICS'),

      canViewAllFinance: hasMinRole('CONSTABLE') && inDepartment('CYBER_ANALYTICS'),
      canViewFinance: hasMinRole('CONSTABLE') && inDepartment('CYBER_ANALYTICS'),
      canUploadFinance: hasMinRole('SHO') && inDepartment('CYBER_ANALYTICS'),
      canAnalyzeFinance: hasMinRole('SHO') && inDepartment('CYBER_ANALYTICS'),
      canViewAllNetwork: hasMinRole('CONSTABLE') && inDepartment('CYBER_ANALYTICS'),
      canBuildNetwork: hasMinRole('SHO') && inDepartment('CYBER_ANALYTICS'),

      canViewAllReports: hasMinRole('SDPO') || inDepartment('CYBER_ANALYTICS'),
      canBuildCustomReport: hasMinRole('SDPO') || inDepartment('CYBER_ANALYTICS'),

      canViewDistrictAnalytics: hasMinRole('ASP'),
      canManageUsers: role === 'SP',
      canViewUserManagement: role === 'SP',
      canViewAuditLogs: role === 'SP',
      canApproveEdit: hasMinRole('SHO'),
      canRequestEdit: hasMinRole('SHO'),

      // Enforcement
      canEnforcementView: hasMinRole('CONSTABLE'),
      canEnforcementCreate: hasMinRole('CONSTABLE'),
      canEnforcementReview: hasMinRole('SHO'),

      canDeleteOffender: role === 'SP',
      canImportData: role === 'SP',
      canViewVehicles: hasMinRole('CONSTABLE'),
      canEditVehicles: hasMinRole('SHO'),
      canViewIntel: hasMinRole('SHO'),
      canCreateIntel: hasMinRole('SHO'),
    };
  }, [role, department, policeStationId]);
}
