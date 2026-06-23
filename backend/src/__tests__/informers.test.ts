import request from 'supertest';
import app from '../server';
import prisma from '../config/prisma';
import jwt from 'jsonwebtoken';

describe('Informers API', () => {
  let spToken: string;
  let constableToken: string;
  let createdInformerId: string;

  beforeAll(() => {
    spToken = jwt.sign({
      userId: '2',
      role: 'SP',
      department: 'POLICE',
      policeStationId: null,
      district: 'Tirupati',
      divisionId: null,
    }, process.env.JWT_SECRET || 'test-secret-key-for-testing-only');

    constableToken = jwt.sign({
      userId: '4',
      role: 'CONSTABLE',
      department: 'POLICE',
      policeStationId: '1',
      district: 'Tirupati',
      divisionId: null,
    }, process.env.JWT_SECRET || 'test-secret-key-for-testing-only');
  });

  afterAll(async () => {
    // Delete intelligence inputs created for tests first to avoid foreign key violations
    await prisma.intelligence_inputs.deleteMany({
      where: { supply_route: 'Informer Test Route' }
    });
    // Cleanup informer test profiles
    await prisma.informers.deleteMany({
      where: { phone: '9999999999' }
    });
  });

  it('should successfully register a new informer when authenticated as SP', async () => {
    const res = await request(app)
      .post('/api/informers')
      .set('Authorization', `Bearer ${spToken}`)
      .send({
        codeName: 'INF-TEST-99',
        phone: '9999999999',
        rating: 'B',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    createdInformerId = res.body.data.id;
  });

  it('should prevent an informer registration if codeName already exists', async () => {
    const res = await request(app)
      .post('/api/informers')
      .set('Authorization', `Bearer ${spToken}`)
      .send({
        codeName: 'INF-TEST-99',
        phone: '9999999999',
        rating: 'B',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('already exists');
  });

  it('should block a CONSTABLE from viewing informers list (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/informers')
      .set('Authorization', `Bearer ${constableToken}`);

    expect(res.status).toBe(403);
  });

  it('should allow an SP to view the active informers list', async () => {
    const res = await request(app)
      .get('/api/informers')
      .set('Authorization', `Bearer ${spToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((inf: any) => inf.codeName === 'INF-TEST-99')).toBe(true);
  });

  it('should successfully deactivate an informer profile', async () => {
    const res = await request(app)
      .put(`/api/informers/${createdInformerId}`)
      .set('Authorization', `Bearer ${spToken}`)
      .send({
        status: 'INACTIVE',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify status update in list
    const listRes = await request(app)
      .get('/api/informers')
      .set('Authorization', `Bearer ${spToken}`);
    const updated = listRes.body.data.find((inf: any) => inf.id === createdInformerId);
    expect(updated.status).toBe('INACTIVE');
  });
});
