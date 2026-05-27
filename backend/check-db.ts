import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const casesCount = await prisma.cases.count();
  const offendersCount = await prisma.offenders.count();
  const seizuresCount = await prisma.seizures.count();
  const accusedCount = await prisma.case_accused.count();
  const usersCount = await prisma.users.count();
  const psCount = await prisma.police_stations.count();

  console.log('--- DATABASE COUNTS ---');
  console.log(`Cases:          ${casesCount}`);
  console.log(`Offenders:      ${offendersCount}`);
  console.log(`Seizures:       ${seizuresCount}`);
  console.log(`Case Accused:   ${accusedCount}`);
  console.log(`Users:          ${usersCount}`);
  console.log(`PS/Excise:      ${psCount}`);
  
  if (casesCount > 0) {
    const sampleCases = await prisma.cases.findMany({ take: 3, include: { police_stations: true } });
    console.log('\nSample Cases:');
    sampleCases.forEach(c => {
      console.log(`- FIR: ${c.fir_no}, PS: ${c.police_stations.name}, Date: ${c.case_date}`);
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
