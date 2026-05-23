import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

function normKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  const map = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    map.set(normKey(k), v);
  }
  for (const key of keys) {
    const v = map.get(normKey(key));
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

function parseContrabandType(raw: string): string | null {
  const s = raw.toUpperCase();
  if (s.includes('GANJA') && s.includes('OIL')) return 'GANJA_OIL';
  if (s.includes('GANJA')) return 'DRY_GANJA';
  if (s.includes('BROWN')) return 'BROWN_SUGAR';
  if (s.includes('MDMA')) return 'MDMA';
  if (s.includes('HEROIN')) return 'HEROIN';
  if (s.includes('COCAINE')) return 'COCAINE';
  if (s.includes('OPIUM')) return 'OPIUM';
  if (s.includes('SYNTH')) return 'SYNTHETIC';
  if (!s) return null;
  return 'OTHER';
}

export const importDprExcel = async (req: Request, res: Response) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Upload an Excel file (.xlsx, .xls)' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (!rows.length) {
      return res.status(400).json({ message: 'Sheet is empty' });
    }

    const stations = await prisma.police_stations.findMany();
    const psByName = new Map(stations.map((s) => [normKey(s.name), s]));
    const psByCode = new Map(stations.map((s) => [normKey(s.ps_code), s]));

    let userId: bigint | null = null;
    if ((req as any).user?.userId) userId = BigInt((req as any).user.userId);

    const stats = { rows: rows.length, casesCreated: 0, offendersCreated: 0, skipped: 0, errors: [] as string[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const psName = pick(row, 'PS Name', 'Police Station', 'Station', 'PS');
        const psCode = pick(row, 'PS Code', 'ps_code');
        let ps = psByCode.get(normKey(psCode));
        if (!ps) {
          ps = psByName.get(normKey(psName));
          if (!ps) {
            for (const [k, v] of psByName) {
              if (k.includes(normKey(psName)) || normKey(psName).includes(k)) {
                ps = v;
                break;
              }
            }
          }
        }
        if (!ps) {
          stats.skipped++;
          stats.errors.push(`Row ${i + 2}: unknown station "${psName || psCode}"`);
          continue;
        }

        const accusedName = pick(row, 'Accused name', 'Accused Name', 'Name of Accused', 'Accused');
        if (!accusedName) {
          stats.skipped++;
          continue;
        }

        const firNo = pick(row, 'CR No', 'CR No.', 'FIR No', 'FIR', 'Cr No') || `${ps.ps_code}/${pick(row, 'Year') || new Date().getFullYear()}/${i + 1}`;
        const yearStr = pick(row, 'Year');
        const caseDate = yearStr ? new Date(`${yearStr}-06-15`) : new Date();

        const existingCase = await prisma.cases.findFirst({
          where: { fir_no: firNo, ps_id: ps.id },
        });

        let caseId: bigint;
        if (existingCase) {
          caseId = existingCase.id;
        } else {
          const created = await prisma.cases.create({
            data: {
              fir_no: firNo,
              ps_id: ps.id,
              section_of_law: pick(row, 'Sec of Law', 'Section', 'Section of Law') || null,
              case_date: caseDate,
              stage: 'FIR',
              nature_of_offence: pick(row, 'Nature of offence', 'Nature of Offence') || null,
              contraband_type: parseContrabandType(pick(row, 'Quantity', 'Drug Type', 'Contraband')) as any,
              source_location: pick(row, 'Source', 'Source Location') || null,
              destination_location: pick(row, 'Destination', 'Destination Location') || null,
              intelligence_notes: pick(row, 'Intelligence inputs', 'Intelligence') || null,
              department: ps.station_type === 'EXCISE' ? 'EXCISE' : 'POLICE',
              created_by: userId,
            },
          });
          caseId = created.id;
          stats.casesCreated++;

          const qty = pick(row, 'Quantity');
          const qtyNum = parseFloat(qty.replace(/[^\d.]/g, ''));
          if (!Number.isNaN(qtyNum) && qtyNum > 0) {
            await prisma.seizures.create({
              data: { case_id: caseId, contraband_kg: qtyNum, seizure_date: caseDate },
            });
          }
        }

        let offender = await prisma.offenders.findFirst({
          where: { ps_id: ps.id, full_name: { equals: accusedName, mode: 'insensitive' } },
        });

        if (!offender) {
          const ageStr = pick(row, 'Age');
          offender = await prisma.offenders.create({
            data: {
              ps_id: ps.id,
              full_name: accusedName,
              father_husband_name: pick(row, "Father's name", 'Father Name', 'Father') || null,
              age: ageStr ? parseInt(ageStr, 10) || null : null,
              full_address: pick(row, 'Address', 'Permanent Address') || null,
              created_by: userId,
              offender_contacts: pick(row, 'Mobile', 'Mobile No')
                ? {
                    create: [{ contact_type: 'MOBILE_PRIMARY', value: pick(row, 'Mobile', 'Mobile No') }],
                  }
                : undefined,
              offender_identity_docs: pick(row, 'Aadhaar', 'Aadhaar No')
                ? {
                    create: [{ aadhaar_no: pick(row, 'Aadhaar', 'Aadhaar No').replace(/\D/g, '').slice(0, 12) }],
                  }
                : undefined,
            },
          });
          stats.offendersCreated++;
        }

        const linked = await prisma.case_accused.findFirst({
          where: { case_id: caseId, offender_id: offender.id },
        });
        if (!linked) {
          const arrestStatus = pick(row, 'Arrest status', 'Arrest Status');
          await prisma.case_accused.create({
            data: {
              case_id: caseId,
              offender_id: offender.id,
              arrest_status: arrestStatus.toUpperCase().includes('ABS') ? 'ABSCONDING' : 'ARRESTED',
            },
          });
        }
      } catch (e: any) {
        stats.errors.push(`Row ${i + 2}: ${e.message || 'error'}`);
      }
    }

    await logAudit('CREATE', 'IMPORT', null, req, `DPR import: ${stats.casesCreated} cases, ${stats.offendersCreated} offenders`);

    res.json(successResponse(stats, 'Import completed'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Import failed' });
  }
};
