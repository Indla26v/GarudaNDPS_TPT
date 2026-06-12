import prisma from './src/config/prisma';
import bcrypt from 'bcrypt';

async function updateAdmin() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed scripts cannot be run in production');
  }

  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error('SEED_PASSWORD environment variable required');
  }

  const hash = await bcrypt.hash(password, 10);
  await prisma.users.update({
    where: { username: 'admin' },
    data: { password_hash: hash }
  });
  console.log('Admin password updated via SEED_PASSWORD');
}

updateAdmin().catch(console.error).finally(() => prisma.$disconnect());
