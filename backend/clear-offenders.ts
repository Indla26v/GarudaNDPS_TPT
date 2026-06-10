import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting database clear operations...');

  // 1. Delete case dependency records
  const dCS = await prisma.charge_sheets.deleteMany({});
  const dCH = await prisma.court_hearings.deleteMany({});
  const dBR = await prisma.bail_records.deleteMany({});
  const dSeizures = await prisma.seizures.deleteMany({});

  // 2. Delete offender dependency records
  const dContacts = await prisma.offender_contacts.deleteMany({});
  const dDocs = await prisma.offender_identity_docs.deleteMany({});
  const dProfiles = await prisma.offender_drug_profile.deleteMany({});
  const dFinancials = await prisma.offender_financials.deleteMany({});
  const dSCL = await prisma.supply_chain_links.deleteMany({});
  const dSurv = await prisma.surveillance_records.deleteMany({});
  const dInter = await prisma.interrogation_sessions.deleteMany({});
  const dIntel = await prisma.intelligence_inputs.deleteMany({});
  const dEnf = await prisma.enforcement_checks.deleteMany({});

  // 3. Delete case accused links
  const dCA = await prisma.case_accused.deleteMany({});

  // 4. Delete offenders and cases
  const dOffenders = await prisma.offenders.deleteMany({});
  const dCases = await prisma.cases.deleteMany({});

  console.log('Database clear operations completed successfully.');
  console.log('Deleted counts:');
  console.log(`- Offenders: ${dOffenders.count}`);
  console.log(`- Cases: ${dCases.count}`);
  console.log(`- Case Accused Links: ${dCA.count}`);
  console.log(`- Contacts: ${dContacts.count}`);
  console.log(`- Identity Docs: ${dDocs.count}`);
  console.log(`- Drug Profiles: ${dProfiles.count}`);
  console.log(`- Financials: ${dFinancials.count}`);
  console.log(`- Supply Chain Links: ${dSCL.count}`);
  console.log(`- Seizures: ${dSeizures.count}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
