import request from 'supertest';
import app from '../server';
import prisma from '../config/prisma';
import jwt from 'jsonwebtoken';

describe('Offenders Controller', () => {
  let token: string;
  let spToken: string;

  beforeAll(async () => {
    // Generate token for testing
    token = jwt.sign({
      userId: '1',
      role: 'SHO',
      department: 'POLICE',
      policeStationId: '1',
      district: 'Tirupati',
      divisionId: null,
    }, process.env.JWT_SECRET || 'test-secret-key-for-testing-only');

    spToken = jwt.sign({
      userId: '2',
      role: 'SP',
      department: 'POLICE',
      policeStationId: null,
      district: 'Tirupati',
      divisionId: null,
    }, process.env.JWT_SECRET || 'test-secret-key-for-testing-only');
  });

  it('should fetch offenders list with 200 OK', async () => {
    const res = await request(app)
      .get('/api/offenders')
      .set('Authorization', `Bearer ${spToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('content');
    expect(Array.isArray(res.body.data.content)).toBe(true);
  });

  it('should return 401 if no auth token provided', async () => {
    const res = await request(app).get('/api/offenders');
    expect(res.status).toBe(401);
  });
});
