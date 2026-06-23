import request from 'supertest';
import app from '../server';
import jwt from 'jsonwebtoken';

describe('Operational Reports & Admin Settings API', () => {
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

  it('should fetch custom report builder results with JSON format', async () => {
    const res = await request(app)
      .get('/api/reports/custom')
      .set('Authorization', `Bearer ${spToken}`)
      .query({
        psId: 'ALL',
        contrabandType: 'ALL',
        stage: 'ALL',
        format: 'json'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('records');
    expect(Array.isArray(res.body.data.records)).toBe(true);
  });

  it('should fetch upcoming court diary hearings feed', async () => {
    const res = await request(app)
      .get('/api/reports/court-diary')
      .set('Authorization', `Bearer ${spToken}`)
      .query({ days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('hearings');
    expect(Array.isArray(res.body.data.hearings)).toBe(true);
  });

  it('should fetch performance metrics overview', async () => {
    const res = await request(app)
      .get('/api/reports/performance')
      .set('Authorization', `Bearer ${spToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('summary');
    expect(res.body.data.summary).toHaveProperty('totalCases');
    expect(res.body.data.summary).toHaveProperty('convictionRate');
    expect(res.body.data.summary).toHaveProperty('chargeSheetRate');
  });

  it('should retrieve system threshold settings', async () => {
    const res = await request(app)
      .get('/api/admin/settings')
      .set('Authorization', `Bearer ${spToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('CHARGE_SHEET_DUE_DAYS_COMMERCIAL');
  });

  it('should update system threshold settings', async () => {
    const res = await request(app)
      .post('/api/admin/settings')
      .set('Authorization', `Bearer ${spToken}`)
      .send({
        CHARGE_SHEET_DUE_DAYS_COMMERCIAL: '180',
        CHARGE_SHEET_DUE_DAYS_NON_COMMERCIAL: '60',
        ABSCONDER_ALERT_THRESHOLD_DAYS: '45', // Test unique change
        COURT_HEARING_REMINDER_DAYS: '2'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should retrieve server health diagnostics metrics', async () => {
    const res = await request(app)
      .get('/api/admin/system-health')
      .set('Authorization', `Bearer ${spToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('uptime');
    expect(res.body.data).toHaveProperty('dbSize');
    expect(res.body.data).toHaveProperty('activeUsersCount');
    expect(res.body.data).toHaveProperty('memory');
  });
});
