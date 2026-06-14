import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding preventive module checks...');

  const users = await prisma.users.findMany({
    where: {
      police_station_id: { not: null }
    },
    take: 5
  });

  if (users.length === 0) {
    console.log('No users found with a police station. Cannot seed.');
    return;
  }

  // Common random locations (Tirupati roughly 13.6288, 79.4192)
  const getRandomLat = () => 13.6288 + (Math.random() - 0.5) * 0.1;
  const getRandomLng = () => 79.4192 + (Math.random() - 0.5) * 0.1;

  for (const user of users) {
    console.log(`Seeding for user ${user.full_name}...`);
    const psId = user.police_station_id!;
    const uId = user.id;

    // Village Visit
    await prisma.village_visits.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        village_name: 'Tiruchanoor',
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });

    // Lodge Check
    await prisma.lodge_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        lodge_name: 'Sri Balaji Residency',
        manager_name: 'Kumar',
        checked_guest_register: true,
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });

    // Drunk Drive
    await prisma.drunk_drive_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        vehicle_no: 'AP03 BL 1234',
        driver_name: 'Ramesh',
        bac_level: 45.5,
        fine_amount: 10000,
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });

    // Vehicle Checks
    await prisma.vehicle_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        vehicle_no: 'AP03 CK 9876',
        driver_name: 'Suresh',
        checked_boot: true,
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });

    // MV Act Cases
    await prisma.mv_act_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        vehicle_no: 'AP03 AB 5555',
        driver_name: 'Venkat',
        violation_type: 'No Helmet',
        fine_amount: 1035,
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });

    // Palle Nidra
    await prisma.palle_nidra_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        village_name: 'Chandragiri',
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });
    
    // Rowdy Sheeter
    await prisma.rowdy_sheeter_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        rowdy_sheeter_name: 'Ramu',
        rowdy_sheet_no: 'RS-123',
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });

    // Bound Over
    await prisma.bound_over_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        subject_name: 'Siva',
        court_order_no: 'Cr 45/2023',
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });
    
    // Courier Check
    await prisma.courier_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        courier_office_name: 'DTDC',
        checked_register: true,
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });

    // Railway Check
    await prisma.railway_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        station_name: 'Tirupati Main',
        passengers_profiled: 45,
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });

    // Bus Stand Check
    await prisma.bus_stand_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        bus_stand_name: 'Central Bus Stand',
        passengers_checked: 28,
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });
    
    // Petty Cases
    await prisma.petty_cases_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        accused_name: 'Kiran',
        act_section: 'Sec 290 IPC',
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });

    // Drone
    await prisma.drone_surveillance_checks.create({
      data: {
        officer_id: uId,
        ps_id: psId,
        area_name: 'Seshachalam Forest Edge',
        ganja_detected: false,
        geo_lat: getRandomLat(),
        geo_lng: getRandomLng(),
      }
    });
  }

  console.log('Seeding completed!');
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
