import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding new cases with multiple accused and seized vehicles...');

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
  const offenders = await prisma.offenders.findMany({ take: 5 });
  if (offenders.length < 2) {
    console.log('Not enough offenders in the DB to seed multiple accused. Please add some offenders first.');
    return;
  }

  // Case 1: Multiple accused, 1 vehicle
  const case1 = await prisma.cases.create({
    data: {
      fir_no: 'FIR/2026/01',
      ps_id: psId,
      section_of_law: '20(b)(ii)(c) NDPS Act',
      case_date: new Date(),
      stage: 'FIR',
      nature_of_offence: 'Transporting Ganja',
      contraband_type: 'DRY_GANJA',
      quantity: 50.5,
      quantity_unit: 'KG',
      source_location: 'Odisha border',
      destination_location: 'Tirupati',
      created_at: new Date(),
      updated_at: new Date(),
      case_accused: {
        create: [
          { offender_id: offenders[0]!.id, arrest_status: 'ARRESTED', arrest_date: new Date() },
          { offender_id: offenders[1]!.id, arrest_status: 'ABSCONDING' },
        ]
      },
      seizures: {
        create: [{
          contraband_kg: 50.5,
          vehicles_count: 1,
          cash_amount: 15000,
          seizure_date: new Date()
        }]
      },
      seized_vehicles: {
        create: [{
          vehicle_type: 'FOUR_WHEELER',
          registration_no: 'AP 03 BY 9999',
          make_model: 'Toyota Innova',
          color: 'White',
          owner_name: 'Rahul Kumar',
          owner_address: 'Plot 45, Vijayawada',
          seizure_location: 'Renigunta Toll Plaza',
          seizure_date: new Date(),
          current_status: 'SEIZED',
          remarks: 'Vehicle used for transporting dry ganja hidden in secret compartment.'
        }]
      }
    }
  });
  console.log(`Created Case 1: ${case1.fir_no} (2 accused, 1 vehicle)`);

  // Case 2: Multiple accused, Multiple vehicles
  if (offenders.length >= 4) {
    const case2 = await prisma.cases.create({
      data: {
        fir_no: 'FIR/2026/02',
        ps_id: psId,
        section_of_law: '8(c) r/w 21(c) NDPS Act',
        case_date: new Date(),
        stage: 'FIR',
        nature_of_offence: 'MDMA Peddling',
        contraband_type: 'MDMA',
        quantity: 120,
        quantity_unit: 'GRAMS',
        source_location: 'Bangalore',
        destination_location: 'Tirupati',
        created_at: new Date(),
        updated_at: new Date(),
        case_accused: {
          create: [
            { offender_id: offenders[2]!.id, arrest_status: 'ARRESTED', arrest_date: new Date() },
            { offender_id: offenders[3]!.id, arrest_status: 'ARRESTED', arrest_date: new Date() },
          ]
        },
        seizures: {
          create: [{
            contraband_kg: 0.12,
            vehicles_count: 2,
            cash_amount: 45000,
            seizure_date: new Date()
          }]
        },
        seized_vehicles: {
          create: [
            {
              vehicle_type: 'TWO_WHEELER',
              registration_no: 'KA 01 EK 1234',
              make_model: 'Royal Enfield Classic 350',
              color: 'Black',
              owner_name: 'Suresh Menon',
              seizure_location: 'Alipiri Road',
              seizure_date: new Date(),
              current_status: 'COURT_CUSTODY',
              remarks: 'Rider intercepted with MDMA pills.'
            },
            {
              vehicle_type: 'FOUR_WHEELER',
              registration_no: 'AP 39 CX 4321',
              make_model: 'Hyundai i20',
              color: 'Red',
              owner_name: 'Unknown',
              seizure_location: 'Alipiri Road',
              seizure_date: new Date(),
              current_status: 'SEIZED',
              remarks: 'Escort vehicle for the two-wheeler.'
            }
          ]
        }
      }
    });
    console.log(`Created Case 2: ${case2.fir_no} (2 accused, 2 vehicles)`);
  }

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
