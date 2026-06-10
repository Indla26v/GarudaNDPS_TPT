import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const FIRST_NAMES = [
  'Ramesh', 'Suresh', 'Manoj', 'Venkat', 'Rajesh', 'Prakash', 'Anil', 'Srinivas', 
  'Bhaskar', 'Naveen', 'Ganesh', 'Vijay', 'Siva', 'Hari', 'Nagaraju', 'Prasad', 
  'Chandra', 'Madhava', 'Ravindra', 'Kalyan', 'Sudhakar', 'Narendra', 'Mohan', 
  'Jaya', 'Gangadhar', 'Balaji', 'Subramanyam', 'Lokesh', 'Naresh', 'Ramana', 
  'Krishna', 'Anand', 'Mahesh', 'Kiran', 'Satish', 'Raju', 'Gopal', 'Sekhar', 
  'Pavan', 'Ravi', 'Koti', 'Vamsi', 'Apparao', 'Konda', 'Chaitu', 'Babji'
];

const LAST_NAMES = [
  'Babu', 'Kumar', 'Gowd', 'Reddy', 'Naidu', 'Rao', 'Achari', 'Prasad', 
  'Shankar', 'Chakravarthy', 'Singh', 'Sastry', 'Murthy', 'Varma', 'Raju', 
  'Nayak', 'Patnaik', 'Choudhary', 'Swamy', 'Shekar', 'Teja', 'Pratap'
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
    await prisma.supply_chain_links.deleteMany({
      where: {
        OR: [
          { offender_id: o.id },
          { linked_offender_id: o.id }
        ]
      }
    });
    await prisma.case_accused.deleteMany({ where: { offender_id: o.id } });
    await prisma.surveillance_records.deleteMany({ where: { offender_id: o.id } });
    await prisma.interrogation_sessions.deleteMany({ where: { offender_id: o.id } });
    await prisma.intelligence_inputs.deleteMany({ where: { offender_id: o.id } });
    await prisma.enforcement_checks.deleteMany({
      where: {
        OR: [
          { matched_offender_id: o.id },
          { committed_offender_id: o.id }
        ]
      }
    });
    await prisma.offenders.delete({ where: { id: o.id } });
  }
  console.log(`Cleaned up ${oldOffenders.length} old offenders.`);

  const stations = await prisma.police_stations.findMany();
  console.log(`Found ${stations.length} police stations.`);

  const nonConsumerCategories = [
    'LOCAL_PEDDLER',
    'LOCAL_SUPPLIER',
    'LOCAL_KINGPIN',
    'TRANSPORTER',
    'INTERSTATE_KINGPIN'
  ];

  let seededCount = 0;
  for (let i = 0; i < stations.length; i++) {
    const ps = stations[i]!;

    // Seed 2 offenders per station: j = 0 (Consumer), j = 1 (Peddler/Supplier/etc.)
    for (let j = 0; j < 2; j++) {
      const firstName = FIRST_NAMES[(i * 2 + j) % FIRST_NAMES.length]!;
      const lastName = LAST_NAMES[(i * 3 + j * 7) % LAST_NAMES.length]!;
      const name = `${firstName} ${lastName}`;
      const category = j === 0 ? 'CONSUMER' : nonConsumerCategories[i % nonConsumerCategories.length]!;

      // Risk score: Consumers are LOW/MEDIUM, others are MEDIUM/HIGH/CRITICAL
      let riskScore: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
      if (category === 'CONSUMER') {
        riskScore = (i + j) % 2 === 0 ? 'LOW' : 'MEDIUM';
      } else if (category === 'LOCAL_PEDDLER' || category === 'TRANSPORTER') {
        riskScore = (i + j) % 2 === 0 ? 'MEDIUM' : 'HIGH';
      } else {
        riskScore = (i + j) % 2 === 0 ? 'HIGH' : 'CRITICAL';
      }

      // Test result: Consumers have higher rate of POSITIVE
      const testResult = category === 'CONSUMER' 
        ? ((i + j) % 10 < 7 ? 'POSITIVE' : (i + j) % 10 < 9 ? 'NEGATIVE' : 'PENDING')
        : ((i + j) % 3 === 0 ? 'POSITIVE' : (i + j) % 3 === 1 ? 'NEGATIVE' : 'PENDING');

      const monthlyIncome = category === 'CONSUMER'
        ? 10000 + (i % 5) * 4000
        : category.includes('KINGPIN')
          ? 60000 + (i % 5) * 15000
          : 18000 + (i % 5) * 5000;

      const offender = await prisma.offenders.create({
        data: {
          ps_id: ps.id,
          sl_no: `SL-${ps.ps_code}-${(100 + i * 2 + j).toString()}`,
          full_name: name,
          alias: `${firstName.toLowerCase()}_${ps.ps_code.toLowerCase()}_${j}`,
          father_husband_name: `${FIRST_NAMES[(i * 5 + j * 9) % FIRST_NAMES.length]} ${lastName}`,
          age: 18 + ((i * 7 + j * 13) % 45),
          gender: (i * 3 + j) % 12 === 0 ? 'FEMALE' : 'MALE',
          category: category as any,
          full_address: `D.No ${10 + i}-${j + 1}, Near Junction, ${ps.name}, Tirupati District`,
          landmark_area: j === 0 ? 'Near Bus Stop' : 'Junction Area',
          district: ps.district || 'Tirupati',
          state: ps.state || 'Andhra Pradesh',
          occupation: category === 'CONSUMER' 
            ? ((i + j) % 3 === 0 ? 'Student' : (i + j) % 3 === 1 ? 'Private Employee' : 'Unemployed')
            : ((i + j) % 3 === 0 ? 'Daily Wager' : (i + j) % 3 === 1 ? 'Mechanic' : 'Business'),
          status: 'ACTIVE',
          test_result: testResult as any,
          risk_score: riskScore,
          monthly_income: monthlyIncome,
          offender_contacts: {
            create: [
              {
                contact_type: 'MOBILE_PRIMARY',
                value: `98480${(10000 + i * 27 + j * 13).toString()}`,
                notes: 'Primary mobile number'
              },
              {
                contact_type: 'WHATSAPP',
                value: `98480${(10000 + i * 27 + j * 13).toString()}`,
                notes: 'Active WhatsApp number'
              },
              {
                contact_type: 'GMAIL',
                value: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${i}.${j}@gmail.com`,
                notes: 'Primary email'
              }
            ]
          },
          offender_identity_docs: {
            create: [
              {
                aadhaar_no: `453287${(100000 + i * 97 + j * 43).toString()}`,
                voter_id: `AP3208${(10000 + i * 37 + j * 19).toString()}`,
                pan_card: `ABCDE${(1000 + i * 13 + j * 7).toString()}F`
              }
            ]
          },
          offender_drug_profile: {
            create: {
              addiction_type: i % 3 === 0 ? 'GANJA_ONLY' : i % 3 === 1 ? 'GANJA_ALCOHOL' : 'GANJA_OTHER_DRUGS',
              consumption_frequency: i % 3 === 0 ? 'DAILY' : i % 3 === 1 ? 'WEEKLY' : 'OCCASIONAL',
              source_of_procurement: i % 3 === 0 ? 'LOCAL' : i % 3 === 1 ? 'ONLINE' : 'OUTSIDE_DISTRICT',
              mode_of_purchase: i % 3 === 0 ? 'UPI' : i % 3 === 1 ? 'CASH' : 'CREDIT',
              usual_consumption_spot: i % 2 === 0 ? 'Abandoned building' : 'Under the bridge',
              section_of_law: category === 'CONSUMER' ? 'Sec. 27 of NDPS Act' : 'Sec. 8(c) r/w 20(b)(ii)(B) of NDPS Act'
            }
          },
          offender_financials: {
            create: [
              {
                fin_type: 'UPI_ID',
                value: `${firstName.toLowerCase()}${lastName.toLowerCase()}${i}${j}@upi`,
                bank_name: i % 3 === 0 ? 'SBI' : i % 3 === 1 ? 'HDFC' : 'ICICI Bank',
                notes: 'UPI payment ID'
              },
              {
                fin_type: 'BANK_ACCOUNT_NO',
                value: `308945672${(100 + i * 2 + j).toString()}`,
                bank_name: i % 3 === 0 ? 'SBI' : i % 3 === 1 ? 'HDFC' : 'ICICI Bank',
                notes: 'Savings account'
              }
            ]
          },
          supply_chain_links_supply_chain_links_offender_idTooffenders: {
            create: [
              {
                link_type: i % 3 === 0 ? 'PEDDLER' : i % 3 === 1 ? 'SUPPLIER' : 'TRANSPORTER',
                linked_person_name: i % 2 === 0 ? 'Chandra Sekhar' : 'Appa Rao',
                linked_person_contact: `9440${(100000 + i * 73 + j * 29).toString()}`,
                notes: 'Identified contact'
              }
            ]
          }
        }
      });

      // Create a corresponding case for this offender
      const firNo = `${ps.ps_code}/2026/${100 + i * 2 + j}`;
      const caseDate = new Date(`2026-0${(i % 5) + 1}-${10 + j}`);

      // Choose stage
      const stages: ('FIR' | 'CHARGESHEET' | 'TRIAL' | 'CONVICTED')[] = ['FIR', 'CHARGESHEET', 'TRIAL', 'CONVICTED'];
      const stage = stages[(i * 2 + j) % stages.length]!;

      // Choose contraband
      const contrabands: ('DRY_GANJA' | 'GANJA_OIL' | 'BROWN_SUGAR' | 'MDMA' | 'HEROIN')[] = ['DRY_GANJA', 'GANJA_OIL', 'BROWN_SUGAR', 'MDMA', 'HEROIN'];
      const contrabandType = contrabands[(i * 2 + j) % contrabands.length]!;

      const qty = category === 'CONSUMER' ? 0.05 + (i % 5) * 0.02 : 1.5 + (i % 5) * 0.5;
      const val = category === 'CONSUMER' ? 1000 + (i % 5) * 500 : 25000 + (i % 5) * 10000;

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
          destination_location: 'Local distribution',
        }
      });

      // Create a seizure record for the case
      await prisma.seizures.create({
        data: {
          case_id: c.id,
          contraband_kg: qty,
          vehicles_count: category === 'CONSUMER' ? 0 : (i % 2 === 0 ? 1 : 0),
          cash_amount: category === 'CONSUMER' ? 0 : (2000 * i),
          seizure_date: caseDate
        }
      });

      // Create case_accused link
      let arrestStatus: 'ARRESTED' | 'ABSCONDING' | 'BAILED' = 'ARRESTED';
      if (stage === 'CONVICTED') {
        arrestStatus = 'ARRESTED';
      } else if ((i * 2 + j) % 5 === 0) {
        arrestStatus = 'ABSCONDING';
      } else if ((i * 2 + j) % 3 === 0) {
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
  }

  console.log(`Successfully seeded ${seededCount} detailed dummy offenders, cases, seizures, and accused linkages.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
