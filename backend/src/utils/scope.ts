/**
 * Row-level data scope by role + department.
 *
 * Station-level roles (DSP, CI, SI, Constable):
 *   → All queries scoped to their allotted police_station_id
 *
 * District-level roles (SP, ASP):
 *   → See all police stations in the district (no PS filter)
 *   → Still restricted to their allotted department on the frontend
 *
 * ADMIN:
 *   → No restrictions
 */
export interface ScopeUser {
  userId: number | string;
  role: string;
  department?: string | null;
  policeStationId?: number | string | null;
}

/** Roles that see only their own police station data */
const STATION_LEVEL_ROLES = ['DSP', 'CI', 'SI', 'CONSTABLE'];

/** Roles that see the entire district (all police stations) */
const DISTRICT_LEVEL_ROLES = ['SP', 'ASP'];

/**
 * Returns a Prisma `where` clause scoping cases by police station.
 * Station-level roles → ps_id = their station
 * District-level roles / ADMIN → {} (no filter)
 */
export function getCaseWhere(user: ScopeUser): Record<string, unknown> {
  if (!user?.role) return { id: BigInt(-1) };

  if (user.role === 'ADMIN' || DISTRICT_LEVEL_ROLES.includes(user.role)) {
    return {};
  }

  // Station-level: scope to their police station
  if (STATION_LEVEL_ROLES.includes(user.role) && user.policeStationId) {
    return { ps_id: BigInt(user.policeStationId) };
  }

  // Fallback: if no policeStationId is set, return nothing
  return {};
}

/**
 * Returns a Prisma `where` clause scoping offenders by police station.
 */
export function getOffenderWhere(user: ScopeUser): Record<string, unknown> {
  if (!user?.role) return { id: BigInt(-1) };

  if (user.role === 'ADMIN' || DISTRICT_LEVEL_ROLES.includes(user.role)) {
    return {};
  }

  if (STATION_LEVEL_ROLES.includes(user.role) && user.policeStationId) {
    return { ps_id: BigInt(user.policeStationId) };
  }

  return {};
}

/**
 * Returns a Prisma `where` clause for dashboard queries.
 * Station-level: { ps_id: X }
 * District-level / ADMIN: {} (all stations)
 */
export function getDashboardScope(user: ScopeUser): { psFilter: Record<string, unknown>; isStationLevel: boolean } {
  if (!user?.role) {
    return { psFilter: { id: BigInt(-1) }, isStationLevel: true };
  }

  if (user.role === 'ADMIN' || DISTRICT_LEVEL_ROLES.includes(user.role)) {
    return { psFilter: {}, isStationLevel: false };
  }

  if (STATION_LEVEL_ROLES.includes(user.role) && user.policeStationId) {
    return { psFilter: { ps_id: BigInt(user.policeStationId) }, isStationLevel: true };
  }

  return { psFilter: {}, isStationLevel: false };
}
