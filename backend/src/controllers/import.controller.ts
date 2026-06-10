import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';
import { broadcastEvent } from './sse.controller';

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

const STATE_CODES: Record<string, string> = {
  'andhra pradesh': 'AP',
  'ap': 'AP',
  'kerala': 'KL',
  'kl': 'KL',
  'karnataka': 'KA',
  'ka': 'KA',
  'telangana': 'TS',
  'ts': 'TS',
};

const DISTRICT_NUMBERS: Record<string, string> = {
  'tirupati': '39',
  'chittoor': '03',
};

interface ParsedAccused {
  offenderId: string;
  fullName: string;
  age: number | null;
  guardianName: string | null;
  address: string | null;
}

function parseAccusedDetails(raw: string): ParsedAccused {
  let str = raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Offender ID
  let offenderId = '';
  const idMatch = str.match(/^(A\d+)\.?\s*/i);
  if (idMatch) {
    offenderId = idMatch[1] || '';
    str = str.substring(idMatch[0].length).trim();
  }

  // 2. Full Name
  const markerRegex = /\b(age\s*:|\d+\s*yrs|s\/o|d\/o|w\/o|d\.?no|door\s*no|d-no|h\.?no|h-no)\b/i;
  const markerMatch = str.match(markerRegex);
  let fullName = '';
  if (markerMatch && markerMatch.index !== undefined) {
    fullName = str.substring(0, markerMatch.index).trim();
  } else {
    fullName = str.trim();
  }
  fullName = fullName.replace(/,\s*$/, '').trim();

  // 3. Age
  let age: number | null = null;
  const ageMatch = str.match(/age\s*:\s*(\d+)/i) || str.match(/(\d+)\s*Yrs/i);
  if (ageMatch) {
    age = parseInt(ageMatch[1] || ageMatch[2] || '0', 10);
  }

  // 4. Guardian Name
  let guardianName: string | null = null;
  const guardianMatch = str.match(/\b([SDW]\/o)\.?\s*([^,]+)/i);
  if (guardianMatch) {
    guardianName = (guardianMatch[2] || '').trim();
  }

  // 5. Address
  let address: string | null = str;
  if (fullName) {
    address = address.replace(fullName, '');
  }
  const agePhraseMatch = str.match(/age\s*:\s*\d+\s*(?:yrs)?/i) || str.match(/\d+\s*yrs/i);
  if (agePhraseMatch) {
    address = address.replace(agePhraseMatch[0], '');
  }
  if (guardianMatch) {
    address = address.replace(guardianMatch[0], '');
  }

  address = address
    .replace(/\b[SDW]\/o\.?\s*/gi, '')
    .replace(/\bage\s*:?\s*/gi, '')
    .replace(/yrs/gi, '')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim();

  if (address === '') {
    address = null;
  }

  return {
    offenderId,
    fullName,
    age,
    guardianName,
    address,
  };
}

