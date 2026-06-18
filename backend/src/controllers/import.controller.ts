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
  phone: string | null;
  email: string | null;
  caste: string | null;
  mandal: string | null;
  district: string | null;
}

function parseAccusedDetails(raw: string): ParsedAccused {
  let str = raw.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Offender ID (e.g. A-1, A1, 1., 1) )
  let offenderId = '';
  const idMatch = str.match(/^(?:A-?\d+|[0-9]+)[\.\):]?\s*/i);
  if (idMatch) {
    offenderId = idMatch[0].trim();
    str = str.substring(idMatch[0].length).trim();
  }

  // 2. Full Name
  const markerRegex = /\b(?:age|aged|s\/o|d\/o|w\/o|c\/o|caste|r\/o|d\.?no|door\s*no|d-no|h\.?no|h-no|[6-9]\d{9}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i;
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
  const ageMatch = str.match(/\b(?:age|aged)(?:\s*about)?\s*[:\-]?\s*(\d+)/i) || str.match(/\b(\d+)\s*(?:yrs|years)\b/i);
  if (ageMatch) {
    age = parseInt(ageMatch[1] || '0', 10);
  }

  // 4. Guardian Name
  let guardianName: string | null = null;
  const guardianMatch = str.match(/\b([SDWC]\/o)\.?\s*([^,]+)/i);
  if (guardianMatch) {
    guardianName = guardianMatch[2].trim();
  }

  // 5. Phone & Email
  let phone: string | null = null;
  const phoneMatch = str.match(/\b([6-9]\d{9})\b/);
  if (phoneMatch) {
    phone = phoneMatch[1];
  }

  let email: string | null = null;
  const emailMatch = str.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i);
  if (emailMatch) {
    email = emailMatch[0];
  }

  // 6. Caste
  let caste: string | null = null;
  const casteMatch = str.match(/\bcaste\s*(?:by|:)?\s*([a-zA-Z-]+)/i);
  if (casteMatch) {
    caste = casteMatch[1].trim();
  }

  // 7. Mandal & District
  let mandal: string | null = null;
  const mandalMatch = str.match(/\b([a-zA-Z]+)\s*mandal\b/i) || str.match(/\bmandal(?:\s*of)?\s*([a-zA-Z]+)\b/i);
  if (mandalMatch) {
    mandal = (mandalMatch[1] || mandalMatch[2] || '').trim();
  }

  let district: string | null = null;
  const districtMatch = str.match(/\b([a-zA-Z]+)\s*dist(?:rict)?\b/i) || str.match(/\bdist(?:rict)?(?:\s*of)?\s*([a-zA-Z]+)\b/i);
  if (districtMatch) {
    district = (districtMatch[1] || districtMatch[2] || '').trim();
  }

  // 8. Address
  let address: string | null = str;
  if (fullName) address = address.replace(fullName, '');
  const agePhrase = str.match(/\b(?:age|aged)(?:\s*about)?\s*[:\-]?\s*\d+\s*(?:yrs|years)?\b/i) || str.match(/\b\d+\s*(?:yrs|years)\b/i);
  if (agePhrase) address = address.replace(agePhrase[0], '');
  if (guardianMatch) address = address.replace(guardianMatch[0], '');
  if (casteMatch) address = address.replace(casteMatch[0], '');
  if (phone) address = address.replace(phone, '');
  if (email) address = address.replace(email, '');
  if (mandalMatch) address = address.replace(mandalMatch[0], '');
  if (districtMatch) address = address.replace(districtMatch[0], '');

  address = address
    .replace(/\b(?:R\/o|resident of|residing at)\b/ig, '')
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
    phone,
    email,
    caste,
    mandal,
    district
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

