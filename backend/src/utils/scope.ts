/**
 * Row-level data scope by role + department.
 *
 * Station-level roles (SDPO, SHO, Constable):
 *   → All queries scoped to their allotted police_station_id
 *
 * District-level roles (SP, ASP):
 *   → See all police stations in the district (no PS filter)
 */
export interface ScopeUser {
  userId: number | string;
  role: string;
  department?: string | null;
  policeStationId?: number | string | null;
  district?: string | null;
  divisionId?: string | null;
}

/**
 * Returns a Prisma `where` clause scoping cases by police station or district/division.
 */
export function getCaseWhere(user: ScopeUser): Record<string, any> {
  if (!user?.role) return { id: BigInt(-1) };

  // SP and ASP roles: scoped to district
  if (user.role === 'SP' || user.role === 'ASP') {
    if (user.district) {
      return { police_stations: { district: user.district } };
    }
    return {};
  }

  // SDPO role: scoped to subdivision
  if (user.role === 'SDPO') {
    if (user.divisionId) {
      return { police_stations: { sdpo: user.divisionId } };
    }
    return {};
  }

  // Station-level: scope to their police station
  if (user.policeStationId) {
    return { ps_id: BigInt(user.policeStationId) };
  }

  return {};
}

/**
 * Returns a Prisma `where` clause scoping offenders by police station or district/division.
 */
export function getOffenderWhere(user: ScopeUser): Record<string, any> {
  if (!user?.role) return { id: BigInt(-1) };

  // SP and ASP roles: scoped to district
  if (user.role === 'SP' || user.role === 'ASP') {
    if (user.district) {
      return { police_stations: { district: user.district } };
    }
    return {};
  }

  // SDPO role: scoped to subdivision
  if (user.role === 'SDPO') {
    if (user.divisionId) {
      return { police_stations: { sdpo: user.divisionId } };
    }
    return {};
  }

  if (user.policeStationId) {
    return { ps_id: BigInt(user.policeStationId) };
  }

  return {};
}

/**
 * Returns a Prisma `where` clause for dashboard queries.
 */
export function getDashboardScope(user: ScopeUser): { psFilter: Record<string, any>; isStationLevel: boolean } {
  if (!user?.role) {
    return { psFilter: { id: BigInt(-1) }, isStationLevel: true };
  }

  if (user.role === 'SP' || user.role === 'ASP') {
    if (user.district) {
      return { psFilter: { police_stations: { district: user.district } }, isStationLevel: false };
    }
    return { psFilter: {}, isStationLevel: false };
  }

  if (user.role === 'SDPO') {
    if (user.divisionId) {
      return { psFilter: { police_stations: { sdpo: user.divisionId } }, isStationLevel: false };
    }
    return { psFilter: {}, isStationLevel: false };
  }

  if (user.policeStationId) {
    return { psFilter: { ps_id: BigInt(user.policeStationId) }, isStationLevel: true };
  }

  return { psFilter: {}, isStationLevel: false };
}