function cleanString(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export const importDprExcel = async (req: Request, res: Response) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Upload an Excel file (.xlsx, .xls)' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      return res.status(400).json({ message: 'Excel workbook has no sheets' });
    }
    const sheet = wb.Sheets[firstSheetName];
    if (!sheet) {
      return res.status(400).json({ message: 'Excel sheet could not be loaded' });
    }
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
      const row = rows[i]!;
      try {
        const crNo = cleanString(pick(row, 'Cr. No.', 'Cr No', 'CR No.', 'CR No'));
        const accusedDetails = cleanString(pick(row, 'Accused Details', 'AccusedDetails'));

        if (!crNo || !accusedDetails) {
          stats.skipped++;
          stats.errors.push(`Row ${i + 2}: Missing "Cr. No." or "Accused Details"`);
          continue;
        }

        const psName = pick(row, 'Police station', 'Police Station', 'PS');
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

        const secOfLaw = cleanString(pick(row, 'Sec of Law', 'Section of Law', 'Sec. of Law')) || null;
        const district = cleanString(pick(row, 'District')) || null;
        const mandal = cleanString(pick(row, 'Mandal')) || null;
        const state = cleanString(pick(row, 'State')) || null;

        const caseDate = new Date();

        const existingCase = await prisma.cases.findFirst({
          where: { fir_no: crNo, ps_id: ps.id },
        });

        let caseId: bigint;
        if (existingCase) {
          caseId = existingCase.id;
          if (!existingCase.section_of_law && secOfLaw) {
            await prisma.cases.update({
              where: { id: caseId },
              data: { section_of_law: secOfLaw },
            });
          }
        } else {
          const created = await prisma.cases.create({
            data: {
              fir_no: crNo,
              ps_id: ps.id,
              section_of_law: secOfLaw,
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
          const cash = pick(row, 'Cash', 'Cash Seized', 'Amount', 'Cash Amount');
          const cashNum = parseFloat(cash.replace(/[^\d.]/g, ''));
          const vehicles = pick(row, 'Vehicle', 'Vehicles', 'Vehicle Count', 'Vehicles Seized');
          const vehiclesNum = parseInt(vehicles.replace(/\D/g, ''), 10);

          if ((!Number.isNaN(qtyNum) && qtyNum > 0) || (!Number.isNaN(cashNum) && cashNum > 0) || (!Number.isNaN(vehiclesNum) && vehiclesNum > 0)) {
            await prisma.seizures.create({
              data: {
                case_id: caseId,
                contraband_kg: !Number.isNaN(qtyNum) && qtyNum > 0 ? qtyNum : null,
                cash_amount: !Number.isNaN(cashNum) && cashNum > 0 ? cashNum : 0,
                vehicles_count: !Number.isNaN(vehiclesNum) && vehiclesNum > 0 ? vehiclesNum : 0,
                seizure_date: caseDate
              },
            });
          }
        }

        const rawDetails = accusedDetails;
        const accusedLines = rawDetails.split(/(?=A\d+\b)/i).map(l => l.trim()).filter(Boolean);

        for (const line of accusedLines) {
          const parsed = parseAccusedDetails(line);
          const fullName = cleanString(parsed.fullName);

          if (!fullName) {
            continue;
          }

          let offender = await prisma.offenders.findFirst({
            where: { ps_id: ps.id, full_name: { equals: fullName, mode: 'insensitive' } },
          });

          const guardianName = cleanString(parsed.guardianName);
          const address = cleanString(parsed.address);
          const age = parsed.age;

          if (!offender) {
            let slNo = null;
            const offenderDistrict = district || ps.district || '';
            const offenderState = state || ps.state || '';
            const stateCode = STATE_CODES[offenderState.toLowerCase().trim()];
            const districtNum = DISTRICT_NUMBERS[offenderDistrict.toLowerCase().trim()];

            if (stateCode && districtNum) {
              const prefix = `${stateCode}${districtNum}-`;
              const count = await prisma.offenders.count({
                where: {
                  sl_no: {
                    startsWith: prefix
                  }
                }
              });
              const nextNum = count + 1;
              slNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
            } else {
              const prefix = 'SL-';
              const count = await prisma.offenders.count({
                where: {
                  sl_no: {
                    startsWith: prefix
                  }
                }
              });
              slNo = `${prefix}${(100 + count).toString()}`;
            }

            const offenderDataObj: any = {
              sl_no: slNo,
              ps_id: ps.id,
              full_name: fullName,
              father_husband_name: guardianName,
              age: age,
              full_address: address,
              district: offenderDistrict || null,
              state: offenderState || null,
              created_by: userId,
            };

            offender = await prisma.offenders.create({
              data: offenderDataObj
            });
            stats.offendersCreated++;
          } else {
            const updateObj: any = {};
            if (!offender.father_husband_name && guardianName) updateObj.father_husband_name = guardianName;
            if (!offender.age && age) updateObj.age = age;
            if (!offender.full_address && address) updateObj.full_address = address;
            if (!offender.district && district) updateObj.district = district;
            if (!offender.state && state) updateObj.state = state;

            if (Object.keys(updateObj).length > 0) {
              offender = await prisma.offenders.update({
                where: { id: offender.id },
                data: updateObj,
              });
            }
          }

          if (secOfLaw) {
            const profile = await prisma.offender_drug_profile.findUnique({
              where: { offender_id: offender.id }
            });
            if (profile) {
              if (profile.section_of_law !== secOfLaw) {
                await prisma.offender_drug_profile.update({
                  where: { offender_id: offender.id },
                  data: { section_of_law: secOfLaw }
                });
              }
            } else {
              await prisma.offender_drug_profile.create({
                data: {
                  offender_id: offender.id,
                  section_of_law: secOfLaw
                }
              });
            }
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
        }
      } catch (e: any) {
        stats.errors.push(`Row ${i + 2}: ${e.message || 'error'}`);
      }
    }

    await logAudit('CREATE', 'IMPORT', null, req, `DPR import: ${stats.casesCreated} cases, ${stats.offendersCreated} offenders`);

    broadcastEvent('data_updated', { source: 'import', stats });

    res.json(successResponse(stats, 'Import completed'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Import failed' });
  }
};