export const previewDprExcel = async (req: Request, res: Response) => {
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

    const previewData = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const crNo = cleanString(pick(row, 'Cr. No.', 'Cr No', 'CR No.', 'CR No'));
      const accusedDetails = cleanString(pick(row, 'Accused Details', 'AccusedDetails')) || '';
      const parsedAccused = parseAccusedDetails(accusedDetails);
      
      const psNameRaw = pick(row, 'Police station', 'Police Station', 'PS');
      const psCodeRaw = pick(row, 'PS Code', 'ps_code');

      let ps = psByCode.get(normKey(psCodeRaw));
      if (!ps) {
        ps = psByName.get(normKey(psNameRaw));
        if (!ps) {
          for (const [k, v] of psByName) {
            if (k.includes(normKey(psNameRaw)) || normKey(psNameRaw).includes(k)) {
              ps = v;
              break;
            }
          }
        }
      }

      const secOfLaw = cleanString(pick(row, 'Sec of Law', 'Section of Law', 'Sec. of Law')) || '';
      const district = cleanString(pick(row, 'District')) || '';
      const mandal = cleanString(pick(row, 'Mandal')) || '';
      const state = cleanString(pick(row, 'State')) || '';
      const natureOfOffence = cleanString(pick(row, 'Nature of offence', 'Nature of Offence')) || '';
      const contrabandRaw = pick(row, 'Quantity', 'Drug Type', 'Contraband');
      const qty = pick(row, 'Quantity');
      const cash = pick(row, 'Cash', 'Cash Seized', 'Amount', 'Cash Amount');
      const vehicles = pick(row, 'Vehicle', 'Vehicles', 'Vehicle Count', 'Vehicles Seized');
      const arrestStatus = pick(row, 'Arrest status', 'Arrest Status');
      const sourceLocation = pick(row, 'Source', 'Source Location') || '';
      const destinationLocation = pick(row, 'Destination', 'Destination Location') || '';
      const intelligenceNotes = pick(row, 'Intelligence inputs', 'Intelligence') || '';

      const errors = [];
      if (!crNo || !accusedDetails) errors.push('Missing "Cr. No." or "Accused Details"');
      if (!ps) errors.push(`Unknown station "${psNameRaw || psCodeRaw}"`);

      previewData.push({
        id: `row_${i}`,
        originalRow: i + 2,
        crNo,
        psName: psNameRaw,
        psCode: psCodeRaw,
        psId: ps ? Number(ps.id) : null,
        stationType: ps ? ps.station_type : 'POLICE',
        psDistrict: ps ? ps.district : '',
        psState: ps ? ps.state : '',
        secOfLaw,
        district,
        mandal,
        state,
        natureOfOffence,
        contrabandRaw,
        contrabandType: parseContrabandType(contrabandRaw),
        qty,
        cash,
        vehicles,
        accusedRaw: accusedDetails,
        accusedName: parsedAccused.fullName,
        accusedAge: parsedAccused.age,
        accusedGuardian: parsedAccused.guardianName,
        accusedAddress: parsedAccused.address,
        accusedPhone: parsedAccused.phone,
        accusedEmail: parsedAccused.email,
        accusedCaste: parsedAccused.caste,
        accusedMandal: parsedAccused.mandal,
        accusedDistrict: parsedAccused.district,
        arrestStatus,
        sourceLocation,
        destinationLocation,
        intelligenceNotes,
        errors,
        isValid: errors.length === 0
      });
    }

    res.json(successResponse({ rows: previewData }, 'Preview generated successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to generate preview' });
  }
};

