import prisma from './src/config/prisma';

async function main() {
  const users = await prisma.users.findMany({
    take: 10
  });
  console.log(`Found ${users.length} users:`);
  users.forEach(u => {
    console.log(`- Username: "${u.username}", FullName: "${u.full_name}", Role: "${u.role}"`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
