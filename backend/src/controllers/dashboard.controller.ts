/**
 * GARUDA — Command Dashboard Controller
 * 
 * Provides aggregated KPI data for the dashboard.
 * 
 * DATA SCOPING:
 *   Station-level (SDPO, SHO, Constable) → only their PS data
 *   District-level (SP, ASP) → all PS data in the district
 */
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { getDashboardScope, ScopeUser } from '../utils/scope';

interface CacheEntry {
  data: any;
  expiry: number;
}
const dashboardCache = new Map<string, CacheEntry>();
const CACHE_TTL_SECONDS = 30; // 30 seconds

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter, isStationLevel } = getDashboardScope(user);

    // Generate cache key based on the user's role and police station id
    const psIdStr = psFilter.ps_id ? psFilter.ps_id.toString() : 'all';
    const cacheKey = `summary_${isStationLevel ? 'station' : 'district'}_${psIdStr}`;

    const forceBypass = req.query.force === 'true';

    if (!forceBypass) {
      const cached = dashboardCache.get(cacheKey);
      if (cached && Date.now() < cached.expiry) {
        return res.json(successResponse(cached.data));
      }
    }

    // Build case/offender/seizure where clauses based on scope
    const caseWhere: any = { ...psFilter };
    const offenderWhere: any = { ...psFilter };
    const caseAccusedWhere: any = psFilter.ps_id
      ? { cases: { ps_id: psFilter.ps_id } }
      : {};
    const seizureWhere: any = psFilter.ps_id
      ? { cases: { ps_id: psFilter.ps_id } }
      : {};

    // ── Core KPIs ──────────────────────────────────────────────────────
    const totalCases = await prisma.cases.count({ where: caseWhere });
    const totalOffenders = await prisma.offenders.count({ where: offenderWhere });
    const totalArrests = await prisma.case_accused.count({
      where: { ...caseAccusedWhere, arrest_status: 'ARRESTED' },
    });
    const totalAbsconders = await prisma.case_accused.count({
      where: { ...caseAccusedWhere, arrest_status: 'ABSCONDING' },
    });

    // Pending charge sheets = cases in FIR stage
    const pendingChargeSheets = await prisma.cases.count({
      where: { ...caseWhere, stage: 'FIR' },
    });

    // Pending court cases = cases under TRIAL
    const pendingCourtCases = await prisma.cases.count({
      where: { ...caseWhere, stage: 'TRIAL' },
    });

    // Convictions this year
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01`);
    const convictionsThisYear = await prisma.cases.count({
      where: {
        ...caseWhere,
        stage: 'CONVICTED',
        updated_at: { gte: yearStart },
      },
    });

    // ── Seizure aggregation ────────────────────────────────────────────
    const seizureAgg = await prisma.seizures.aggregate({
      where: seizureWhere,
      _sum: {
        contraband_kg: true,
        cash_amount: true,
        vehicles_count: true,
      },
    });

    const totalContraband = seizureAgg._sum.contraband_kg || 0;
    const totalCash = seizureAgg._sum.cash_amount || 0;
    const totalVehicles = seizureAgg._sum.vehicles_count || 0;

    // ── Year-wise trend ────────────────────────────────────────────────
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

    // Build dynamic SQL for year-wise trend, scoped by PS
    const psCondition = psFilter.ps_id ? `AND c.ps_id = ${psFilter.ps_id}` : '';

    const casesByYear = await prisma.$queryRawUnsafe<{ year: number; count: bigint }[]>(
      `SELECT EXTRACT(YEAR FROM case_date)::int AS year, COUNT(*)::bigint AS count
       FROM cases c
       WHERE case_date IS NOT NULL ${psCondition}
       GROUP BY 1
       ORDER BY 1`
    );
    const arrestsByYear = await prisma.$queryRawUnsafe<{ year: number; count: bigint }[]>(
      `SELECT EXTRACT(YEAR FROM c.case_date)::int AS year, COUNT(*)::bigint AS count
       FROM case_accused ca
       JOIN cases c ON c.id = ca.case_id
       WHERE ca.arrest_status = 'ARRESTED' AND c.case_date IS NOT NULL ${psCondition}
       GROUP BY 1
       ORDER BY 1`
    );

    const caseYearMap = new Map(casesByYear.map((r) => [Number(r.year), Number(r.count)]));
    const arrestYearMap = new Map(arrestsByYear.map((r) => [Number(r.year), Number(r.count)]));

    const trendEndYear = new Date().getFullYear();
    const yearWiseTrend = [];
    for (let y = 2016; y <= trendEndYear; y++) {
      const dbCases = caseYearMap.get(y) ?? 0;
      const dbArrests = arrestYearMap.get(y) ?? 0;
      const baseline = historicalBaseline[y];
      // Only use baseline for district-level / admin (station-level users shouldn't see district baselines)
      const useFallback = !isStationLevel;
      yearWiseTrend.push({
        year: y,
        cases: dbCases > 0 ? dbCases : (useFallback ? (baseline?.cases ?? 0) : 0),
        arrests: dbArrests > 0 ? dbArrests : (useFallback ? (baseline?.arrests ?? 0) : 0),
        fromDatabase: dbCases > 0 || dbArrests > 0,
      });
    }

    // ── Case stage distribution ─────────────────────────────────────────
    const stageDistribution = await prisma.cases.groupBy({
      by: ['stage'],
      where: caseWhere,
      _count: { id: true },
    });

    const caseStages = stageDistribution.map(s => ({
      stage: s.stage,
      count: s._count.id,
    }));

    // ── Drug type breakdown ─────────────────────────────────────────────
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
      where: { ...caseWhere, contraband_type: { not: null } },
      _count: { id: true },
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
    // Station-level users: only show their own PS
    // District-level/Admin: show all
    let stationsToQuery;
    if (isStationLevel && psFilter.ps_id) {
      stationsToQuery = await prisma.police_stations.findMany({
        where: { id: psFilter.ps_id as bigint },
      });
    } else {
      stationsToQuery = await prisma.police_stations.findMany();
    }

    const stationIds = stationsToQuery.map((ps) => Number(ps.id));

    // Fallback if no stations
    if (stationIds.length === 0) {
      stationIds.push(-1);
    }

    const [casesGrouped, offendersGrouped, arrestsGrouped, seizuresGrouped] = await Promise.all([
      prisma.cases.groupBy({
        by: ['ps_id'],
        where: { ps_id: { in: stationIds } },
        _count: { id: true },
      }),
      prisma.offenders.groupBy({
        by: ['ps_id'],
        where: { ps_id: { in: stationIds } },
        _count: { id: true },
      }),
      prisma.$queryRawUnsafe<{ ps_id: bigint; arrest_status: string; count: bigint }[]>(
        `SELECT c.ps_id, ca.arrest_status, COUNT(*)::bigint as count
         FROM case_accused ca
         JOIN cases c ON c.id = ca.case_id
         WHERE c.ps_id IN (${stationIds.join(',')})
         GROUP BY 1, 2`
      ),
      prisma.$queryRawUnsafe<{ ps_id: bigint; contraband_kg: number; cash_amount: number }[]>(
        `SELECT c.ps_id, SUM(s.contraband_kg) as contraband_kg, SUM(s.cash_amount) as cash_amount
         FROM seizures s
         JOIN cases c ON c.id = s.case_id
         WHERE c.ps_id IN (${stationIds.join(',')})
         GROUP BY 1`
      ),
    ]);

    const casesMap = new Map(casesGrouped.map(g => [Number(g.ps_id), g._count.id]));
    const offendersMap = new Map(offendersGrouped.map(g => [Number(g.ps_id), g._count.id]));

    const arrestsMap = new Map<number, number>();
    const abscondersMap = new Map<number, number>();
    arrestsGrouped.forEach(r => {
      const psId = Number(r.ps_id);
      if (r.arrest_status === 'ARRESTED') {
        arrestsMap.set(psId, Number(r.count));
      } else if (r.arrest_status === 'ABSCONDING') {
        abscondersMap.set(psId, Number(r.count));
      }
    });

    const seizuresMap = new Map<number, { contraband_kg: number; cash_amount: number }>();
    seizuresGrouped.forEach(r => {
      seizuresMap.set(Number(r.ps_id), {
        contraband_kg: Number(r.contraband_kg) || 0,
        cash_amount: Number(r.cash_amount) || 0,
      });
    });

    const psWiseData = stationsToQuery.map((ps) => {
      const psId = Number(ps.id);
      const seizureData = seizuresMap.get(psId) || { contraband_kg: 0, cash_amount: 0 };

      return {
        psId: ps.id.toString(),
        psName: ps.name,
        psCode: ps.ps_code,
        totalCases: casesMap.get(psId) || 0,
        totalOffenders: offendersMap.get(psId) || 0,
        totalArrests: arrestsMap.get(psId) || 0,
        totalAbsconders: abscondersMap.get(psId) || 0,
        totalContrabandKg: seizureData.contraband_kg,
        totalCashSeized: seizureData.cash_amount,
      };
    });

    // ── Recent activity / alerts (scoped) ────────────────────────────────
    const recentCases = await prisma.cases.findMany({
      where: caseWhere,
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

    // Add absconder alerts (scoped)
    const recentAbsconders = await prisma.case_accused.findMany({
      where: { ...caseAccusedWhere, arrest_status: 'ABSCONDING' },
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

    // ── Absconder list for ticker (scoped) ───────────────────────────────
    const absconders = await prisma.case_accused.findMany({
      where: { ...caseAccusedWhere, arrest_status: 'ABSCONDING' },
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
    const summaryData = {
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

      // Scope info for frontend
      isStationLevel,

      // Alerts & activity
      recentAlerts: recentAlerts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 10),
      absconderTicker,
      editRequests: editRequests.map(r => ({
        id: r.id.toString(),
        entity_type: r.entity_type,
        entity_id: r.entity_id.toString(),
      })),
    };

    // Cache the query result
    dashboardCache.set(cacheKey, {
      data: summaryData,
      expiry: Date.now() + CACHE_TTL_SECONDS * 1000,
    });

    res.json(successResponse(summaryData));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