export const confirmDprImport = async (req: Request, res: Response) => {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ message: 'Invalid data format' });
    }

    let userId: bigint | null = null;
    if ((req as any).user?.userId) userId = BigInt((req as any).user.userId);

    const stats = { rows: rows.length, casesCreated: 0, offendersCreated: 0, skipped: 0, errors: [] as string[] };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.isValid) {
        stats.skipped++;
        stats.errors.push(`Row ${row.originalRow}: Skipped due to validation errors`);
        continue;
      }

      try {
        const caseDate = new Date();

        const existingCase = await prisma.cases.findFirst({
          where: { fir_no: row.crNo, ps_id: row.psId },
        });

        let caseId: bigint;
        if (existingCase) {
          caseId = existingCase.id;
          if (!existingCase.section_of_law && row.secOfLaw) {
            await prisma.cases.update({
              where: { id: caseId },
              data: { section_of_law: row.secOfLaw },
            });
          }
        } else {
          const created = await prisma.cases.create({
            data: {
              fir_no: row.crNo,
              ps_id: row.psId,
              section_of_law: row.secOfLaw || null,
              case_date: caseDate,
              stage: 'FIR',
              nature_of_offence: row.natureOfOffence || null,
              contraband_type: row.contrabandType as any,
              source_location: row.sourceLocation || null,
              destination_location: row.destinationLocation || null,
              intelligence_notes: row.intelligenceNotes || null,
              department: row.stationType === 'EXCISE' ? 'EXCISE' : 'POLICE',
              created_by: userId,
            },
          });
          caseId = created.id;
          stats.casesCreated++;

          const qtyNum = parseFloat((row.qty || '').replace(/[^\d.]/g, ''));
          const cashNum = parseFloat((row.cash || '').replace(/[^\d.]/g, ''));
          const vehiclesNum = parseInt((row.vehicles || '').replace(/\D/g, ''), 10);

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

        let offendersToProcess: any[] = [];
        
        // If the frontend sent edited individual columns, use them.
        if (row.accusedName) {
          offendersToProcess.push({
            fullName: cleanString(row.accusedName),
            guardianName: cleanString(row.accusedGuardian),
            age: row.accusedAge ? parseInt(row.accusedAge, 10) : null,
            address: cleanString(row.accusedAddress),
            phone: cleanString(row.accusedPhone),
            email: cleanString(row.accusedEmail),
            caste: cleanString(row.accusedCaste),
            mandal: cleanString(row.accusedMandal),
            district: cleanString(row.accusedDistrict),
          });
        } else {
          // Fallback if frontend sends raw text
          const accusedLines = (row.accusedRaw || '').split(/(?=A\d+\b)/i).map((l: string) => l.trim()).filter(Boolean);
          for (const line of accusedLines) {
            const parsed = parseAccusedDetails(line);
            offendersToProcess.push({
              fullName: cleanString(parsed.fullName),
              guardianName: cleanString(parsed.guardianName),
              age: parsed.age,
              address: cleanString(parsed.address),
              phone: cleanString(parsed.phone),
              email: cleanString(parsed.email),
              caste: cleanString(parsed.caste),
              mandal: cleanString(parsed.mandal),
              district: cleanString(parsed.district),
            });
          }
        }

        for (const parsed of offendersToProcess) {
          const fullName = parsed.fullName;
          if (!fullName) continue;

          let offender = await prisma.offenders.findFirst({
            where: { ps_id: row.psId, full_name: { equals: fullName, mode: 'insensitive' } },
          });

          const guardianName = parsed.guardianName;
          const address = parsed.address;
          const age = parsed.age;
          const caste = parsed.caste;
          const mandal = parsed.mandal;
          const offenderDistrict = parsed.district || row.district || row.psDistrict || '';

          if (!offender) {
            let slNo = null;
            const offenderState = row.state || row.psState || '';
            const stateCode = STATE_CODES[offenderState.toLowerCase().trim()];
            const districtNum = DISTRICT_NUMBERS[offenderDistrict.toLowerCase().trim()];

            if (stateCode && districtNum) {
              const prefix = `${stateCode}${districtNum}-`;
              const count = await prisma.offenders.count({
                where: { sl_no: { startsWith: prefix } }
              });
              slNo = `${prefix}${String(count + 1).padStart(4, '0')}`;
            } else {
              const prefix = 'SL-';
              const count = await prisma.offenders.count({
                where: { sl_no: { startsWith: prefix } }
              });
              slNo = `${prefix}${(100 + count).toString()}`;
            }

            offender = await prisma.offenders.create({
              data: {
                sl_no: slNo,
                ps_id: row.psId,
                full_name: fullName,
                father_husband_name: guardianName,
                age: age,
                full_address: address,
                caste: caste,
                mandal: mandal,
                district: offenderDistrict || null,
                state: offenderState || null,
                created_by: userId,
              }
            });
            stats.offendersCreated++;
          } else {
            const updateObj: any = {};
            if (!offender.father_husband_name && guardianName) updateObj.father_husband_name = guardianName;
            if (!offender.age && age) updateObj.age = age;
            if (!offender.full_address && address) updateObj.full_address = address;
            if (!offender.caste && caste) updateObj.caste = caste;
            if (!offender.mandal && mandal) updateObj.mandal = mandal;
            if (!offender.district && offenderDistrict) updateObj.district = offenderDistrict;
            if (!offender.state && row.state) updateObj.state = row.state;

            if (Object.keys(updateObj).length > 0) {
              offender = await prisma.offenders.update({
                where: { id: offender.id },
                data: updateObj,
              });
            }
          }

          if (parsed.phone) {
            const exists = await prisma.offender_contacts.findFirst({ where: { offender_id: offender.id, contact_type: 'PHONE', value: parsed.phone }});
            if (!exists) {
              await prisma.offender_contacts.create({ data: { offender_id: offender.id, contact_type: 'PHONE', value: parsed.phone } });
            }
          }
          if (parsed.email) {
            const exists = await prisma.offender_contacts.findFirst({ where: { offender_id: offender.id, contact_type: 'EMAIL', value: parsed.email }});
            if (!exists) {
              await prisma.offender_contacts.create({ data: { offender_id: offender.id, contact_type: 'EMAIL', value: parsed.email } });
            }
          }

          if (row.secOfLaw) {
            const profile = await prisma.offender_drug_profile.findUnique({
              where: { offender_id: offender.id }
            });
            if (profile) {
              if (profile.section_of_law !== row.secOfLaw) {
                await prisma.offender_drug_profile.update({
                  where: { offender_id: offender.id },
                  data: { section_of_law: row.secOfLaw }
                });
              }
            } else {
              await prisma.offender_drug_profile.create({
                data: { offender_id: offender.id, section_of_law: row.secOfLaw }
              });
            }
          }

          const linked = await prisma.case_accused.findFirst({
            where: { case_id: caseId, offender_id: offender.id },
          });
          if (!linked) {
            await prisma.case_accused.create({
              data: {
                case_id: caseId,
                offender_id: offender.id,
                arrest_status: (row.arrestStatus || '').toUpperCase().includes('ABS') ? 'ABSCONDING' : 'ARRESTED',
              },
            });
          }
        }
      } catch (e: any) {
        stats.errors.push(`Row ${row.originalRow}: ${e.message || 'error'}`);
      }
    }

    await logAudit('CREATE', 'IMPORT', null, req, `DPR import: ${stats.casesCreated} cases, ${stats.offendersCreated} offenders`);

    broadcastEvent('data_updated', { source: 'import', stats });

    res.json(successResponse(stats, 'Import completed successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Import confirmation failed' });
  }
};
