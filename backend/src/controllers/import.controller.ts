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
    guardianName = guardianMatch[2] ? guardianMatch[2].trim() : null;
  }

  // 5. Phone & Email
  let phone: string | null = null;
  const phoneMatch = str.match(/\b([6-9]\d{9})\b/);
  if (phoneMatch) {
    phone = phoneMatch[1] || null;
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
    caste = casteMatch[1] ? casteMatch[1].trim() : null;
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
    const importType = req.body.importType || 'UNIFIED';
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
    // ── Find the true header row ──
    const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(20, aoa.length); i++) {
      const rowString = (aoa[i] || []).join(' ').toLowerCase();
      if (
        rowString.includes('name of the ps') ||
        rowString.includes('cr. no') ||
        rowString.includes('details of the accused') ||
        rowString.includes('accused details')
      ) {
        headerRowIndex = i;
        break;
      }
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { range: headerRowIndex });

    if (!rows.length) {
      return res.status(400).json({ message: 'Sheet is empty or missing headers' });
    }

    const stations = await prisma.police_stations.findMany();
    const psByName = new Map(stations.map((s) => [normKey(s.name), s]));
    const psByCode = new Map(stations.map((s) => [normKey(s.ps_code), s]));

    const previewData = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;

      // ── PS lookup (common to all import types) ──
      const psNameRaw = pick(row, 'Name of the PS', 'Name of the P.S.', 'Police station', 'Police Station', 'PS');
      const psCodeRaw = pick(row, 'PS Code', 'ps_code');
      let ps = psByCode.get(normKey(psCodeRaw));
      if (!ps) {
        ps = psByName.get(normKey(psNameRaw));
        if (!ps && psNameRaw) {
          for (const [k, v] of psByName) {
            if (k && (k.includes(normKey(psNameRaw)) || normKey(psNameRaw).includes(k))) {
              ps = v;
              break;
            }
          }
        }
      }

      if (importType === 'OFFENDER') {
        // ── Parse "Details of the Accused" column (name, age, father) ──
        const detailsRaw = pick(row, 'Details of the Accused/ Peddler (Full name, age, father name)',
          'Details of the Accused', 'Details of Accused', 'Accused Details', 'AccusedDetails', 'Full Name', 'Name');
        const parsedDetails = parseAccusedDetails(detailsRaw);

        // ── Category mapping ──
        const categoryRaw = pick(row, 'Category of Accused (Local Peddeler, Local Supplier, Transporter and etc.)',
          'Category of Accused', 'Category');
        const categoryMap: Record<string, string> = {
          'localpeddler': 'LOCAL_PEDDLER', 'localpeddeler': 'LOCAL_PEDDLER', 'peddler': 'LOCAL_PEDDLER', 'peddeler': 'LOCAL_PEDDLER',
          'localsupplier': 'SUPPLIER', 'supplier': 'SUPPLIER',
          'transporter': 'TRANSPORTER',
          'localkingpin': 'LOCAL_KINGPIN', 'kingpin': 'LOCAL_KINGPIN',
          'interstatelink': 'INTERSTATE_LINK', 'interstate': 'INTERSTATE_LINK',
          'financier': 'FINANCIER',
          'consumer': 'CONSUMER',
        };
        const categoryKey = normKey(categoryRaw);
        const category = categoryMap[categoryKey] || '';

        // ── Contact fields ──
        const mobile1 = pick(row, 'Pedller/ Accused Mobile No. 1', 'Peddler Mobile No. 1', 'Mobile No. 1', 'Mobile 1', 'Phone');
        const mobile2 = pick(row, 'Pedller/ Accused Mobile No. 2', 'Peddler Mobile No. 2', 'Mobile No. 2', 'Mobile 2');
        const gmail = pick(row, 'Gmail ID', 'Gmail', 'Email', 'Email ID');
        const socialMedia = pick(row, 'Other Social Media IDs (Instagram/ Facebook and etc.)', 'Other Social Media IDs', 'Social Media');

        // ── Test result ──
        const testResultRaw = pick(row, 'Test Results (Positive/ Negative/ Invalid)', 'Test Results', 'Test Result');
        let testResult = '';
        if (testResultRaw) {
          const t = testResultRaw.toUpperCase();
          if (t.includes('POS')) testResult = 'POSITIVE';
          else if (t.includes('NEG')) testResult = 'NEGATIVE';
          else testResult = 'PENDING';
        }

        // ── Addresses ──
        const presentAddress = pick(row, 'Present Address (Long. & Lat.)', 'Present Address', 'Address');
        const permanentAddress = pick(row, 'Permanent Address (Long. & Lat. If Possible)', 'Permanent Address');

        // ── Financial fields ──
        const bankName = pick(row, 'Name of the Bank', 'Bank Name');
        const bankAccount = pick(row, 'Bank A/C No.', 'Bank Account No', 'Account No');
        const upiIds = pick(row, "UPI ID's (Phone Pay/ Google Pay/ Paytm and etc.)", 'UPI IDs', 'UPI ID');
        const upiLinkedMobile = pick(row, "UPI ID Linked Mobile No.s", 'UPI Linked Mobile', 'UPI Mobile');

        // ── Identity docs ──
        const aadhaar = pick(row, 'Aadhar Card No.', 'Aadhaar No', 'Aadhaar');
        const voterId = pick(row, 'Voter ID No.', 'Voter ID');
        const panCard = pick(row, 'PAN Card No.', 'PAN Card', 'PAN');

        // ── Occupation & Income ──
        const occupation = pick(row, 'Occupation (Student/ Labor/ Employee/ Bussiness/ etc.)', 'Occupation');
        const monthlyIncome = pick(row, 'Monthly Income', 'Income');

        // ── Supply chain / network ──
        const associates = pick(row, 'Names of Peddlers/ Associates with their Mobile numbers', 'Associates', 'Peddler Associates');
        const supplierTransporter = pick(row, 'Supplier / Trasporter Name & Contact No.', 'Supplier / Transporter', 'Supplier Name');
        const kingpinSource = pick(row, 'Kingpin / Main Source', 'Kingpin', 'Main Source');

        // ── Mode of purchase ──
        const modePurchaseRaw = pick(row, 'Mode of Purchase (Cash / UPI / Online Transfer)', 'Mode of Purchase');
        const modeMap: Record<string, string> = {
          'cash': 'CASH', 'upi': 'UPI', 'onlinetransfer': 'UPI', 'online': 'UPI',
          'credit': 'CREDIT', 'barter': 'BARTER', 'mixed': 'MIXED',
        };
        const modePurchase = modeMap[normKey(modePurchaseRaw)] || '';

        // ── Case link fields ──
        const crNoYear = pick(row, 'Cr.No. & Year', 'Cr.No & Year', 'Cr. No.', 'Cr No');
        const casePS = pick(row, 'Name of the P.S.', 'Name of PS (Case)', 'Case PS');
        const secOfLaw = pick(row, 'Section of Law', 'Sec of Law', 'Sec. of Law');
        const stageRaw = pick(row, 'Stage of Case', 'Stage');
        const historyRowdy = pick(row, 'History Sheet / Rowdy Sheet', 'History Sheet', 'Rowdy Sheet');

        // ── Validation ──
        const errors: string[] = [];
        if (!parsedDetails.fullName && !detailsRaw) errors.push('Missing accused name/details');
        if (!ps && !psNameRaw) errors.push('Missing Police Station');
        else if (!ps) errors.push(`Unknown station "${psNameRaw}"`);

        previewData.push({
          id: `row_${i}`,
          originalRow: i + 2,
          importType: 'OFFENDER',
          // Core offender
          accusedName: parsedDetails.fullName || '',
          accusedAge: parsedDetails.age,
          accusedGuardian: parsedDetails.guardianName || '',
          category,
          // PS
          psName: psNameRaw,
          psCode: psCodeRaw,
          psId: ps ? Number(ps.id) : null,
          psDistrict: ps ? ps.district : '',
          psState: ps ? ps.state : '',
          stationType: ps ? ps.station_type : 'POLICE',
          // Contacts
          mobile1,
          mobile2,
          gmail,
          socialMedia,
          // Test
          testResult,
          // Addresses
          presentAddress,
          permanentAddress,
          // Financials
          bankName,
          bankAccount,
          upiIds,
          upiLinkedMobile,
          // Identity
          aadhaar,
          voterId,
          panCard,
          // Occupation
          occupation,
          monthlyIncome,
          // Network
          associates,
          supplierTransporter,
          kingpinSource,
          // Drug profile
          modePurchase,
          // Case link
          crNoYear,
          casePS,
          secOfLaw,
          stageRaw,
          historyRowdy,
          // Validation
          errors,
          isValid: errors.length === 0,
        });
      } else {
        // ── UNIFIED / CASE / CONSUMER ── (original logic)
        const crNo = cleanString(pick(row, 'Cr. No.', 'Cr No', 'CR No.', 'CR No')) || '';
        let accusedDetails = cleanString(pick(row, 'Accused Details', 'AccusedDetails')) || '';
        let parsedAccused = parseAccusedDetails(accusedDetails);

        if (importType === 'CONSUMER') {
          const rawName = cleanString(pick(row, 'Name', 'Accused Name', 'Consumer Name', 'Offender Name', 'Full Name'));
          if (rawName) {
            accusedDetails = rawName;
            parsedAccused = {
              offenderId: '',
              fullName: rawName,
              age: parseInt(pick(row, 'Age'), 10) || null,
              guardianName: pick(row, 'Guardian Name', 'Father Name', 'S/O', 'D/O', 'W/O', 'C/O') || null,
              address: pick(row, 'Address', 'Full Address', 'Address Line') || null,
              phone: pick(row, 'Phone', 'Mobile', 'Contact', 'Phone Number') || null,
              email: pick(row, 'Email', 'Email ID') || null,
              caste: pick(row, 'Caste') || null,
              mandal: pick(row, 'Mandal') || null,
              district: pick(row, 'District', 'Offender District') || null,
            };
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

        const errors: string[] = [];
        if (importType === 'UNIFIED' || importType === 'CASE') {
          if (!crNo) errors.push('Missing "Cr. No."');
          if (!ps) errors.push(`Unknown station "${psNameRaw || psCodeRaw}"`);
          if (importType === 'UNIFIED' && (!accusedDetails && !parsedAccused.fullName)) errors.push('Missing "Accused Details"');
        } else if (importType === 'CONSUMER') {
          if (!parsedAccused.fullName) errors.push('Missing "Name"');
          if (!ps) errors.push(`Unknown station "${psNameRaw || psCodeRaw}"`);
        }

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
          isValid: errors.length === 0,
        });
      }
    }

    res.json(successResponse({ rows: previewData }, 'Preview generated successfully'));
  } catch (error: any) {
    console.error('Preview error:', error);
    res.status(500).json({ message: `Failed to generate preview: ${error?.message || error}` });
  }
};

