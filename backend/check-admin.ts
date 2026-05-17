import prisma from './src/config/prisma';
import bcrypt from 'bcrypt';

async function checkAdmin() {
  const user = await prisma.users.findUnique({ where: { username: 'admin' } });
  if (!user) {
    console.log('User admin not found');
    return;
  }
  console.log('Admin user found:', user.username, user.role);
  
  const isMatch = await bcrypt.compare('Admin@123', user.password_hash);
  console.log('Admin@123 matches hash?:', isMatch);
}

checkAdmin().catch(console.error).finally(() => prisma.$disconnect());
