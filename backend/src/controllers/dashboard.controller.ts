/**
 * GARUDA — Command Dashboard Controller
 * 
 * Provides aggregated KPI data for the dashboard:
 *  - Total cases, offenders, arrests, absconders
 *  - Pending charge sheets, convictions
 *  - Year-wise case trend (2016–2026)
 *  - Station-wise breakdown
 *  - Drug type breakdown (from seizure categories)
 *  - Case stage distribution
 *  - Recent alerts (new cases, absconders)
 */
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    // ── Core KPIs ──────────────────────────────────────────────────────
    const totalCases = await prisma.cases.count();
    const totalOffenders = await prisma.offenders.count();
    const totalArrests = await prisma.case_accused.count({ where: { arrest_status: 'ARRESTED' } });
    const totalAbsconders = await prisma.case_accused.count({ where: { arrest_status: 'ABSCONDING' } });

    // Pending charge sheets = cases in FIR stage
    const pendingChargeSheets = await prisma.cases.count({ where: { stage: 'FIR' } });

    // Pending court cases = cases under TRIAL
    const pendingCourtCases = await prisma.cases.count({ where: { stage: 'TRIAL' } });

    // Convictions this year
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01`);
    const convictionsThisYear = await prisma.cases.count({
      where: {
        stage: 'CONVICTED',
        updated_at: { gte: yearStart },
      },
    });

    // ── Seizure aggregation ────────────────────────────────────────────
    const seizureAgg = await prisma.seizures.aggregate({
      _sum: {
        contraband_kg: true,
        cash_amount: true,
        vehicles_count: true,
      }
    });

    const totalContraband = seizureAgg._sum.contraband_kg || 0;
    const totalCash = seizureAgg._sum.cash_amount || 0;
    const totalVehicles = seizureAgg._sum.vehicles_count || 0;

    const historicalBaseline: Record<number, { cases: number; arrests: number }> = {
      2016: { cases: 2, arrests: 2 },
      2017: { cases: 6, arrests: 5 },
      2018: { cases: 13, arrests: 11 },
      2019: { cases: 18, arrests: 16 },
      2020: { cases: 16, arrests: 14 },
      2021: { cases: 47, arrests: 42 },
      2022: { cases: 34, arrests: 30 },
      2023: { cases: 46, arrests: 41 },
      2024: { cases: 85, arrests: 78 },
      2025: { cases: 65, arrests: 58 },
    };

    const casesByYear = await prisma.$queryRaw<{ year: number; count: bigint }[]>`
      SELECT EXTRACT(YEAR FROM case_date)::int AS year, COUNT(*)::bigint AS count
      FROM cases
      WHERE case_date IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `;
    const arrestsByYear = await prisma.$queryRaw<{ year: number; count: bigint }[]>`
      SELECT EXTRACT(YEAR FROM c.case_date)::int AS year, COUNT(*)::bigint AS count
      FROM case_accused ca
      JOIN cases c ON c.id = ca.case_id
      WHERE ca.arrest_status = 'ARRESTED' AND c.case_date IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `;

    const caseYearMap = new Map(casesByYear.map((r) => [Number(r.year), Number(r.count)]));
    const arrestYearMap = new Map(arrestsByYear.map((r) => [Number(r.year), Number(r.count)]));

    const trendEndYear = new Date().getFullYear();
    const yearWiseTrend = [];
    for (let y = 2016; y <= trendEndYear; y++) {
      const dbCases = caseYearMap.get(y) ?? 0;
      const dbArrests = arrestYearMap.get(y) ?? 0;
      const baseline = historicalBaseline[y];
      yearWiseTrend.push({
        year: y,
        cases: dbCases > 0 ? dbCases : (baseline?.cases ?? 0),
        arrests: dbArrests > 0 ? dbArrests : (baseline?.arrests ?? 0),
        fromDatabase: dbCases > 0 || dbArrests > 0,
      });
    }

    // ── Case stage distribution ─────────────────────────────────────────
    const stageDistribution = await prisma.cases.groupBy({
      by: ['stage'],
      _count: { id: true },
    });

    const caseStages = stageDistribution.map(s => ({
      stage: s.stage,
      count: s._count.id,
    }));

    const contrabandColors: Record<string, string> = {
      DRY_GANJA: '#22c55e',
      GANJA_OIL: '#84cc16',
      BROWN_SUGAR: '#f59e0b',
      HEROIN: '#dc2626',
      MDMA: '#ef4444',
      SYNTHETIC: '#8b5cf6',
      COCAINE: '#ec4899',
      OPIUM: '#78716c',
      OTHER: '#6b7280',
    };
    const contrabandLabels: Record<string, string> = {
      DRY_GANJA: 'Dry Ganja',
      GANJA_OIL: 'Ganja Oil',
      BROWN_SUGAR: 'Brown Sugar',
      HEROIN: 'Heroin',
      MDMA: 'MDMA',
      SYNTHETIC: 'Synthetic',
      COCAINE: 'Cocaine',
      OPIUM: 'Opium',
      OTHER: 'Others',
    };
    const contrabandGroups = await prisma.cases.groupBy({
      by: ['contraband_type'],
      _count: { id: true },
      where: { contraband_type: { not: null } },
    });
    const drugTypeBreakdown = contrabandGroups.length > 0
      ? contrabandGroups.map((g) => ({
          type: contrabandLabels[g.contraband_type as string] || g.contraband_type,
          value: g._count.id,
          color: contrabandColors[g.contraband_type as string] || '#6b7280',
        }))
      : [
          { type: 'Dry Ganja', value: 0, color: '#22c55e' },
          { type: 'Others', value: 0, color: '#6b7280' },
        ];

    // ── Station-wise breakdown ──────────────────────────────────────────
    const allPs = await prisma.police_stations.findMany();

    const psWiseData = await Promise.all(allPs.map(async (ps) => {
      const psId = ps.id;

      const psCases = await prisma.cases.count({ where: { ps_id: psId } });
      const psOffenders = await prisma.offenders.count({ where: { ps_id: psId } });

      const psArrests = await prisma.case_accused.count({
        where: {
          cases: { ps_id: psId },
          arrest_status: 'ARRESTED'
        }
      });
      const psAbsconding = await prisma.case_accused.count({
        where: {
          cases: { ps_id: psId },
          arrest_status: 'ABSCONDING'
        }
      });

      const psSeizureAgg = await prisma.seizures.aggregate({
        where: { cases: { ps_id: psId } },
        _sum: { contraband_kg: true, cash_amount: true }
      });

      return {
        psId: psId.toString(),
        psName: ps.name,
        psCode: ps.ps_code,
        totalCases: psCases,
        totalOffenders: psOffenders,
        totalArrests: psArrests,
        totalAbsconders: psAbsconding,
        totalContrabandKg: psSeizureAgg._sum.contraband_kg || 0,
        totalCashSeized: psSeizureAgg._sum.cash_amount || 0
      };
    }));

    // ── Recent activity / alerts ─────────────────────────────────────────
    const recentCases = await prisma.cases.findMany({
      take: 5,
      orderBy: { created_at: 'desc' },
      include: { police_stations: { select: { name: true } } },
    });

    const recentAlerts = recentCases.map(c => ({
      id: c.id.toString(),
      type: 'NEW_CASE',
      message: `New case ${c.fir_no} registered at ${c.police_stations?.name || 'Unknown PS'}`,
      date: c.created_at,
    }));

    // Add absconder alerts
    const recentAbsconders = await prisma.case_accused.findMany({
      where: { arrest_status: 'ABSCONDING' },
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        offenders: { select: { full_name: true } },
        cases: { select: { fir_no: true } },
      },
    });

    recentAbsconders.forEach(a => {
      recentAlerts.push({
        id: a.id.toString(),
        type: 'ABSCONDER',
        message: `${a.offenders?.full_name || 'Unknown'} absconding in case ${a.cases?.fir_no || '?'}`,
        date: a.created_at,
      });
    });

    // ── Edit requests pending ────────────────────────────────────────────
    const editRequests = await prisma.edit_requests.findMany({
      where: { status: 'PENDING' },
      take: 5,
      orderBy: { created_at: 'desc' },
    });

    // ── Absconder list for ticker ────────────────────────────────────────
    const absconders = await prisma.case_accused.findMany({
      where: { arrest_status: 'ABSCONDING' },
      take: 10,
      include: {
        offenders: { select: { full_name: true } },
        cases: { select: { fir_no: true, case_date: true } },
      },
    });

    const absconderTicker = absconders.map(a => {
      const daysOutstanding = a.cases?.case_date
        ? Math.floor((Date.now() - new Date(a.cases.case_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        id: a.id.toString(),
        name: a.offenders?.full_name || 'Unknown',
        firNo: a.cases?.fir_no || '?',
        daysOutstanding,
      };
    });

    // ── Response ─────────────────────────────────────────────────────────
    res.json(successResponse({
      // KPI cards
      totalCases,
      totalOffenders,
      totalArrests,
      totalAbsconders,
      pendingChargeSheets,
      pendingCourtCases,
      convictionsThisYear,
      totalContrabandKg: totalContraband,
      totalCashSeized: totalCash,
      totalVehiclesSeized: totalVehicles,

      // Charts
      yearWiseTrend,
      drugTypeBreakdown,
      caseStages,

      // Station data
      psWiseData,

      // Alerts & activity
      recentAlerts: recentAlerts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10),
      absconderTicker,
      editRequests: editRequests.map(r => ({
        id: r.id.toString(),
        entity_type: r.entity_type,
        entity_id: r.entity_id.toString(),
      })),
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
