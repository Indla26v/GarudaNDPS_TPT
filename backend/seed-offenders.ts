import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const OFFENDER_NAMES = [
  'Ramesh Babu', 'Suresh Kumar', 'Manoj Gowd', 'K. Venkat', 'Rajesh Sekhar',
  'Prakash Reddy', 'Anil Naidu', 'Srinivasulu', 'Bhaskar Rao', 'Naveen Kumar',
  'Ganesh Achari', 'Vijay Prasad', 'Sandhya Rani', 'Siva Shankar', 'Hari Prasad',
  'Nagaraju', 'Prasad Babu', 'Chandra Shekar', 'Madhava Rao', 'Ravindra',
  'Kalyan Chakravarthy', 'Sudhakar', 'Narendra', 'Mohan Krishna', 'Jaya Prakash',
  'Ramanjaneyulu', 'Gangadhar', 'Balaji Singh', 'Subramanyam', 'Lokesh Babu'
];

async function main() {
  // First, delete any existing seeded cases (which cascade deletes seizures and accused links)
  console.log('Cleaning up old seeded cases matching "/2026/"...');
  const deletedCases = await prisma.cases.deleteMany({
    where: {
      fir_no: {
        contains: '/2026/'
      }
    }
  });
  console.log(`Cleaned up ${deletedCases.count} old cases.`);

  // First, delete any existing seeded offenders that started with "SL-"
  console.log('Cleaning up old seeded offenders starting with "SL-"...');
  const oldOffenders = await prisma.offenders.findMany({
    where: { sl_no: { startsWith: 'SL-' } }
  });

  for (const o of oldOffenders) {
    // Delete nested relations due to possible cascade constraints
    await prisma.offender_contacts.deleteMany({ where: { offender_id: o.id } });
    await prisma.offender_identity_docs.deleteMany({ where: { offender_id: o.id } });
    await prisma.offender_drug_profile.deleteMany({ where: { offender_id: o.id } });
    await prisma.offender_financials.deleteMany({ where: { offender_id: o.id } });
    await prisma.supply_chain_links.deleteMany({ where: { offender_id: o.id } });
    await prisma.case_accused.deleteMany({ where: { offender_id: o.id } });
    await prisma.offenders.delete({ where: { id: o.id } });
  }
  console.log(`Cleaned up ${oldOffenders.length} old offenders.`);

  const stations = await prisma.police_stations.findMany();
  console.log(`Found ${stations.length} police stations.`);

  const categories = [
    'CONSUMER',
    'LOCAL_PEDDLER',
    'LOCAL_SUPPLIER',
    'LOCAL_KINGPIN',
    'TRANSPORTER',
    'INTERSTATE_KINGPIN'
  ];

  let seededCount = 0;
  for (let i = 0; i < stations.length; i++) {
    const ps = stations[i]!;
    const name = OFFENDER_NAMES[i % OFFENDER_NAMES.length]!;
    const firstName = name.split(' ')[0] ?? name;
    const category = categories[i % categories.length]!;

    const offender = await prisma.offenders.create({
      data: {
        ps_id: ps.id,
        sl_no: `SL-${ps.ps_code}-${(100 + i).toString()}`,
        full_name: name,
        alias: `${firstName.toLowerCase()}_${ps.ps_code.toLowerCase()}`,
        father_husband_name: 'Subba Rao',
        age: 22 + (i % 25),
        gender: 'MALE',
        category: category as any,
        full_address: `D.No 4-${i + 1}, Near Temple, ${ps.name}, Tirupati District`,
        landmark_area: 'Bus Stand Area',
        district: ps.district || 'Tirupati',
        state: ps.state || 'Andhra Pradesh',
        occupation: i % 2 === 0 ? 'Daily Wager' : 'Student',
        status: 'ACTIVE',
        test_result: i % 3 === 0 ? 'POSITIVE' : i % 3 === 1 ? 'NEGATIVE' : 'PENDING',
        risk_score: i % 4 === 0 ? 'LOW' : i % 4 === 1 ? 'MEDIUM' : i % 4 === 2 ? 'HIGH' : 'CRITICAL',
        monthly_income: 8000 + (i * 250),
        offender_contacts: {
          create: [
            {
              contact_type: 'MOBILE_PRIMARY',
              value: `98480${(10000 + i * 17).toString()}`,
              notes: 'Active primary mobile'
            },
            {
              contact_type: 'WHATSAPP',
              value: `98480${(10000 + i * 17).toString()}`,
              notes: 'WhatsApp active'
            },
            {
              contact_type: 'GMAIL',
              value: `${firstName.toLowerCase()}.${i}@gmail.com`,
              notes: 'Primary email'
            }
          ]
        },
        offender_identity_docs: {
          create: [
            {
              aadhaar_no: `453287${(100000 + i * 97).toString()}`,
              voter_id: `AP3208${(10000 + i * 37).toString()}`,
              pan_card: `ABCDE${(1000 + i * 13).toString()}F`
            }
          ]
        },
        offender_drug_profile: {
          create: {
            addiction_type: i % 3 === 0 ? 'GANJA_ONLY' : i % 3 === 1 ? 'GANJA_ALCOHOL' : 'GANJA_OTHER_DRUGS',
            consumption_frequency: i % 3 === 0 ? 'DAILY' : i % 3 === 1 ? 'WEEKLY' : 'OCCASIONAL',
            source_of_procurement: i % 3 === 0 ? 'LOCAL' : i % 3 === 1 ? 'ONLINE' : 'OUTSIDE_DISTRICT',
            mode_of_purchase: i % 3 === 0 ? 'UPI' : i % 3 === 1 ? 'CASH' : 'CREDIT',
            usual_consumption_spot: i % 2 === 0 ? 'Abandoned building area' : 'Local railway tracks'
          }
        },
        offender_financials: {
          create: [
            {
              fin_type: 'UPI_ID',
              value: `${firstName.toLowerCase()}${i}@ybl`,
              bank_name: i % 3 === 0 ? 'SBI' : i % 3 === 1 ? 'HDFC' : 'ICICI Bank',
              notes: 'UPI payment ID'
            },
            {
              fin_type: 'BANK_ACCOUNT_NO',
              value: `3089456720${i}`,
              bank_name: i % 3 === 0 ? 'SBI' : i % 3 === 1 ? 'HDFC' : 'ICICI Bank',
              notes: 'Savings account'
            }
          ]
        },
        supply_chain_links_supply_chain_links_offender_idTooffenders: {
          create: [
            {
              link_type: i % 3 === 0 ? 'PEDDLER' : i % 3 === 1 ? 'SUPPLIER' : 'TRANSPORTER',
              linked_person_name: i % 2 === 0 ? 'Appa Rao' : 'Chandra Sekhar',
              linked_person_contact: `9440${(100000 + i * 73).toString()}`,
              notes: 'Reported contact during interrogation'
            }
          ]
        }
      }
    });

    // Create a corresponding case for this offender
    const firNo = `${ps.ps_code}/2026/${100 + i}`;
    const caseDate = new Date(`2026-0${(i % 5) + 1}-15`);

    // Choose stage
    const stages: ('FIR' | 'CHARGESHEET' | 'TRIAL' | 'CONVICTED')[] = ['FIR', 'CHARGESHEET', 'TRIAL', 'CONVICTED'];
    const stage = stages[i % stages.length]!;

    // Choose contraband
    const contrabands: ('DRY_GANJA' | 'GANJA_OIL' | 'BROWN_SUGAR' | 'MDMA' | 'HEROIN')[] = ['DRY_GANJA', 'GANJA_OIL', 'BROWN_SUGAR', 'MDMA', 'HEROIN'];
    const contrabandType = contrabands[i % contrabands.length]!;

    const qty = 0.5 + (i * 0.15);
    const val = 5000 + (i * 1500);

    const c = await prisma.cases.create({
      data: {
        fir_no: firNo,
        ps_id: ps.id,
        section_of_law: category === 'CONSUMER' ? 'Sec. 27 of NDPS Act' : 'Sec. 8(c) r/w 20(b)(ii)(B) of NDPS Act',
        case_date: caseDate,
        stage: stage,
        nature_of_offence: category === 'CONSUMER' ? 'Consumption of Ganja' : 'Possession & Sale of Contraband',
        contraband_type: contrabandType,
        quantity: qty,
        quantity_unit: 'KG',
        street_value: val,
        department: ps.station_type === 'EXCISE' ? 'EXCISE' : 'POLICE',
        source_location: 'Tirupati Area',
        destination_location: 'Local delivery',
      }
    });

    // Create a seizure record for the case
    await prisma.seizures.create({
      data: {
        case_id: c.id,
        contraband_kg: qty,
        vehicles_count: i % 3 === 0 ? 0 : (i % 3),
        cash_amount: i % 2 === 0 ? (1500 * i) : 0,
        seizure_date: caseDate
      }
    });

    // Create case_accused link
    let arrestStatus: 'ARRESTED' | 'ABSCONDING' | 'BAILED' = 'ARRESTED';
    if (stage === 'CONVICTED') {
      arrestStatus = 'ARRESTED';
    } else if (i % 5 === 0) {
      arrestStatus = 'ABSCONDING';
    } else if (i % 3 === 0) {
      arrestStatus = 'BAILED';
    }

    await prisma.case_accused.create({
      data: {
        case_id: c.id,
        offender_id: offender.id,
        arrest_status: arrestStatus,
        arrest_date: arrestStatus === 'ABSCONDING' ? null : caseDate,
        bail_date: arrestStatus === 'BAILED' ? new Date(caseDate.getTime() + 10 * 24 * 60 * 60 * 1000) : null
      }
    });

    seededCount++;
  }

  console.log(`Successfully seeded ${seededCount} detailed dummy offenders, cases, seizures, and accused linkages.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
