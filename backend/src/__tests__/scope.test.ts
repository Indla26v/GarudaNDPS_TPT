import { getCaseWhere, getOffenderWhere, ScopeUser } from '../utils/scope';

describe('Scope Utility', () => {
  it('should return empty where clause for SP role (district wide without district defined)', () => {
    const user: ScopeUser = { userId: 1, role: 'SP' };
    const where = getCaseWhere(user);
    expect(where).toEqual({});
  });

  it('should return district where clause for SP role if district is defined', () => {
    const user: ScopeUser = { userId: 1, role: 'SP', district: 'Tirupati' };
    const where = getCaseWhere(user);
    expect(where).toEqual({ police_stations: { district: 'Tirupati' } });
  });

  it('should return division where clause for SDPO role', () => {
    const user: ScopeUser = { userId: 2, role: 'SDPO', divisionId: 'Tirupati SDPO' };
    const where = getCaseWhere(user);
    expect(where).toEqual({ police_stations: { sdpo: 'Tirupati SDPO' } });
  });

  it('should return ps_id where clause for SHO role', () => {
    const user: ScopeUser = { userId: 3, role: 'SHO', policeStationId: 10 };
    const where = getCaseWhere(user);
    expect(where).toEqual({ ps_id: BigInt(10) });
  });

  it('should deny access if role is missing', () => {
    const user: any = { userId: 4 };
    const where = getCaseWhere(user);
    expect(where).toEqual({ id: BigInt(-1) });
  });

  it('should scope offenders exactly like cases for SHO', () => {
    const user: ScopeUser = { userId: 3, role: 'SHO', policeStationId: 10 };
    const where = getOffenderWhere(user);
    expect(where).toEqual({ ps_id: BigInt(10) });
  });
});
