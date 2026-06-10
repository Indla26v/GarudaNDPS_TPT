/**
 * GARUDA — Re-seed users + create teams after schema reset
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const ROUNDS = 10;

  // ── Police Stations ──────────────────────────────────────────────────
  const policeStations = [
    // 1. Naidupet SDPO
    { name: 'Naidupeta UPS', ps_code: 'TPT-001', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Doravari Satram', ps_code: 'TPT-002', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Ozili', ps_code: 'TPT-003', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Pellakur', ps_code: 'TPT-004', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Sriharikota', ps_code: 'TPT-005', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Sullurpet', ps_code: 'TPT-006', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Tada', ps_code: 'TPT-007', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Balayapalli', ps_code: 'TPT-008', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Venkatagiri', ps_code: 'TPT-009', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Dakkili', ps_code: 'TPT-010', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Chittamuru', ps_code: 'TPT-011', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },
    { name: 'Vakadu', ps_code: 'TPT-012', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Naidupet SDPO' },

    // 2. Srikalahasti SDPO
    { name: 'Srikalahasthi I Town', ps_code: 'TPT-013', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Srikalahasti SDPO' },
    { name: 'Srikalahasti II Town', ps_code: 'TPT-014', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Srikalahasti SDPO' },
    { name: 'Srikalahasthi Rural', ps_code: 'TPT-015', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Srikalahasti SDPO' },
    { name: 'BN Kandriga', ps_code: 'TPT-016', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Srikalahasti SDPO' },
    { name: 'Thotambedu', ps_code: 'TPT-017', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Srikalahasti SDPO' },

    // 3. Renigunta SDPO
    { name: 'Renigunta UPS', ps_code: 'RGT', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Renigunta SDPO' },
    { name: 'Yerpedu UPS', ps_code: 'TPT-019', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Renigunta SDPO' },
    { name: 'Chitvel', ps_code: 'TPT-020', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Renigunta SDPO' },
    { name: 'Obulavaripalli', ps_code: 'TPT-021', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Renigunta SDPO' },
    { name: 'Penagalur', ps_code: 'TPT-022', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Renigunta SDPO' },
    { name: 'Pullampeta', ps_code: 'TPT-023', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Renigunta SDPO' },
    { name: 'Airport', ps_code: 'TPT-024', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Renigunta SDPO' },
    { name: 'Gajulamandyam', ps_code: 'TPT-025', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Renigunta SDPO' },

    // 4. Puttur SDPO
    { name: 'Puttur UPS', ps_code: 'TPT-026', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Puttur SDPO' },
    { name: 'Narayanavanam', ps_code: 'TPT-027', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Puttur SDPO' },
    { name: 'Pitchatoor', ps_code: 'TPT-028', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Puttur SDPO' },
    { name: 'K.V.B.Puram', ps_code: 'TPT-029', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Puttur SDPO' },
    { name: 'Vadamalpet', ps_code: 'TPT-030', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Puttur SDPO' },
    { name: 'Nagalapuram', ps_code: 'TPT-031', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Puttur SDPO' },
    { name: 'Satyavedu', ps_code: 'TPT-032', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Puttur SDPO' },
    { name: 'Vardaiahpalem', ps_code: 'TPT-033', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Puttur SDPO' },

    // 5. Chandragiri SDPO
    { name: 'Tirchanur UPS', ps_code: 'TCR', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Chandragiri SDPO' },
    { name: 'Tirupati Rural UPS', ps_code: 'TPT-035', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Chandragiri SDPO' },
    { name: 'Chandragiri UPS', ps_code: 'CGR-PS', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Chandragiri SDPO' },
    { name: 'RC Puram', ps_code: 'TPT-037', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Chandragiri SDPO' },
    { name: 'Pakala UPS', ps_code: 'TPT-038', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Chandragiri SDPO' },
    { name: 'Bhakarapet', ps_code: 'TPT-039', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Chandragiri SDPO' },
    { name: 'Yerravaripalem', ps_code: 'TPT-040', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Chandragiri SDPO' },

    // 6. Tirupati SDPO
    { name: 'Alipiri', ps_code: 'ALP', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Tirupati SDPO' },
    { name: 'Tirupathi East', ps_code: 'TP-EAST', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Tirupati SDPO' },
    { name: 'Tirupathi West', ps_code: 'TP-WEST', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Tirupati SDPO' },
    { name: 'S.V.U.Campus', ps_code: 'TPT-044', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Tirupati SDPO' },

    // 7. Tirumala SDPO
    { name: 'Tirumala I Town', ps_code: 'TPT-045', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Tirumala SDPO' },
    { name: 'Tirumala II Town', ps_code: 'TPT-046', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Tirumala SDPO' },

    // 8. Sri City SDPO
    { name: 'Sri City UPS', ps_code: 'SRC', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Sri City SDPO' },

    // Others
    { name: 'Tirupati Traffic', ps_code: 'TPT-048', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Tirupati Traffic' },
    { name: 'Tirumala Traffic', ps_code: 'TPT-049', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Tirumala Traffic' },
    { name: 'CCS , Tirupathi', ps_code: 'TPT-050', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'CCS , Tirupathi' },
    { name: 'CCS , Tirumala', ps_code: 'TPT-051', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'CCS , Tirumala' },
    { name: 'Mahila UPS Tirupati', ps_code: 'TPT-052', district: 'Tirupati', station_type: 'POLICE' as const, sdpo: 'Mahila UPS Tirupati' },
  ];

  const exciseStations = [
    { name: 'Excise PS Tirupati Urban', ps_code: 'EX-TPT-U', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS Tirupati Rural', ps_code: 'EX-TPT-R', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS SKHT', ps_code: 'EX-SKHT', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS PTR', ps_code: 'EX-PTR', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS NGLP', ps_code: 'EX-NGLP', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS CGR', ps_code: 'EX-CGR', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS TML', ps_code: 'EX-TML', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS GDR', ps_code: 'EX-GDR', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS NDP', ps_code: 'EX-NDP', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS SLPT', ps_code: 'EX-SLPT', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS VKD', ps_code: 'EX-VKD', district: 'Tirupati', station_type: 'EXCISE' as const },
    { name: 'Excise PS VGR', ps_code: 'EX-VGR', district: 'Tirupati', station_type: 'EXCISE' as const },
  ];

  for (const s of [...policeStations, ...exciseStations]) {
    await prisma.police_stations.upsert({
      where: { ps_code: s.ps_code },
      update: { name: s.name, station_type: s.station_type, sdpo: (s as any).sdpo || null },
      create: s,
    });
  }

  console.log('✅ Police & Excise stations seeded');

  // ── Teams ────────────────────────────────────────────────────────────
  const teams = [
    { name: 'Narcotics Task Force', department: 'POLICE' as const, description: 'Primary field operations for NDPS cases' },
    { name: 'Cyber Surveillance Unit', department: 'CYBER_ANALYTICS' as const, description: 'Technical surveillance, IMEI, CDR analysis & network mapping' },
    { name: 'Excise Enforcement Unit', department: 'EXCISE' as const, description: 'Excise department enforcement operations' },
  ];

  const teamMap: Record<string, bigint> = {};
  for (const t of teams) {
    const team = await prisma.teams.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
    teamMap[t.name] = team.id;
  }
  console.log('✅ Teams seeded');

  // ── Users ────────────────────────────────────────────────────────────
  const ps1 = await prisma.police_stations.findFirst({ where: { ps_code: 'TP-EAST' } });
  const exPs = await prisma.police_stations.findFirst({ where: { ps_code: 'EX-TPT-U' } });

  const users = [
    // SP — District Admin (Police)
    { username: 'sp', password: 'password123', full_name: 'K. Ramesh Kumar (SP)', role: 'SP' as const, department: 'POLICE' as const, team_id: null, district: 'Tirupati' },

    // ASP — District level (Police)
    { username: 'asp', password: 'password123', full_name: 'V. Srinivas Rao (ASP)', role: 'ASP' as const, department: 'POLICE' as const, team_id: teamMap['Narcotics Task Force'], district: 'Tirupati' },

    // SDPO — Multiple PS (Police)
    { username: 'sdpo', password: 'password123', full_name: 'P. Venkatesh (SDPO East)', role: 'SDPO' as const, department: 'POLICE' as const, team_id: teamMap['Narcotics Task Force'], division_id: 'Renigunta SDPO' },

    // SHO — One PS (Police)
    { username: 'sho', password: 'password123', full_name: 'M. Suresh (SHO)', role: 'SHO' as const, department: 'POLICE' as const, team_id: teamMap['Narcotics Task Force'], ps_id: ps1?.id },

    // Constable — One PS (Police)
    { username: 'constable', password: 'password123', full_name: 'B. Krishna (Constable)', role: 'CONSTABLE' as const, department: 'POLICE' as const, team_id: teamMap['Narcotics Task Force'], ps_id: ps1?.id },

    // ── Cyber Analytics (STF) ──────────────────────────────────────────
    { username: 'cyber_sdpo', password: 'password123', full_name: 'Vijay Singh (Cyber SDPO)', role: 'SDPO' as const, department: 'CYBER_ANALYTICS' as const, team_id: teamMap['Cyber Surveillance Unit'], badge: 'CA-001', division_id: 'Tirupati SDPO' },
    { username: 'cyber_sho', password: 'password123', full_name: 'Ravi Kumar (Cyber SHO)', role: 'SHO' as const, department: 'CYBER_ANALYTICS' as const, team_id: teamMap['Cyber Surveillance Unit'], badge: 'CA-002', ps_id: ps1?.id },

    // ── Excise ─────────────────────────────────────────────────────────
    { username: 'excise_sho', password: 'password123', full_name: 'Arjun Reddy (Excise SHO)', role: 'SHO' as const, department: 'EXCISE' as const, team_id: teamMap['Excise Enforcement Unit'], badge: 'EX-001', ps_id: exPs?.id },
  ];

  // Delete old-format users if they exist
  const oldUsernames = [
    'admin', 'sp_tirupati', 'asp_narcotics', 'dsp_east', 'ci_east',
    'si_field01', 'const_field01', 'tech_surv01',
    'fin_analyst01', 'net_analyst01', 'stf_narco01',
    'dsp', 'ci', 'si', 'tech_si', 'fin_si', 'net_si', 'stf_dsp',
  ];
  await prisma.users.deleteMany({
    where: {
      username: { in: oldUsernames }
    }
  });

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, ROUNDS);
    await prisma.users.upsert({
      where: { username: u.username },
      update: {
        password_hash: hash,
        full_name: u.full_name,
        role: u.role,
        department: u.department,
        badge_number: (u as any).badge || null,
        team_id: u.team_id || null,
        police_station_id: (u as any).ps_id || null,
        division_id: (u as any).division_id || null,
        district: (u as any).district || null,
        is_active: true,
      },
      create: {
        username: u.username,
        password_hash: hash,
        full_name: u.full_name,
        role: u.role,
        department: u.department,
        badge_number: (u as any).badge || null,
        team_id: u.team_id || null,
        police_station_id: (u as any).ps_id || null,
        division_id: (u as any).division_id || null,
        district: (u as any).district || null,
        is_active: true,
      },
    });
    console.log(`  ✅ Seeded user: ${u.username} (${u.role} / ${u.department})`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  D.A.R.T. — ALL LOGIN CREDENTIALS');
  console.log('═══════════════════════════════════════════════════════');
  for (const u of users) {
    console.log(`  ${u.role.padEnd(10)} │ ${u.username.padEnd(18)} │ ${u.password.padEnd(20)} │ ${u.department}`);
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
