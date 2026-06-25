import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Cleaning old custom seeded cases matching "FIR/2026/V%"...');
  const deletedCases = await prisma.cases.deleteMany({
    where: {
      fir_no: {
        startsWith: 'FIR/2026/V'
      }
    }
  });
  console.log(`Cleaned up ${deletedCases.count} old custom cases.`);

  // 1. Get a police station
  const ps = await prisma.police_stations.findFirst({
    where: { name: { contains: 'Tirupati' } }
  });
  const fallbackPs = await prisma.police_stations.findFirst();
  const psId = ps?.id || fallbackPs?.id;

  if (!psId) {
    console.log('No police stations found, cannot seed cases.');
    return;
  }

  // 2. Get some offenders
  const offenders = await prisma.offenders.findMany({ take: 10 });
  if (offenders.length < 5) {
    console.log('Not enough offenders in the DB to seed multiple accused. Please run seed-offenders first.');
    return;
  }

  console.log(`Found ${offenders.length} offenders in the DB. Seeding new cases with more than 2 accused...`);

  // Case 1: 3 accused (offender 0, 1, 2), 1 vehicle seized
  const case1 = await prisma.cases.create({
    data: {
      fir_no: 'FIR/2026/V1',
      ps_id: psId,
      section_of_law: '20(b)(ii)(C) of NDPS Act',
      case_date: new Date(),
      stage: 'FIR',
      nature_of_offence: 'Interstate trafficking of Dry Ganja',
      contraband_type: 'DRY_GANJA',
      quantity: 120.5,
      quantity_unit: 'KG',
      source_location: 'Koraput, Odisha',
      destination_location: 'Tirupati Town',
      created_at: new Date(),
      updated_at: new Date(),
      case_accused: {
        create: [
          { offender_id: offenders[0]!.id, arrest_status: 'ARRESTED', arrest_date: new Date() },
          { offender_id: offenders[1]!.id, arrest_status: 'ARRESTED', arrest_date: new Date() },
          { offender_id: offenders[2]!.id, arrest_status: 'ABSCONDING' },
        ]
      },
      seizures: {
        create: [{
          contraband_kg: 120.5,
          vehicles_count: 1,
          cash_amount: 32000,
          seizure_date: new Date()
        }]
      },
      seized_vehicles: {
        create: [{
          vehicle_type: 'FOUR_WHEELER',
          registration_no: 'AP 39 TB 5566',
          make_model: 'Mahindra Bolero Pickup',
          color: 'White',
          owner_name: 'Jagannath Rao',
          owner_address: 'Gajuwaka, Visakhapatnam',
          seizure_location: 'Karkambadi Checkpost',
          seizure_date: new Date(),
          current_status: 'SEIZED',
          remarks: 'Vehicle seized with 120.5 KG of dry ganja packed in synthetic bags hidden under vegetable crates.'
        }]
      }
    }
  });
  console.log(`Created Case 1: ${case1.fir_no} (3 accused, 1 vehicle)`);

  // Case 2: 4 accused (offenders 3, 4, 0, 1), 2 vehicles seized
  const case2 = await prisma.cases.create({
    data: {
      fir_no: 'FIR/2026/V2',
      ps_id: psId,
      section_of_law: '22(c) r/w 27A of NDPS Act',
      case_date: new Date(),
      stage: 'FIR',
      nature_of_offence: 'MDMA Commercial Quantity Peddling',
      contraband_type: 'MDMA',
      quantity: 250,
      quantity_unit: 'GRAMS',
      source_location: 'Electronic City, Bangalore',
      destination_location: 'Tirupati University Area',
      created_at: new Date(),
      updated_at: new Date(),
      case_accused: {
        create: [
          { offender_id: offenders[3]!.id, arrest_status: 'ARRESTED', arrest_date: new Date() },
          { offender_id: offenders[4]!.id, arrest_status: 'ARRESTED', arrest_date: new Date() },
          { offender_id: offenders[0]!.id, arrest_status: 'BAILED', arrest_date: new Date(), bail_date: new Date() },
          { offender_id: offenders[1]!.id, arrest_status: 'ARRESTED', arrest_date: new Date() },
        ]
      },
      seizures: {
        create: [{
          contraband_kg: 0.25,
          vehicles_count: 2,
          cash_amount: 150000,
          seizure_date: new Date()
        }]
      },
      seized_vehicles: {
        create: [
          {
            vehicle_type: 'FOUR_WHEELER',
            registration_no: 'KA 51 MB 1122',
            make_model: 'Hyundai Creta',
            color: 'Dark Knight',
            owner_name: 'Vikram Gowda',
            owner_address: 'HSR Layout, Bangalore',
            seizure_location: 'Alipiri Checkpost',
            seizure_date: new Date(),
            current_status: 'SEIZED',
            remarks: 'Creta intercepted carrying commercial quantity of MDMA crystal pills.'
          },
          {
            vehicle_type: 'TWO_WHEELER',
            registration_no: 'AP 03 CR 7788',
            make_model: 'KTM Duke 390',
            color: 'Orange-Black',
            owner_name: 'Lokesh Naidu',
            owner_address: 'SV University Campus Road, Tirupati',
            seizure_location: 'Alipiri Checkpost',
            seizure_date: new Date(),
            current_status: 'SEIZED',
            remarks: 'Duke 390 used for local distribution in Tirupati university zone.'
          }
        ]
      }
    }
  });
  console.log(`Created Case 2: ${case2.fir_no} (4 accused, 2 vehicles)`);

  console.log('Seeding completed successfully!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
