import prisma from './src/config/prisma';

async function main() {
  const users = await prisma.users.findMany();
  console.log(`Found ${users.length} users:`);
  users.forEach(u => {
    console.log(`- Username: "${u.username}"`);
    console.log(`  FullName: "${u.full_name}"`);
    console.log(`  Role: "${u.role}"`);
    console.log(`  IsActive: ${u.is_active}`);
    console.log(`  FailedLoginCount: ${u.failed_login_count}`);
    console.log(`  LockedUntil: ${u.locked_until}`);
    console.log(`  LastLogin: ${u.last_login}`);
    console.log('-----------------------------------');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