export const confirmDprImport = async (req: Request, res: Response) => {
  try {
    const { rows, importType = 'UNIFIED' } = req.body;
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
        let caseId: bigint | null = null;

        // ── OFFENDER import type: full offender pipeline ──
        if (importType === 'OFFENDER') {
          const fullName = cleanString(row.accusedName);
          if (!fullName) { stats.skipped++; continue; }

          // Generate sl_no
          let slNo = null;
          const offenderState = row.psState || 'Andhra Pradesh';
          const offenderDistrict = row.psDistrict || '';
          const stateCode = STATE_CODES[offenderState.toLowerCase().trim()];
          const districtNum = DISTRICT_NUMBERS[offenderDistrict.toLowerCase().trim()];
          if (stateCode && districtNum) {
            const prefix = `${stateCode}${districtNum}-`;
            const count = await prisma.offenders.count({ where: { sl_no: { startsWith: prefix } } });
            slNo = `${prefix}${String(count + 1).padStart(4, '0')}`;
          } else {
            const prefix = 'SL-';
            const count = await prisma.offenders.count({ where: { sl_no: { startsWith: prefix } } });
            slNo = `${prefix}${(100 + count).toString()}`;
          }

          // Parse income
          const incomeNum = row.monthlyIncome ? parseFloat(String(row.monthlyIncome).replace(/[^0-9.]/g, '')) : null;

          // Check for existing offender
          let offender = await prisma.offenders.findFirst({
            where: { ps_id: row.psId, full_name: { equals: fullName, mode: 'insensitive' } },
          });

          if (!offender) {
            offender = await prisma.offenders.create({
              data: {
                sl_no: slNo,
                ps_id: row.psId,
                full_name: fullName,
                father_husband_name: cleanString(row.accusedGuardian) || null,
                age: row.accusedAge ? parseInt(String(row.accusedAge), 10) : null,
                category: (row.category || null) as any,
                test_result: (row.testResult || null) as any,
                full_address: cleanString(row.presentAddress) || null,
                landmark_area: cleanString(row.permanentAddress) || null,
                district: offenderDistrict || null,
                state: offenderState || null,
                occupation: cleanString(row.occupation) || null,
                monthly_income: incomeNum && !Number.isNaN(incomeNum) ? incomeNum : null,
                created_by: userId,
              }
            });
            stats.offendersCreated++;
          } else {
            // Update missing fields
            const u: any = {};
            if (!offender.father_husband_name && row.accusedGuardian) u.father_husband_name = cleanString(row.accusedGuardian);
            if (!offender.age && row.accusedAge) u.age = parseInt(String(row.accusedAge), 10);
            if (!offender.category && row.category) u.category = row.category;
            if (!offender.test_result && row.testResult) u.test_result = row.testResult;
            if (!offender.full_address && row.presentAddress) u.full_address = cleanString(row.presentAddress);
            if (!offender.landmark_area && row.permanentAddress) u.landmark_area = cleanString(row.permanentAddress);
            if (!offender.occupation && row.occupation) u.occupation = cleanString(row.occupation);
            if (!offender.monthly_income && incomeNum && !Number.isNaN(incomeNum)) u.monthly_income = incomeNum;
            if (Object.keys(u).length > 0) {
              offender = await prisma.offenders.update({ where: { id: offender.id }, data: u });
            }
          }

          // ── Contacts ──
          const contactsToInsert: { type: string; value: string }[] = [];
          if (row.mobile1) contactsToInsert.push({ type: 'MOBILE_PRIMARY', value: String(row.mobile1).trim() });
          if (row.mobile2) contactsToInsert.push({ type: 'MOBILE_SECONDARY', value: String(row.mobile2).trim() });
          if (row.gmail) contactsToInsert.push({ type: 'GMAIL', value: String(row.gmail).trim() });
          if (row.socialMedia) {
            const sm = String(row.socialMedia).trim();
            if (sm.toLowerCase().includes('instagram') || sm.toLowerCase().includes('insta')) {
              contactsToInsert.push({ type: 'INSTAGRAM', value: sm });
            } else if (sm.toLowerCase().includes('facebook') || sm.toLowerCase().includes('fb')) {
              contactsToInsert.push({ type: 'FACEBOOK', value: sm });
            } else {
              contactsToInsert.push({ type: 'OTHER_SOCIAL', value: sm });
            }
          }
          for (const c of contactsToInsert) {
            const exists = await prisma.offender_contacts.findFirst({
              where: { offender_id: offender.id, contact_type: c.type as any, value: c.value }
            });
            if (!exists) {
              await prisma.offender_contacts.create({
                data: { offender_id: offender.id, contact_type: c.type as any, value: c.value }
              });
            }
          }

          // ── Financials ──
          const financialsToInsert: { type: string; value: string; bankName?: string }[] = [];
          if (row.bankAccount) financialsToInsert.push({ type: 'BANK_ACCOUNT_NO', value: String(row.bankAccount).trim(), bankName: row.bankName || null });
          if (row.bankName && !row.bankAccount) financialsToInsert.push({ type: 'BANK_NAME', value: String(row.bankName).trim() });
          if (row.upiIds) financialsToInsert.push({ type: 'UPI_ID', value: String(row.upiIds).trim() });
          if (row.upiLinkedMobile) financialsToInsert.push({ type: 'UPI_LINKED_MOBILE', value: String(row.upiLinkedMobile).trim() });
          for (const f of financialsToInsert) {
            const exists = await prisma.offender_financials.findFirst({
              where: { offender_id: offender.id, fin_type: f.type as any, value: f.value }
            });
            if (!exists) {
              await prisma.offender_financials.create({
                data: { offender_id: offender.id, fin_type: f.type as any, value: f.value, bank_name: f.bankName || null }
              });
            }
          }

          // ── Identity Documents ──
          if (row.aadhaar || row.voterId || row.panCard) {
            const existingDoc = await prisma.offender_identity_docs.findFirst({ where: { offender_id: offender.id } });
            if (!existingDoc) {
              await prisma.offender_identity_docs.create({
                data: {
                  offender_id: offender.id,
                  aadhaar_no: cleanString(row.aadhaar) || null,
                  voter_id: cleanString(row.voterId) || null,
                  pan_card: cleanString(row.panCard) || null,
                }
              });
            } else {
              const docUpdate: any = {};
              if (!existingDoc.aadhaar_no && row.aadhaar) docUpdate.aadhaar_no = cleanString(row.aadhaar);
              if (!existingDoc.voter_id && row.voterId) docUpdate.voter_id = cleanString(row.voterId);
              if (!existingDoc.pan_card && row.panCard) docUpdate.pan_card = cleanString(row.panCard);
              if (Object.keys(docUpdate).length > 0) {
                await prisma.offender_identity_docs.update({ where: { id: existingDoc.id }, data: docUpdate });
              }
            }
          }

          // ── Supply Chain Links ──
          if (row.associates) {
            const exists = await prisma.supply_chain_links.findFirst({
              where: { offender_id: offender.id, link_type: 'CO_CONSUMER', linked_person_name: String(row.associates).substring(0, 200) }
            });
            if (!exists) {
              await prisma.supply_chain_links.create({
                data: { offender_id: offender.id, link_type: 'CO_CONSUMER', linked_person_name: String(row.associates).substring(0, 200), linked_person_contact: null }
              });
            }
          }
          if (row.supplierTransporter) {
            const exists = await prisma.supply_chain_links.findFirst({
              where: { offender_id: offender.id, link_type: 'SUPPLIER', linked_person_name: String(row.supplierTransporter).substring(0, 200) }
            });
            if (!exists) {
              await prisma.supply_chain_links.create({
                data: { offender_id: offender.id, link_type: 'SUPPLIER', linked_person_name: String(row.supplierTransporter).substring(0, 200), linked_person_contact: null }
              });
            }
          }
          if (row.kingpinSource) {
            const exists = await prisma.supply_chain_links.findFirst({
              where: { offender_id: offender.id, link_type: 'KINGPIN', linked_person_name: String(row.kingpinSource).substring(0, 200) }
            });
            if (!exists) {
              await prisma.supply_chain_links.create({
                data: { offender_id: offender.id, link_type: 'KINGPIN', linked_person_name: String(row.kingpinSource).substring(0, 200), linked_person_contact: null }
              });
            }
          }

          // ── Drug Profile (mode of purchase) ──
          if (row.modePurchase || row.secOfLaw) {
            const profile = await prisma.offender_drug_profile.findUnique({ where: { offender_id: offender.id } });
            if (profile) {
              const pu: any = {};
              if (row.modePurchase && !profile.mode_of_purchase) pu.mode_of_purchase = row.modePurchase;
              if (row.secOfLaw && !profile.section_of_law) pu.section_of_law = row.secOfLaw;
              if (Object.keys(pu).length > 0) {
                await prisma.offender_drug_profile.update({ where: { offender_id: offender.id }, data: pu });
              }
            } else {
              await prisma.offender_drug_profile.create({
                data: {
                  offender_id: offender.id,
                  mode_of_purchase: (row.modePurchase || null) as any,
                  section_of_law: row.secOfLaw || null,
                }
              });
            }
          }

          // ── Case link (Cr.No & Year) ──
          if (row.crNoYear && row.psId) {
            const crNo = cleanString(row.crNoYear);
            if (crNo) {
              let existingCase = await prisma.cases.findFirst({ where: { fir_no: crNo, ps_id: row.psId } });
              // Parse case stage
              const stageMap: Record<string, string> = {
                'fir': 'FIR', 'chargesheet': 'CHARGESHEET', 'trial': 'TRIAL',
                'convicted': 'CONVICTED', 'acquitted': 'ACQUITTED', 'closed': 'CLOSED',
              };
              const stageVal = stageMap[normKey(row.stageRaw || '')] || 'FIR';
              // Parse history/rowdy
              const hrRaw = (row.historyRowdy || '').toLowerCase();
              const isHistory = hrRaw.includes('history');
              const isRowdy = hrRaw.includes('rowdy');

              if (!existingCase) {
                const created = await prisma.cases.create({
                  data: {
                    fir_no: crNo,
                    ps_id: row.psId,
                    section_of_law: row.secOfLaw || null,
                    case_date: caseDate,
                    stage: stageVal as any,
                    is_history_sheet: isHistory,
                    is_rowdy_sheet: isRowdy,
                    department: row.stationType === 'EXCISE' ? 'EXCISE' : 'POLICE',
                    created_by: userId,
                  }
                });
                caseId = created.id;
                stats.casesCreated++;
              } else {
                caseId = existingCase.id;
              }

              // Link offender to case
              const linked = await prisma.case_accused.findFirst({ where: { case_id: caseId, offender_id: offender.id } });
              if (!linked) {
                await prisma.case_accused.create({
                  data: { case_id: caseId, offender_id: offender.id, arrest_status: 'ARRESTED' }
                });
              }
            }
          }

          continue; // Skip the UNIFIED/CONSUMER block below
        }

        // ── UNIFIED / CASE logic ──
        if (importType === 'UNIFIED' || importType === 'CASE') {
          const existingCase = await prisma.cases.findFirst({
            where: { fir_no: row.crNo, ps_id: row.psId },
          });

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
        }

        if (importType === 'UNIFIED' || importType === 'CONSUMER' || importType === 'OFFENDER') {
          let offendersToProcess: any[] = [];
          
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

              const offenderCategory = importType === 'CONSUMER' ? 'CONSUMER' : null;

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
                  category: offenderCategory as any,
                  district: offenderDistrict || null,
                  state: offenderState || null,
                  created_by: userId,
                }
              });
              stats.offendersCreated++;
            } else {
              const updateObj: any = {};
              if (importType === 'CONSUMER' && offender.category !== 'CONSUMER') updateObj.category = 'CONSUMER';
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
            const exists = await prisma.offender_contacts.findFirst({ where: { offender_id: offender.id, contact_type: 'MOBILE_PRIMARY', value: parsed.phone }});
            if (!exists) {
              await prisma.offender_contacts.create({ data: { offender_id: offender.id, contact_type: 'MOBILE_PRIMARY', value: parsed.phone } });
            }
          }
          if (parsed.email) {
            const exists = await prisma.offender_contacts.findFirst({ where: { offender_id: offender.id, contact_type: 'GMAIL', value: parsed.email }});
            if (!exists) {
              await prisma.offender_contacts.create({ data: { offender_id: offender.id, contact_type: 'GMAIL', value: parsed.email } });
            }
          }

            if (row.secOfLaw && caseId) {
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

            if (caseId) {
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
