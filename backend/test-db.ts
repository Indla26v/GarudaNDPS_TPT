import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Connecting to NeonDB...');
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log('Connected successfully! Time:', result);
    
    // Check police_stations count
    const count = await prisma.police_stations.count();
    console.log(`Found ${count} police stations.`);
  } catch (err) {
    console.error('NeonDB Connection Failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
