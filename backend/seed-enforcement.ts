import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const FIRST_NAMES = [
  'Kiran', 'Sandeep', 'Rakesh', 'Anand', 'Harish', 'Mahesh', 'Divya', 'Naresh',
  'Suresh', 'Rajesh', 'Venkatesh', 'Praveen', 'Pradeep', 'Srinivas', 'Bhaskar'
];

const LAST_NAMES = [
  'Kumar', 'Reddy', 'Naidu', 'Rao', 'Gowd', 'Singh', 'Choudhary', 'Teja'
];

const PLACES = [
  'Bustand Area', 'Railway Station Junction', 'Highway Toll Gate', 'Local College Road',
  'Weekly Market Yard', 'Industrial Zone Area', 'Near Lake Bridge', 'Park Entrance'
];

async function main() {
  console.log('Starting enforcement seeding operations...');

  // 1. Pre-hash password for fast execution
  const ROUNDS = 10;
  const defaultPasswordHash = await bcrypt.hash('password123', ROUNDS);

  // 2. Fetch all stations
  const stations = await prisma.police_stations.findMany();
  console.log(`Found ${stations.length} police stations.`);

  // 3. Upsert 1 SHO and 1 Constable for every station
  console.log('Upserting SHO and Constable users for each station...');
  let usersCreated = 0;
  const shoUsers: Record<string, any> = {};
  const constUsers: Record<string, any> = {};

  for (const ps of stations) {
    const dept = ps.station_type === 'EXCISE' ? 'EXCISE' : 'POLICE';
    
    const shoUsername = `${ps.ps_code.toLowerCase()}_sho`;
    const constUsername = `${ps.ps_code.toLowerCase()}_const`;

    const sho = await prisma.users.upsert({
      where: { username: shoUsername },
      update: {
        full_name: `${ps.name} SHO`,
        role: 'SHO',
        department: dept,
        police_station_id: ps.id,
        is_active: true,
      },
      create: {
        username: shoUsername,
        password_hash: defaultPasswordHash,
        full_name: `${ps.name} SHO`,
        role: 'SHO',
        department: dept,
        police_station_id: ps.id,
        is_active: true,
      },
    });

    const constable = await prisma.users.upsert({
      where: { username: constUsername },
      update: {
        full_name: `${ps.name} Constable`,
        role: 'CONSTABLE',
        department: dept,
        police_station_id: ps.id,
        is_active: true,
      },
      create: {
        username: constUsername,
        password_hash: defaultPasswordHash,
        full_name: `${ps.name} Constable`,
        role: 'CONSTABLE',
        department: dept,
        police_station_id: ps.id,
        is_active: true,
      },
    });

    shoUsers[ps.id.toString()] = sho;
    constUsers[ps.id.toString()] = constable;
    usersCreated += 2;
  }
  console.log(`Successfully upserted ${usersCreated} station users.`);

  // 4. Delete old enforcement checks
  console.log('Cleaning up old enforcement checks...');
  const deletedChecks = await prisma.enforcement_checks.deleteMany({});
  console.log(`Cleaned up ${deletedChecks.count} old enforcement checks.`);

  // 5. Fetch some offenders to simulate NDPS matches
  const offenders = await prisma.offenders.findMany({
    take: 30,
    include: {
      police_stations: true
    }
  });
  console.log(`Found ${offenders.length} offenders for match mapping.`);

  // 6. Generate enforcement check dummy data (around 20 records across various stations)
  console.log('Creating enforcement check records...');
  let enforcementCount = 0;

  for (let i = 0; i < 20; i++) {
    // Pick a random station that has our users
    const stationIndex = i % stations.length;
    const ps = stations[stationIndex]!;
    
    const constable = constUsers[ps.id.toString()];
    const sho = shoUsers[ps.id.toString()];

    if (!constable || !sho) continue;

    const firstName = FIRST_NAMES[(i * 3) % FIRST_NAMES.length]!;
    const lastName = LAST_NAMES[(i * 2) % LAST_NAMES.length]!;
    const subjectName = `${firstName} ${lastName}`;
    const subjectPhone = `98480${(20000 + i * 147).toString()}`;
    const place = PLACES[i % PLACES.length]!;

    // Determine if it matches an offender
    let ndpsMatch = false;
    let matchedOffenderId: bigint | null = null;
    let committedOffenderId: bigint | null = null;
    let lookupSummary = 'No match found in NDPS offender database.';
    let criminalRecordFound = false;

    // Map matches for approximately every third record
    if (i % 3 === 0 && offenders.length > 0) {
      // Find an offender from the same police station if possible, otherwise any offender
      const stationOffenders = offenders.filter(o => o.ps_id === ps.id);
      const offender = stationOffenders.length > 0 
        ? stationOffenders[i % stationOffenders.length]! 
        : offenders[i % offenders.length]!;

      ndpsMatch = true;
      matchedOffenderId = offender.id;
      criminalRecordFound = true;
      lookupSummary = `Alert: Subject matched with existing offender record SL_NO: ${offender.sl_no} (${offender.full_name}, ${offender.category})`;
    }

    // Determine status & test results
    let status: 'FIELD_CREATED' | 'NEGATIVE_CLOSED' | 'PENDING_SHO_REVIEW' | 'SHO_APPROVED' | 'SHO_REJECTED' = 'FIELD_CREATED';
    let testResult: 'PENDING' | 'POSITIVE' | 'NEGATIVE' = 'PENDING';
    let consumptionType: string | null = null;
    let reviewedBy: bigint | null = null;
    let reviewedAt: Date | null = null;
    let reviewNotes: string | null = null;

    if (i % 4 === 0) {
      status = 'FIELD_CREATED';
      testResult = 'PENDING';
    } else if (i % 4 === 1) {
      status = 'NEGATIVE_CLOSED';
      testResult = 'NEGATIVE';
    } else if (i % 4 === 2) {
      status = 'PENDING_SHO_REVIEW';
      testResult = 'POSITIVE';
      consumptionType = 'GANJA';
    } else {
      status = 'SHO_APPROVED';
      testResult = 'POSITIVE';
      consumptionType = 'GANJA';
      reviewedBy = sho.id;
      reviewedAt = new Date();
      reviewNotes = 'Enforcement record verified. Offender committed successfully.';
      if (ndpsMatch) {
        committedOffenderId = matchedOffenderId;
      }
    }

    await prisma.enforcement_checks.create({
      data: {
        subject_name: ndpsMatch && matchedOffenderId 
          ? offenders.find(o => o.id === matchedOffenderId)?.full_name || subjectName 
          : subjectName,
        subject_age: 20 + (i * 2) % 30,
        subject_gender: i % 10 === 0 ? 'FEMALE' : 'MALE',
        subject_aadhaar: `453287${(100000 + i * 137).toString()}`,
        place_of_enforcement: `${place}, ${ps.name}`,
        district: ps.district || 'Tirupati',
        subject_phone: subjectPhone,
        subject_pan: `ABCDE${(1000 + i * 29).toString()}F`,
        subject_address: `D.No ${12 + i}-${i * 2}, ${ps.name}, Andhra Pradesh`,
        subject_father_name: `S/o ${FIRST_NAMES[(i * 4) % FIRST_NAMES.length]} ${lastName}`,
        subject_landmark: 'Near Bus Stop',
        subject_occupation: i % 2 === 0 ? 'Unemployed' : 'Daily Wager',
        ndps_match: ndpsMatch,
        matched_offender_id: matchedOffenderId,
        criminal_record_found: criminalRecordFound,
        lookup_summary: lookupSummary,
        test_result: testResult,
        consumption_type: consumptionType,
        status: status,
        created_by: constable.id,
        ps_id: ps.id,
        reviewed_by: reviewedBy,
        reviewed_at: reviewedAt,
        review_notes: reviewNotes,
        committed_offender_id: committedOffenderId
      }
    });

    enforcementCount++;
  }

  console.log(`Successfully seeded ${enforcementCount} enforcement check records.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
