/**
 * GARUDA — usePermissions Hook
 * 
 * Reads the JWT role claims from AuthContext and provides
 * fine-grained permission checks for conditional UI rendering.
 * 
 * Usage:
 *   const { canEdit, canApproveEdit, canViewUserManagement, ... } = usePermissions();
 */
import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

// Role hierarchy (lower number = higher authority)
const ROLE_HIERARCHY = {
  ADMIN:     0,
  SP:        1,
  DSP:       2,
  CI:        3,
  SI:        4,
  CONSTABLE: 5,
};

// Permission matrix (mirrors backend config/roles.ts)
const PERMISSIONS = {
  USER_MANAGEMENT:    new Set(['ADMIN']),
  AUDIT_LOGS:         new Set(['ADMIN']),
  DISTRICT_ANALYTICS: new Set(['ADMIN', 'SP']),
  VIEW_ALL_PS:        new Set(['ADMIN', 'SP']),
  OFFICER_DIRECTORY:  new Set(['ADMIN', 'SP']),

  APPROVE_EDIT:       new Set(['DSP']),
  REQUEST_EDIT:       new Set(['CI', 'SI']),
  EDIT_RECORDS:       new Set(['ADMIN', 'DSP']),
  ADD_CASE:           new Set(['ADMIN', 'DSP', 'CI', 'SI', 'CONSTABLE']),

  FLAG_DELETION:      new Set(['ADMIN', 'SP', 'DSP', 'CI', 'SI', 'CONSTABLE']),
  ESCALATE_DELETION:  new Set(['SI', 'CI']),
  REQUEST_DELETION:   new Set(['DSP']),
  APPROVE_DELETION:   new Set(['SP']),
  EXECUTE_DELETION:   new Set(['ADMIN']),

  SEARCH_DISTRICT:    new Set(['ADMIN', 'SP', 'DSP', 'CI', 'SI', 'CONSTABLE']),
  VIEW_OWN_PS:        new Set(['ADMIN', 'SP', 'DSP', 'CI', 'SI', 'CONSTABLE']),
};

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role || '';

  return useMemo(() => {
    const hasPermission = (perm) => {
      const allowed = PERMISSIONS[perm];
      return allowed ? allowed.has(role) : false;
    };

    const hasMinRole = (minRole) => {
      const userRank = ROLE_HIERARCHY[role];
      const minRank = ROLE_HIERARCHY[minRole];
      if (userRank === undefined || minRank === undefined) return false;
      return userRank <= minRank;
    };

    return {
      role,
      isAdmin:  role === 'ADMIN',
      isSP:     role === 'SP',
      isDSP:    role === 'DSP',
      isCI:     role === 'CI',
      isSI:     role === 'SI',
      isConstable: role === 'CONSTABLE',

      // Feature permissions
      canViewUserManagement:  hasPermission('USER_MANAGEMENT'),
      canViewAuditLogs:       hasPermission('AUDIT_LOGS'),
      canViewDistrictAnalytics: hasPermission('DISTRICT_ANALYTICS'),
      canViewAllPS:           hasPermission('VIEW_ALL_PS'),
      canViewOfficerDirectory: hasPermission('OFFICER_DIRECTORY'),

      canEdit:                hasPermission('EDIT_RECORDS'),
      canApproveEdit:         hasPermission('APPROVE_EDIT'),
      canRequestEdit:         hasPermission('REQUEST_EDIT'),
      canAddCase:             hasPermission('ADD_CASE'),

      canFlagDeletion:        hasPermission('FLAG_DELETION'),
      canEscalateDeletion:    hasPermission('ESCALATE_DELETION'),
      canRequestDeletion:     hasPermission('REQUEST_DELETION'),
      canApproveDeletion:     hasPermission('APPROVE_DELETION'),
      canExecuteDeletion:     hasPermission('EXECUTE_DELETION'),

      canSearch:              hasPermission('SEARCH_DISTRICT'),

      // Utility
      hasPermission,
      hasMinRole,
    };
  }, [role]);
}
