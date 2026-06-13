import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const latestLogout = await prisma.audit_logs.findFirst({
    where: { action: 'LOGOUT' },
    orderBy: { timestamp: 'desc' }
  });
  console.log('Latest LOGOUT:', latestLogout);
}
main().finally(() => prisma.$disconnect());
