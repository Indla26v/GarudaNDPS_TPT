import request from 'supertest';
import app from '../server';
import jwt from 'jsonwebtoken';

describe('Cases Controller', () => {
  let spToken: string;

  beforeAll(() => {
    spToken = jwt.sign({
      userId: '2',
      role: 'SP',
      department: 'POLICE',
      policeStationId: null,
      district: 'Tirupati',
      divisionId: null,
    }, process.env.JWT_SECRET || 'test-secret-key-for-testing-only');
  });

  it('should fetch cases list with 200 OK', async () => {
    const res = await request(app)
      .get('/api/cases')
      .set('Authorization', `Bearer ${spToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('content');
    expect(Array.isArray(res.body.data.content)).toBe(true);
  });
});
