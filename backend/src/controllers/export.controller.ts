import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getOffenderWhere } from '../utils/scope';
import { maskAadhaar } from '../utils/pii';
import { logAudit } from '../utils/auditLogger';

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export const exportOffendersCsv = async (req: Request, res: Response) => {
  try {
    const where = getOffenderWhere((req as any).user);
    const { psId, query } = req.query;
    if (psId) (where as any).ps_id = BigInt(String(psId));
    if (query) {
      const q = String(query);
      (where as any).OR = [
        { full_name: { contains: q, mode: 'insensitive' } },
        { alias: { contains: q, mode: 'insensitive' } },
      ];
    }

    const offenders = await prisma.offenders.findMany({
      where,
      include: {
        police_stations: true,
        offender_contacts: { where: { contact_type: 'MOBILE_PRIMARY' } },
        offender_identity_docs: true,
        case_accused: true,
      },
      orderBy: { full_name: 'asc' },
      take: 5000,
    });

    const headers = [
      'SL No', 'Full Name', 'Alias', 'Category', 'Status', 'PS', 'District',
      'Mobile', 'Aadhaar (masked)', 'Total Cases', 'Address',
    ];
    const lines = [headers.join(',')];

    for (const o of offenders) {
      const aadhaar = o.offender_identity_docs?.[0]?.aadhaar_no;
      lines.push(
        [
          o.sl_no,
          o.full_name,
          o.alias,
          o.category,
          o.status,
          o.police_stations?.name,
          o.district,
          o.offender_contacts?.[0]?.value,
          maskAadhaar(aadhaar),
          o.case_accused.length,
          o.full_address,
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    await logAudit('EXPORT', 'OFFENDER', null, req, `Exported ${offenders.length} offenders`);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="offenders-${Date.now()}.csv"`);
    res.send('\uFEFF' + lines.join('\n'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Export failed' });
  }
};

export const getOffenderHistorySheet = async (req: Request, res: Response) => {
  try {
    const id = BigInt(String(req.params.id));
    const offender = await prisma.offenders.findUnique({
      where: { id },
      include: {
        police_stations: true,
        offender_contacts: true,
        offender_identity_docs: true,
        case_accused: {
          include: {
            cases: { include: { police_stations: true, seizures: true } },
          },
        },
      },
    });

    if (!offender) return res.status(404).json({ message: 'Offender not found' });

    const timeline = offender.case_accused
      .map((ca) => ca.cases)
      .filter(Boolean)
      .sort((a, b) => (b!.case_date?.getTime() || 0) - (a!.case_date?.getTime() || 0))
      .map((c) => ({
        firNo: c!.fir_no,
        psName: c!.police_stations?.name,
        caseDate: c!.case_date,
        stage: c!.stage,
        sectionOfLaw: c!.section_of_law,
        contrabandType: c!.contraband_type,
        arrestStatus: offender.case_accused.find((ca) => ca.case_id === c!.id)?.arrest_status,
      }));

    res.json({
      generatedAt: new Date().toISOString(),
      offender: {
        fullName: offender.full_name,
        alias: offender.alias,
        fatherHusbandName: offender.father_husband_name,
        age: offender.age,
        category: offender.category,
        address: offender.full_address,
        psName: offender.police_stations?.name,
        mobile: offender.offender_contacts.find((c) => c.contact_type === 'MOBILE_PRIMARY')?.value,
      },
      timeline,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
