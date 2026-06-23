import request from 'supertest';
import app from '../server';
import prisma from '../config/prisma';
import jwt from 'jsonwebtoken';

describe('Surveillance API', () => {
  let shoToken: string;
  let offenderId: string;

  beforeAll(async () => {
    shoToken = jwt.sign({
      userId: '1',
      role: 'SHO',
      department: 'POLICE',
      policeStationId: '1',
      district: 'Tirupati',
      divisionId: null,
    }, process.env.JWT_SECRET || 'test-secret-key-for-testing-only');

    // Retrieve a seeded offender to use for surveillance checks
    const offender = await prisma.offenders.findFirst({
      where: { ps_id: BigInt(1) }
    });
    if (offender) {
      offenderId = offender.id.toString();
    } else {
      // Fallback: create a dummy offender if not found
      const newOffender = await prisma.offenders.create({
        data: {
          full_name: 'Surveillance Test Offender',
          ps_id: BigInt(1),
          status: 'ACTIVE',
        }
      });
      offenderId = newOffender.id.toString();
    }
  });

  afterAll(async () => {
    // Cleanup surveillance tests records
    await prisma.surveillance_records.deleteMany({
      where: { notes: 'Automated test check-in notes' }
    });
  });

  it('should successfully log a new GPS surveillance record', async () => {
    const res = await request(app)
      .post('/api/surveillance')
      .set('Authorization', `Bearer ${shoToken}`)
      .send({
        offenderId,
        status: 'COMPLETED',
        currentAddress: '123 Test Street, Tirupati',
        currentOccupation: 'Tester',
        associatesNoted: 'None',
        geo_lat: 13.6281,
        geo_lng: 79.4192,
        notes: 'Automated test check-in notes',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
  });

  it('should list surveillance records for the SHO police station', async () => {
    const res = await request(app)
      .get('/api/surveillance')
      .set('Authorization', `Bearer ${shoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const testRecord = res.body.data.find((r: any) => r.notes === 'Automated test check-in notes');
    expect(testRecord).toBeDefined();
    expect(testRecord.offenderId).toBe(offenderId);
  });

  it('should retrieve surveillance history for the specific offender', async () => {
    const res = await request(app)
      .get(`/api/surveillance/offender/${offenderId}`)
      .set('Authorization', `Bearer ${shoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].notes).toBe('Automated test check-in notes');
  });
});
