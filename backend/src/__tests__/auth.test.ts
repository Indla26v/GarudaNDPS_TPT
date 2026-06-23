import request from 'supertest';
import app from '../server';
import prisma from '../config/prisma';
import bcrypt from 'bcrypt';

describe('Auth Controller', () => {
  const testUser = {
    username: 'test_auth_user',
    password: 'password123',
    full_name: 'Test Auth User',
    role: 'SHO',
    department: 'POLICE',
  };

  beforeAll(async () => {
    // Create test user
    const existing = await prisma.users.findUnique({ where: { username: testUser.username } });
    if (!existing) {
      await prisma.users.create({
        data: {
          username: testUser.username,
          password_hash: await bcrypt.hash(testUser.password, 10),
          full_name: testUser.full_name,
          role: testUser.role as any,
          department: testUser.department as any,
        },
      });
    }
  });

  afterAll(async () => {
    // Cleanup
    const user = await prisma.users.findUnique({ where: { username: testUser.username } });
    if (user) {
      await prisma.audit_logs.deleteMany({ where: { user_id: user.id } });
      await prisma.users.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  it('should login successfully with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('username', testUser.username);
  });

  it('should return 401 for invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: testUser.username, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('should fail to access protected route without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
