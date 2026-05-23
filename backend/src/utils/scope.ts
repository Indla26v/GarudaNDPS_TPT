/**
 * Row-level data scope by role (Phase 1).
 */
export interface ScopeUser {
  userId: number | string;
  role: string;
  policeStationId?: number | string | null;
}

export function getCaseWhere(user: ScopeUser): Record<string, unknown> {
  if (!user?.role) return { id: BigInt(-1) };

  if (['ADMIN', 'SP', 'ASP'].includes(user.role)) {
    return {};
  }

  if (user.role === 'DSP' || user.role === 'CI' || user.role === 'CONSTABLE') {
    if (user.policeStationId) {
      return { ps_id: BigInt(user.policeStationId) };
    }
  }

  if (user.role === 'SI') {
    return { created_by: BigInt(user.userId) };
  }

  if (user.policeStationId) {
    return { ps_id: BigInt(user.policeStationId) };
  }

  return {};
}

export function getOffenderWhere(user: ScopeUser): Record<string, unknown> {
  if (!user?.role) return { id: BigInt(-1) };

  if (['ADMIN', 'SP', 'ASP'].includes(user.role)) {
    return {};
  }

  if (['DSP', 'CI', 'SI', 'CONSTABLE'].includes(user.role) && user.policeStationId) {
    return { ps_id: BigInt(user.policeStationId) };
  }

  return {};
}
