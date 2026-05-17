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

    // ── Year-wise case trend (pre-populated + from DB) ─────────────────
    // Historical data from spec (2016–2026)
    const historicalData = [
      { year: 2016, cases: 2, arrests: 2 },
      { year: 2017, cases: 6, arrests: 5 },
      { year: 2018, cases: 13, arrests: 11 },
      { year: 2019, cases: 18, arrests: 16 },
      { year: 2020, cases: 16, arrests: 14 },
      { year: 2021, cases: 47, arrests: 42 },
      { year: 2022, cases: 34, arrests: 30 },
      { year: 2023, cases: 46, arrests: 41 },
      { year: 2024, cases: 85, arrests: 78 },
      { year: 2025, cases: 65, arrests: 58 },
      { year: 2026, cases: totalCases, arrests: totalArrests },
    ];

    // ── Case stage distribution ─────────────────────────────────────────
    const stageDistribution = await prisma.cases.groupBy({
      by: ['stage'],
      _count: { id: true },
    });

    const caseStages = stageDistribution.map(s => ({
      stage: s.stage,
      count: s._count.id,
    }));

    // ── Drug type breakdown (from offender categories) ──────────────────
    // Since we don't have a separate drug type on cases, use hardcoded for now
    const drugTypeBreakdown = [
      { type: 'Dry Ganja', value: 45, color: '#22c55e' },
      { type: 'Ganja Oil', value: 15, color: '#84cc16' },
      { type: 'Brown Sugar', value: 12, color: '#f59e0b' },
      { type: 'MDMA', value: 8, color: '#ef4444' },
      { type: 'Others', value: 20, color: '#6b7280' },
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
      yearWiseTrend: historicalData,
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
