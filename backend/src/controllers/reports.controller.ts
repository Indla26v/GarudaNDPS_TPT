/**
 * GARUDA — Reports Controller
 * 
 * Generates operational reports for absconders, pending charge sheets, etc.
 * Data is scoped by the requesting user's role/station.
 */
import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { getDashboardScope, ScopeUser } from '../utils/scope';
import { logAudit } from '../utils/auditLogger';

function csvEscape(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes("'")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getSeverity(daysOutstanding: number): string {
  if (daysOutstanding > 90) return 'CRITICAL';
  if (daysOutstanding > 60) return 'HIGH';
  if (daysOutstanding > 30) return 'MEDIUM';
  return 'LOW';
}

export const getAbsconderReport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const format = (req.query.format as string) || 'json';
    const minDays = req.query.minDays ? parseInt(String(req.query.minDays), 10) : 0;
    const psId = req.query.psId ? BigInt(String(req.query.psId)) : null;

    // Build scoped where clause for case_accused
    let caseAccusedWhere: any = { arrest_status: 'ABSCONDING' };

    if (psId) {
      caseAccusedWhere.cases = { ps_id: psId };
    } else if (psFilter.ps_id) {
      caseAccusedWhere.cases = { ps_id: psFilter.ps_id };
    } else if (psFilter.police_stations) {
      caseAccusedWhere.cases = { police_stations: psFilter.police_stations };
    }

    const absconders = await prisma.case_accused.findMany({
      where: caseAccusedWhere,
      include: {
        offenders: {
          select: {
            full_name: true,
            alias: true,
            age: true,
            father_husband_name: true,
            full_address: true,
            photo_url: true,
          },
        },
        cases: {
          select: {
            fir_no: true,
            case_date: true,
            section_of_law: true,
            police_stations: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    // Map to report format with days outstanding
    const now = Date.now();
    let reportData = absconders.map(a => {
      const daysOutstanding = a.cases?.case_date
        ? Math.floor((now - new Date(a.cases.case_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        id: a.id.toString(),
        offenderId: a.offender_id.toString(),
        offenderName: a.offenders?.full_name || 'Unknown',
        alias: a.offenders?.alias || '',
        age: a.offenders?.age || null,
        fatherName: a.offenders?.father_husband_name || '',
        address: a.offenders?.full_address || '',
        firNo: a.cases?.fir_no || '',
        psName: a.cases?.police_stations?.name || '',
        caseDate: a.cases?.case_date ? new Date(a.cases.case_date).toISOString().split('T')[0] : '',
        sectionOfLaw: a.cases?.section_of_law || '',
        daysOutstanding,
        severity: getSeverity(daysOutstanding),
      };
    });

    // Filter by minimum days if specified
    if (minDays > 0) {
      reportData = reportData.filter(r => r.daysOutstanding >= minDays);
    }

    // Sort by days outstanding descending (most urgent first)
    reportData.sort((a, b) => b.daysOutstanding - a.daysOutstanding);

    await logAudit('VIEW', 'REPORT', null, req, `Absconder report generated: ${reportData.length} records`);

    if (format === 'csv') {
      const headers = [
        'Sl.No', 'Offender Name', 'Alias', 'Age', 'Father/Husband Name', 'Address',
        'FIR No', 'Police Station', 'Case Date', 'Section of Law',
        'Days Outstanding', 'Severity'
      ];
      const lines = [headers.join(',')];

      reportData.forEach((r, i) => {
        lines.push([
          String(i + 1),
          r.offenderName,
          r.alias,
          r.age != null ? String(r.age) : '',
          r.fatherName,
          r.address,
          r.firNo,
          r.psName,
          r.caseDate,
          r.sectionOfLaw,
          String(r.daysOutstanding),
          r.severity,
        ].map(csvEscape).join(','));
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="absconder-report-${Date.now()}.csv"`);
      res.send('\uFEFF' + lines.join('\n'));
    } else {
      res.json(successResponse({
        generatedAt: new Date().toISOString(),
        totalAbsconders: reportData.length,
        absconders: reportData,
      }));
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate absconder report' });
  }
};

export const getMonthlyAbstractReport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const cases = await prisma.cases.findMany({
      where: {
        ...psFilter,
        case_date: { gte: startOfMonth }
      },
      include: {
        police_stations: true,
        seizures: true,
        case_accused: true
      }
    });

    const stationsMap = new Map<string, any>();
    for (const c of cases) {
      const psName = c.police_stations?.name || 'Unknown';
      if (!stationsMap.has(psName)) {
        stationsMap.set(psName, {
          stationName: psName,
          caseCount: 0,
          arrestCount: 0,
          contrabandKg: 0,
          cashAmount: 0
        });
      }
      const stat = stationsMap.get(psName);
      stat.caseCount += 1;
      stat.arrestCount += c.case_accused.filter((ca: any) => ca.arrest_status === 'ARRESTED').length;
      for (const s of c.seizures) {
        stat.contrabandKg += s.contraband_kg ? Number(s.contraband_kg) : 0;
        stat.cashAmount += s.cash_amount ? Number(s.cash_amount) : 0;
      }
    }

    const data = Array.from(stationsMap.values());
    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      data
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate monthly abstract' });
  }
};

export const getYearlyComparisonReport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);

    const cases = await prisma.cases.findMany({
      where: psFilter,
      include: {
        case_accused: true
      }
    });

    const yearlyStats: Record<number, { year: number; cases: number; arrests: number; convictions: number }> = {};
    const currentYear = new Date().getFullYear();
    for (let y = currentYear - 4; y <= currentYear; y++) {
      yearlyStats[y] = { year: y, cases: 0, arrests: 0, convictions: 0 };
    }

    for (const c of cases) {
      if (c.case_date) {
        const year = new Date(c.case_date).getFullYear();
        if (yearlyStats[year]) {
          yearlyStats[year].cases += 1;
          yearlyStats[year].arrests += c.case_accused.filter((ca: any) => ca.arrest_status === 'ARRESTED').length;
          if (c.stage === 'CONVICTED') {
            yearlyStats[year].convictions += 1;
          }
        }
      }
    }

    const data = Object.values(yearlyStats).sort((a, b) => a.year - b.year);
    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      data
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate yearly comparison' });
  }
};

export const getPendingChargeSheetsReport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const cases = await prisma.cases.findMany({
      where: {
        ...psFilter,
        stage: 'FIR',
        case_date: { lt: sixtyDaysAgo }
      },
      include: {
        police_stations: true,
        case_accused: { include: { offenders: true } }
      },
      orderBy: { case_date: 'asc' }
    });

    const data = cases.map((c) => {
      const daysPending = c.case_date
        ? Math.floor((Date.now() - new Date(c.case_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      return {
        id: c.id.toString(),
        firNo: c.fir_no,
        sectionOfLaw: c.section_of_law || '',
        caseDate: c.case_date,
        psName: c.police_stations?.name || '',
        daysPending,
        accusedNames: c.case_accused.map((ca) => ca.offenders?.full_name).join(', ')
      };
    });

    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      totalPending: data.length,
      data
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate pending charge sheets report' });
  }
};

export const getBailExpiryAlertsReport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);

    const bails = await prisma.case_accused.findMany({
      where: {
        arrest_status: 'BAILED',
        cases: psFilter
      },
      include: {
        offenders: true,
        cases: {
          include: { police_stations: true }
        }
      },
      orderBy: { bail_date: 'asc' }
    });

    const data = bails.map((b) => {
      const daysSinceBail = b.bail_date
        ? Math.floor((Date.now() - new Date(b.bail_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      const daysRemaining = Math.max(0, 90 - daysSinceBail);

      return {
        id: b.id.toString(),
        offenderName: b.offenders?.full_name || 'Unknown',
        firNo: b.cases?.fir_no || '',
        psName: b.cases?.police_stations?.name || '',
        bailDate: b.bail_date,
        bailConditions: b.bail_conditions || 'None specified',
        daysSinceBail,
        daysRemaining
      };
    });

    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      totalBails: data.length,
      data
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate bail expiry alerts report' });
  }
};

export const getCourtPendingReport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);

    const cases = await prisma.cases.findMany({
      where: {
        ...psFilter,
        stage: 'TRIAL'
      },
      include: {
        police_stations: true,
        court_hearings: {
          orderBy: { hearing_date: 'desc' }
        },
        case_accused: {
          include: { offenders: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const data = cases.map((c) => {
      const latestHearing = c.court_hearings[0];
      return {
        id: c.id.toString(),
        firNo: c.fir_no,
        sectionOfLaw: c.section_of_law || '',
        psName: c.police_stations?.name || '',
        scNumber: latestHearing?.sc_number || '—',
        nextHearingDate: latestHearing?.next_hearing_date || latestHearing?.hearing_date || null,
        courtName: latestHearing?.court_name || '—',
        accusedCount: c.case_accused.length
      };
    });

    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      totalCases: data.length,
      data
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate court pending report' });
  }
};

export const getDrugSeizuresReport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);

    const seizures = await prisma.seizures.findMany({
      where: {
        cases: psFilter
      },
      include: {
        cases: true
      }
    });

    const breakdown: Record<string, number> = {};
    let totalKg = 0;

    for (const s of seizures) {
      const type = s.cases?.contraband_type || 'OTHER';
      const kg = s.contraband_kg ? Number(s.contraband_kg) : 0;
      breakdown[type] = (breakdown[type] || 0) + kg;
      totalKg += kg;
    }

    const data = Object.entries(breakdown).map(([type, amount]) => ({
      type,
      amount,
      percentage: totalKg > 0 ? Math.round((amount / totalKg) * 100) : 0
    })).sort((a, b) => b.amount - a.amount);

    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      totalKg,
      data
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate drug seizures report' });
  }
};

export const getTopOffendersReport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);

    const offenders = await prisma.offenders.findMany({
      where: psFilter,
      include: {
        _count: {
          select: { case_accused: true }
        },
        police_stations: {
          select: { name: true }
        }
      },
      orderBy: {
        case_accused: {
          _count: 'desc'
        }
      },
      take: 10
    });

    const data = offenders.map((o) => ({
      id: o.id.toString(),
      offenderName: o.full_name,
      alias: o.alias || '',
      age: o.age,
      fatherName: o.father_husband_name || '',
      psName: o.police_stations?.name || '',
      caseCount: o._count.case_accused,
      riskScore: o.risk_score || 'LOW'
    }));

    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      data
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate top repeat offenders report' });
  }
};

export const getDprExport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const { startDate, endDate } = req.query;

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(String(startDate));
    if (endDate) dateFilter.lte = new Date(String(endDate));

    const whereClause: any = { ...psFilter };
    if (startDate || endDate) {
      whereClause.case_date = dateFilter;
    }

    const cases = await prisma.cases.findMany({
      where: whereClause,
      include: {
        police_stations: true,
        seizures: true,
        case_accused: {
          include: { offenders: true }
        }
      },
      orderBy: { case_date: 'asc' }
    });

    const exportRows = cases.map((c) => {
      const accusedDetails = c.case_accused.map((ca: any, idx: number) => {
        const off = ca.offenders;
        if (!off) return '';
        const parts = [];
        parts.push(`A-${idx + 1}`);
        parts.push(off.full_name);
        if (off.age) parts.push(`Age: ${off.age} Yrs`);
        if (off.father_husband_name) parts.push(`S/o: ${off.father_husband_name}`);
        if (off.full_address) parts.push(`R/o: ${off.full_address}`);
        return parts.join(', ');
      }).join('\n');

      const qty = c.seizures.reduce((acc: number, s: any) => acc + (s.contraband_kg ? Number(s.contraband_kg) : 0), 0);
      const cash = c.seizures.reduce((acc: number, s: any) => acc + (s.cash_amount ? Number(s.cash_amount) : 0), 0);
      const vehicles = c.seizures.reduce((acc: number, s: any) => acc + (s.vehicles_count ? Number(s.vehicles_count) : 0), 0);

      const arrestStatus = c.case_accused.map((ca: any) => ca.arrest_status).join(', ');

      return {
        'Cr. No.': c.fir_no,
        'Section of Law': c.section_of_law || '',
        'Police Station': c.police_stations?.name || '',
        'Accused Details': accusedDetails,
        'Quantity': qty > 0 ? `${qty} KG` : '',
        'Cash': cash > 0 ? String(cash) : '',
        'Vehicle': vehicles > 0 ? String(vehicles) : '',
        'Arrest status': arrestStatus,
        'Source': c.source_location || '',
        'Destination': c.destination_location || '',
        'Intelligence inputs': c.intelligence_notes || ''
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(wb, ws, 'DPR Export');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="dpr-export-${Date.now()}.xlsx"`);
    res.send(buf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to export DPR Excel' });
  }
};

export const getCustomReport = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const { startDate, endDate, psId, contrabandType, stage, format } = req.query;

    const whereClause: any = { ...psFilter };
    if (startDate) whereClause.case_date = { ...whereClause.case_date, gte: new Date(String(startDate)) };
    if (endDate) whereClause.case_date = { ...whereClause.case_date, lte: new Date(String(endDate)) };
    if (psId && psId !== 'ALL') whereClause.ps_id = BigInt(String(psId));
    if (contrabandType && contrabandType !== 'ALL') whereClause.contraband_type = contrabandType;
    if (stage && stage !== 'ALL') whereClause.stage = stage;

    const cases = await prisma.cases.findMany({
      where: whereClause,
      include: {
        police_stations: { select: { name: true } },
        seizures: true,
        case_accused: {
          include: { offenders: true }
        }
      },
      orderBy: { case_date: 'desc' }
    });

    const reportRows = [];
    for (const c of cases) {
      const qty = c.seizures.reduce((acc: number, s: any) => acc + (s.contraband_kg ? Number(s.contraband_kg) : 0), 0);
      const cash = c.seizures.reduce((acc: number, s: any) => acc + (s.cash_amount ? Number(s.cash_amount) : 0), 0);
      const vehicles = c.seizures.reduce((acc: number, s: any) => acc + (s.vehicles_count ? Number(s.vehicles_count) : 0), 0);

      if (c.case_accused.length === 0) {
        reportRows.push({
          'FIR No': c.fir_no,
          'Case Date': c.case_date ? new Date(c.case_date).toISOString().split('T')[0] : '—',
          'Section of Law': c.section_of_law || '—',
          'Stage': c.stage,
          'Police Station': c.police_stations?.name || '—',
          'Accused Name': '—',
          'Age': '—',
          'Category': '—',
          'Risk Score': '—',
          'Status': '—',
          'Contraband Type': c.contraband_type || '—',
          'Quantity (KG)': qty > 0 ? `${qty} KG` : '0 KG',
          'Cash (INR)': cash > 0 ? String(cash) : '0',
          'Vehicles Seized': String(vehicles)
        });
      } else {
        for (const ca of c.case_accused) {
          reportRows.push({
            'FIR No': c.fir_no,
            'Case Date': c.case_date ? new Date(c.case_date).toISOString().split('T')[0] : '—',
            'Section of Law': c.section_of_law || '—',
            'Stage': c.stage,
            'Police Station': c.police_stations?.name || '—',
            'Accused Name': ca.offenders?.full_name || '—',
            'Age': ca.offenders?.age ? String(ca.offenders.age) : '—',
            'Category': ca.offenders?.category || '—',
            'Risk Score': ca.offenders?.risk_score || '—',
            'Status': ca.offenders?.status || '—',
            'Contraband Type': c.contraband_type || '—',
            'Quantity (KG)': qty > 0 ? `${qty} KG` : '0 KG',
            'Cash (INR)': cash > 0 ? String(cash) : '0',
            'Vehicles Seized': String(vehicles)
          });
        }
      }
    }

    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(reportRows);
      XLSX.utils.book_append_sheet(wb, ws, 'Custom Report');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="custom-report-${Date.now()}.xlsx"`);
      return res.send(buf);
    }

    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      totalRecords: reportRows.length,
      records: reportRows
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate custom report' });
  }
};

export const getCourtDiary = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const days = req.query.days ? parseInt(String(req.query.days), 10) : 30;

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);
    endDate.setHours(23, 59, 59, 999);

    const hearings = await prisma.court_hearings.findMany({
      where: {
        hearing_date: {
          gte: startDate,
          lte: endDate
        },
        cases: psFilter
      },
      include: {
        cases: {
          include: {
            police_stations: { select: { name: true } },
            case_accused: { include: { offenders: true } }
          }
        }
      },
      orderBy: { hearing_date: 'asc' }
    });

    const data = hearings.map((h) => ({
      id: h.id.toString(),
      scNumber: h.sc_number || '—',
      courtName: h.court_name || '—',
      hearingDate: h.hearing_date ? new Date(h.hearing_date).toISOString().split('T')[0] : '—',
      judgeName: h.judge_name || '—',
      orderText: h.order_text || '',
      nextHearingDate: h.next_hearing_date ? new Date(h.next_hearing_date).toISOString().split('T')[0] : null,
      caseId: h.case_id.toString(),
      firNo: h.cases?.fir_no || '—',
      psName: h.cases?.police_stations?.name || '—',
      accusedNames: h.cases?.case_accused.map(ca => ca.offenders?.full_name).join(', ') || '—'
    }));

    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      totalHearings: data.length,
      daysFilter: days,
      hearings: data
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch court diary' });
  }
};

export const getPerformanceMetrics = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);

    const cases = await prisma.cases.findMany({
      where: psFilter,
      include: {
        police_stations: { select: { name: true } },
        seizures: true
      }
    });

    const totalCases = cases.length;
    let chargeSheetedCases = 0;
    let convictedCases = 0;
    let acquittedCases = 0;

    const stationStats: Record<string, { stationName: string; casesCount: number; contrabandKg: number }> = {};

    cases.forEach((c) => {
      if (c.stage !== 'FIR') {
        chargeSheetedCases++;
      }
      if (c.stage === 'CONVICTED') {
        convictedCases++;
      } else if (c.stage === 'ACQUITTED') {
        acquittedCases++;
      }

      const psName = c.police_stations?.name || 'Unknown';
      if (!stationStats[psName]) {
        stationStats[psName] = { stationName: psName, casesCount: 0, contrabandKg: 0 };
      }
      
      stationStats[psName].casesCount++;
      const qty = c.seizures.reduce((acc, s) => acc + (s.contraband_kg ? Number(s.contraband_kg) : 0), 0);
      stationStats[psName].contrabandKg += qty;
    });

    const totalDecided = convictedCases + acquittedCases;
    const convictionRate = totalDecided > 0 ? Math.round((convictedCases / totalDecided) * 100) : 0;
    const chargeSheetRate = totalCases > 0 ? Math.round((chargeSheetedCases / totalCases) * 100) : 0;

    const leaderboard = Object.values(stationStats)
      .sort((a, b) => b.casesCount - a.casesCount)
      .slice(0, 10);

    res.json(successResponse({
      generatedAt: new Date().toISOString(),
      summary: {
        totalCases,
        chargeSheetedCases,
        convictedCases,
        acquittedCases,
        convictionRate,
        chargeSheetRate
      },
      leaderboard
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to calculate performance metrics' });
  }
};

