import prisma from './src/config/prisma';
import bcrypt from 'bcrypt';

async function updateAdmin() {
  const hash = await bcrypt.hash('Admin@123', 10);
  await prisma.users.update({
    where: { username: 'admin' },
    data: { password_hash: hash }
  });
  console.log('Admin password updated to Admin@123');
}

updateAdmin().catch(console.error).finally(() => prisma.$disconnect());
