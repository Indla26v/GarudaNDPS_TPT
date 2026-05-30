import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLES = ['SP', 'ASP', 'SDPO', 'SHO', 'CONSTABLE'];

async function main() {
  console.log('Seeding test credentials...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // We need at least one police station for users that require it
  let ps = await prisma.police_stations.findFirst();
  if (!ps) {
    ps = await prisma.police_stations.create({
      data: {
        ps_code: 'TEST01',
        name: 'Test Police Station',
        district: 'Test District',
      },
    });
  }

  const usersToCreate = [];

  for (const role of ROLES) {
    for (let i = 1; i <= 3; i++) {
        // Lowercase string for the username prefix
      const username = `${role.toLowerCase()}${i}`;
      
      usersToCreate.push({
        username: username,
        password_hash: passwordHash,
        full_name: `Test ${role} ${i}`,
        role: role as any,
        police_station_id: (role === 'SP' || role === 'ASP') ? null : ps.id, 
        is_active: true,
      });
    }
  }

  // Insert all users
  for (const user of usersToCreate) {
    const existing = await prisma.users.findUnique({ where: { username: user.username } });
    if (!existing) {
      await prisma.users.create({
        data: user,
      });
      console.log(`Created user: ${user.username} with role ${user.role}`);
    } else {
      console.log(`User ${user.username} already exists, skipping.`);
    }
  }

  console.log('\nSeed successful!');
  console.log('You can log in using any of the usernames (e.g., admin1, sp1, constable1)');
  console.log('Password for all users: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
