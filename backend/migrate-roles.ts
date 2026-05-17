/**
 * Phase 1: Map old values to values that exist in BOTH old and new enum sets.
 * Common values between old and new: INTELLIGENCE, LEGAL, STF
 * So map everything to INTELLIGENCE first (safe), then db push, then fix.
 */
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function main() {
  // Map ALL departments to values that exist in BOTH old and new enums
  // INTELLIGENCE, LEGAL, STF exist in both
  await p.$executeRawUnsafe(`UPDATE users SET department = 'INTELLIGENCE' WHERE department IN ('POLICE', 'EXCISE', 'TECHNICAL', 'ADMIN_DEPT')`);
  
  // Map old roles to roles that exist in both old and new enums
  // ADMIN, SP, DSP, CI, SI, CONSTABLE exist in both
  await p.$executeRawUnsafe(`UPDATE users SET role = 'CONSTABLE' WHERE role IN ('EXCISE_OFFICER', 'EXCISE_SI', 'EXCISE_CI', 'PROSECUTOR', 'COURT_LIAISON')`);
  await p.$executeRawUnsafe(`UPDATE users SET role = 'SI' WHERE role IN ('TECH_CELL', 'FIN_CELL', 'ANALYST', 'STF_OFFICER')`);

  console.log('✅ Phase 1 migration done — safe for db push');
  
  const users = await p.$queryRawUnsafe(`SELECT id, username, role, department FROM users`);
  console.table(users);
}

main().catch(console.error).finally(() => p.$disconnect());
