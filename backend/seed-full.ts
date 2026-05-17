/**
 * GARUDA — Re-seed users + create teams after schema reset
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const ROUNDS = 12;

  // ── Police Stations ──────────────────────────────────────────────────
  const stations = [
    { name: 'Tirupati East PS', ps_code: 'TP-EAST', district: 'Tirupati' },
    { name: 'Tirupati West PS', ps_code: 'TP-WEST', district: 'Tirupati' },
    { name: 'Tiruchanoor PS', ps_code: 'TCR', district: 'Tirupati' },
    { name: 'Renigunta PS', ps_code: 'RGT', district: 'Tirupati' },
    { name: 'Chandragiri PS', ps_code: 'CGR', district: 'Tirupati' },
  ];

  for (const s of stations) {
    await prisma.police_stations.upsert({
      where: { ps_code: s.ps_code },
      update: {},
      create: s,
    });
  }
  console.log('✅ Police stations seeded');

  // ── Teams ────────────────────────────────────────────────────────────
  const teams = [
    { name: 'Narcotics Task Force', department: 'OPERATIONS' as const, description: 'Primary field operations for NDPS cases' },
    { name: 'Cyber Surveillance Unit', department: 'TECH_CELL' as const, description: 'Technical surveillance, IMEI, CDR analysis' },
    { name: 'Financial Intelligence Unit', department: 'FIN_CELL' as const, description: 'Hawala, UPI, money trail analysis' },
    { name: 'Data Analytics Team', department: 'ANALYST' as const, description: 'Network mapping, pattern analysis, intelligence correlation' },
    { name: 'Special Task Force', department: 'STF' as const, description: 'High-value target operations' },
    { name: 'Legal Cell', department: 'LEGAL' as const, description: 'Court cases, prosecution, bail monitoring' },
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

  const users = [
    // Admin (no team, ADMINISTRATION dept)
    { username: 'admin', password: 'Admin@12345', full_name: 'System Administrator', role: 'ADMIN' as const, department: 'ADMINISTRATION' as const, team_id: null },

    // SP — Operations
    { username: 'sp_tirupati', password: 'SP@2026#Garuda', full_name: 'K. Ramesh Kumar (SP)', role: 'SP' as const, department: 'OPERATIONS' as const, team_id: null },

    // ASP — Operations
    { username: 'asp_narcotics', password: 'ASP@2026#Garuda', full_name: 'V. Srinivas Rao (ASP)', role: 'ASP' as const, department: 'OPERATIONS' as const, team_id: teamMap['Narcotics Task Force'] },

    // DSP — Operations
    { username: 'dsp_east', password: 'DSP@2026#Garuda', full_name: 'P. Venkatesh (DSP East)', role: 'DSP' as const, department: 'OPERATIONS' as const, team_id: teamMap['Narcotics Task Force'] },

    // CI — Operations
    { username: 'ci_east', password: 'CI@2026#Garuda', full_name: 'M. Suresh (CI East)', role: 'CI' as const, department: 'OPERATIONS' as const, team_id: teamMap['Narcotics Task Force'], ps_id: ps1?.id },

    // SI — Operations
    { username: 'si_field01', password: 'SI@2026#Garuda', full_name: 'A. Rajesh (SI)', role: 'SI' as const, department: 'OPERATIONS' as const, team_id: teamMap['Narcotics Task Force'], ps_id: ps1?.id },

    // Constable — Operations
    { username: 'const_field01', password: 'Const@2026#Garuda', full_name: 'B. Krishna (Constable)', role: 'CONSTABLE' as const, department: 'OPERATIONS' as const, team_id: teamMap['Narcotics Task Force'], ps_id: ps1?.id },

    // ── Cyber Crime / Intelligence Teams ──────────────────────────────
    // Tech Cell
    { username: 'tech_surv01', password: 'Surv@2026#Garuda', full_name: 'Ravi Kumar - Tech Surveillance', role: 'SI' as const, department: 'TECH_CELL' as const, team_id: teamMap['Cyber Surveillance Unit'], badge: 'TC-001' },

    // Fin Cell
    { username: 'fin_analyst01', password: 'Finance@2026#Garuda', full_name: 'Priya Sharma - Financial Analyst', role: 'SI' as const, department: 'FIN_CELL' as const, team_id: teamMap['Financial Intelligence Unit'], badge: 'FC-001' },

    // Analyst
    { username: 'net_analyst01', password: 'Network@2026#Garuda', full_name: 'Arjun Reddy - Network Analyst', role: 'SI' as const, department: 'ANALYST' as const, team_id: teamMap['Data Analytics Team'], badge: 'AN-001' },

    // STF
    { username: 'stf_narco01', password: 'STF@2026#Garuda', full_name: 'Vijay Singh - STF Officer', role: 'DSP' as const, department: 'STF' as const, team_id: teamMap['Special Task Force'], badge: 'STF-001' },
  ];

  for (const u of users) {
    const existing = await prisma.users.findUnique({ where: { username: u.username } });
    if (existing) {
      console.log(`  ⚠️  ${u.username} exists — skipping`);
      continue;
    }
    const hash = await bcrypt.hash(u.password, ROUNDS);
    await prisma.users.create({
      data: {
        username: u.username,
        password_hash: hash,
        full_name: u.full_name,
        role: u.role,
        department: u.department,
        badge_number: (u as any).badge || null,
        team_id: u.team_id || null,
        police_station_id: (u as any).ps_id || null,
        is_active: true,
      },
    });
    console.log(`  ✅ Created: ${u.username} (${u.role} / ${u.department})`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  GARUDA — ALL LOGIN CREDENTIALS');
  console.log('═══════════════════════════════════════════════════════');
  for (const u of users) {
    console.log(`  ${u.role.padEnd(10)} │ ${u.username.padEnd(18)} │ ${u.password.padEnd(20)} │ ${u.department}`);
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
