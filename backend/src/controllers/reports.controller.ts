/**
 * GARUDA — Reports Controller
 * 
 * Generates operational reports for absconders, pending charge sheets, etc.
 * Data is scoped by the requesting user's role/station.
 */
import { Request, Response } from 'express';
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
