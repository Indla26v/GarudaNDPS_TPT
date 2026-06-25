import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.users.count();
  console.log('Database users count:', count);
}
main().finally(() => prisma.$disconnect());
