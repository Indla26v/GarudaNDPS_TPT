import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';
import { getCaseWhere } from '../utils/scope';
import { paramId } from '../utils/params';
import { broadcastEvent } from './sse.controller';

function mapCaseData(data: any) {
  const mapped: Record<string, unknown> = {};
  if (data.firNo !== undefined || data.fir_no !== undefined) mapped.fir_no = data.firNo ?? data.fir_no;
  if (data.psId !== undefined || data.ps_id !== undefined) mapped.ps_id = BigInt(data.psId ?? data.ps_id);
  if (data.sectionOfLaw !== undefined || data.section_of_law !== undefined) {
    mapped.section_of_law = data.sectionOfLaw ?? data.section_of_law;
  }
  if (data.caseDate !== undefined || data.case_date !== undefined) {
    mapped.case_date = new Date(data.caseDate ?? data.case_date);
  }
  if (data.stage !== undefined) mapped.stage = data.stage;
  if (data.isHistorySheet !== undefined || data.is_history_sheet !== undefined) {
    mapped.is_history_sheet = data.isHistorySheet ?? data.is_history_sheet;
  }
  if (data.isRowdySheet !== undefined || data.is_rowdy_sheet !== undefined) {
    mapped.is_rowdy_sheet = data.isRowdySheet ?? data.is_rowdy_sheet;
  }
  if (data.relevantFiles !== undefined || data.relevant_files !== undefined) {
    mapped.relevant_files = data.relevantFiles ?? data.relevant_files;
  }
  if (data.natureOfOffence !== undefined || data.nature_of_offence !== undefined) {
    mapped.nature_of_offence = data.natureOfOffence ?? data.nature_of_offence;
  }
  if (data.contrabandType !== undefined || data.contraband_type !== undefined) {
    mapped.contraband_type = data.contrabandType ?? data.contraband_type;
  }
  if (data.quantity !== undefined) mapped.quantity = data.quantity;
  if (data.quantityUnit !== undefined || data.quantity_unit !== undefined) {
    mapped.quantity_unit = data.quantityUnit ?? data.quantity_unit;
  }
  if (data.streetValue !== undefined || data.street_value !== undefined) {
    mapped.street_value = data.streetValue ?? data.street_value;
  }
  if (data.sourceLocation !== undefined || data.source_location !== undefined) {
    mapped.source_location = data.sourceLocation ?? data.source_location;
  }
  if (data.destinationLocation !== undefined || data.destination_location !== undefined) {
    mapped.destination_location = data.destinationLocation ?? data.destination_location;
  }
  if (data.intelligenceNotes !== undefined || data.intelligence_notes !== undefined) {
    mapped.intelligence_notes = data.intelligenceNotes ?? data.intelligence_notes;
  }
  if (data.department !== undefined) mapped.department = data.department;
  return mapped;
}

const caseInclude = {
  police_stations: true,
  users: true,
  case_accused: { include: { offenders: true, police_stations: true } },
  seizures: true,
  charge_sheets: true,
  court_hearings: { orderBy: { hearing_date: 'desc' as const } },
  bail_records: { orderBy: { created_at: 'desc' as const } },
};

export const createCase = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const user = (req as any).user;
    const userId = user?.userId ? BigInt(user.userId) : null;

    let firNo = data.firNo || data.fir_no;
    if (!firNo && data.psId) {
      const ps = await prisma.police_stations.findUnique({ where: { id: BigInt(data.psId || data.ps_id) } });
      const year = new Date().getFullYear();
      const count = await prisma.cases.count({
        where: { ps_id: BigInt(data.psId || data.ps_id), case_date: { gte: new Date(`${year}-01-01`) } },
      });
      firNo = `${ps?.ps_code || 'PS'}/${year}/${count + 1}`;
    }

    const accusedList = Array.isArray(data.accused) ? data.accused : [];
    const seizureList = data.seizures
      ? Array.isArray(data.seizures)
        ? data.seizures
        : [data.seizures]
      : [];

    const newCase = await prisma.$transaction(async (tx) => {
      const created = await tx.cases.create({
        data: {
          ...mapCaseData({ ...data, firNo }),
          fir_no: firNo,
          created_by: userId,
        } as any,
      });

      if (accusedList.length) {
        await tx.case_accused.createMany({
          data: accusedList.map((a: any) => ({
            case_id: created.id,
            offender_id: BigInt(a.offenderId || a.offender_id),
            arrest_status: a.arrestStatus || a.arrest_status || 'ARRESTED',
            arrest_date: a.arrestDate || a.arrest_date ? new Date(a.arrestDate || a.arrest_date) : null,
          })),
        });
      }

      if (seizureList.length) {
        await tx.seizures.createMany({
          data: seizureList.map((s: any) => ({
            case_id: created.id,
            contraband_kg: s.contrabandKg ?? s.contraband_kg ?? null,
            vehicles_count: s.vehiclesCount ?? s.vehicles_count ?? 0,
            cash_amount: s.cashAmount ?? s.cash_amount ?? 0,
            parcels_count: s.parcelsCount ?? s.parcels_count ?? 0,
            other_items: s.otherItems ?? s.other_items ?? null,
            seizure_date: s.seizureDate || s.seizure_date ? new Date(s.seizureDate || s.seizure_date) : null,
          })),
        });
      }

      return created;
    });

    await logAudit('CREATE', 'CASE', newCase.id, req);
    broadcastEvent('case_created', { id: newCase.id.toString(), firNo: newCase.fir_no });
    res.status(201).json(successResponse({ id: newCase.id.toString(), firNo: newCase.fir_no }, 'Case created'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateCase = async (req: Request, res: Response) => {
  try {
    const id = paramId(req);
    const scope = getCaseWhere((req as any).user);
    const existing = await prisma.cases.findFirst({ where: { id, ...scope } });
    if (!existing) return res.status(404).json({ message: 'Case not found or access denied' });

    const updated = await prisma.cases.update({
      where: { id },
      data: { ...mapCaseData(req.body), updated_at: new Date() } as any,
      include: caseInclude,
    });

    await logAudit('UPDATE', 'CASE', updated.id, req);
    broadcastEvent('data_updated', { entity: 'case', id: updated.id.toString() });
    res.json(successResponse(toCaseResponse(updated)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCases = async (req: Request, res: Response) => {
  try {
    const { page = 0, size = 10, stage, search } = req.query;
    const skip = Number(page) * Number(size);
    const take = Number(size);
    const scope = getCaseWhere((req as any).user) as any;

    if (stage) scope.stage = String(stage);
    if (search) {
      scope.OR = [
        { fir_no: { contains: String(search), mode: 'insensitive' } },
        { section_of_law: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const [cases, total] = await Promise.all([
      prisma.cases.findMany({
        where: scope,
        include: caseInclude,
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      prisma.cases.count({ where: scope }),
    ]);

    res.json(successResponse({
      content: cases.map((c) => toCaseResponse(c)),
      totalElements: total,
      totalPages: Math.ceil(total / take),
    }));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCaseById = async (req: Request, res: Response) => {
  try {
    const id = paramId(req);
    const scope = getCaseWhere((req as any).user);
    const caseItem = await prisma.cases.findFirst({
      where: { id, ...scope },
      include: caseInclude,
    });

    if (!caseItem) return res.status(404).json({ message: 'Case not found' });
    res.json(successResponse(toCaseResponse(caseItem)));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateAccused = async (req: Request, res: Response) => {
  try {
    const id = paramId(req);
    const accusedData = Array.isArray(req.body) ? req.body : [req.body];

    await prisma.case_accused.deleteMany({ where: { case_id: id } });

    const creates = accusedData.map((a: any) => ({
      case_id: id,
      offender_id: BigInt(a.offenderId || a.offender_id),
      previous_cr_no: a.previousCrNo || a.previous_cr_no,
      previous_ps_id: a.previousPsId || a.previous_ps_id ? BigInt(a.previousPsId || a.previous_ps_id) : null,
      arrest_status: a.arrestStatus || a.arrest_status || 'ARRESTED',
      arrest_date: a.arrestDate || a.arrest_date ? new Date(a.arrestDate || a.arrest_date) : null,
      bail_date: a.bailDate || a.bail_date ? new Date(a.bailDate || a.bail_date) : null,
      bail_conditions: a.bailConditions || a.bail_conditions,
    }));

    if (creates.length > 0) await prisma.case_accused.createMany({ data: creates });
    await logAudit('UPDATE_ACCUSED', 'CASE', id, req);
    broadcastEvent('data_updated', { entity: 'case', id: id.toString() });
    res.json(successResponse({ id: id.toString() }, 'Accused list updated'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateSeizure = async (req: Request, res: Response) => {
  try {
    const id = paramId(req);
    const seizureData = req.body;
    await prisma.seizures.deleteMany({ where: { case_id: id } });

    const dataArr = Array.isArray(seizureData) ? seizureData : [seizureData];
    if (dataArr.length > 0) {
      await prisma.seizures.createMany({
        data: dataArr.map((s: any) => ({
          case_id: id,
          contraband_kg: s.contrabandKg ?? s.contraband_kg,
          vehicles_count: s.vehiclesCount ?? s.vehicles_count ?? 0,
          cash_amount: s.cashAmount ?? s.cash_amount ?? 0,
          parcels_count: s.parcelsCount ?? s.parcels_count ?? 0,
          other_items: s.otherItems ?? s.other_items,
          seizure_date: s.seizureDate || s.seizure_date ? new Date(s.seizureDate || s.seizure_date) : null,
        })),
      });
    }

    await logAudit('UPDATE_SEIZURE', 'CASE', id, req);
    broadcastEvent('data_updated', { entity: 'case', id: id.toString() });
    res.json(successResponse({ id: id.toString() }, 'Seizure updated'));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCasesByOffender = async (req: Request, res: Response) => {
  try {
    const offenderId = paramId(req, 'offenderId');
    const cases = await prisma.cases.findMany({
      where: {
        case_accused: { some: { offender_id: offenderId } },
      },
      include: caseInclude,
      orderBy: { case_date: 'desc' },
    });
    res.json(successResponse(cases.map((c) => toCaseResponse(c))));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

function toCaseResponse(c: any) {
  return {
    id: c.id.toString(),
    firNo: c.fir_no,
    psId: c.ps_id.toString(),
    psName: c.police_stations?.name,
    stationType: c.police_stations?.station_type,
    sectionOfLaw: c.section_of_law,
    caseDate: c.case_date,
    stage: c.stage,
    natureOfOffence: c.nature_of_offence,
    contrabandType: c.contraband_type,
    quantity: c.quantity,
    quantityUnit: c.quantity_unit,
    streetValue: c.street_value,
    sourceLocation: c.source_location,
    destinationLocation: c.destination_location,
    intelligenceNotes: c.intelligence_notes,
    department: c.department,
    isHistorySheet: c.is_history_sheet,
    isRowdySheet: c.is_rowdy_sheet,
    relevantFiles: c.relevant_files,
    createdByName: c.users?.full_name,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    accused: c.case_accused?.map((ca: any) => ({
      id: ca.id.toString(),
      offenderId: ca.offender_id.toString(),
      offenderName: ca.offenders?.full_name,
      previousCrNo: ca.previous_cr_no,
      previousPsId: ca.previous_ps_id?.toString(),
      arrestStatus: ca.arrest_status,
      arrestDate: ca.arrest_date,
      bailDate: ca.bail_date,
      bailConditions: ca.bail_conditions,
    })) ?? [],
    seizures: c.seizures?.map((s: any) => ({
      id: s.id.toString(),
      contrabandKg: s.contraband_kg,
      vehiclesCount: s.vehicles_count,
      cashAmount: s.cash_amount,
      parcelsCount: s.parcels_count,
      otherItems: s.other_items,
      seizureDate: s.seizure_date,
    })) ?? [],
    chargeSheet: c.charge_sheets
      ? {
          id: c.charge_sheets.id.toString(),
          expectedSubmissionDate: c.charge_sheets.expected_submission_date,
          actualSubmissionDate: c.charge_sheets.actual_submission_date,
          missingDocuments: c.charge_sheets.missing_documents,
          prosecutorName: c.charge_sheets.prosecutor_name,
          notes: c.charge_sheets.notes,
        }
      : null,
    courtHearings: c.court_hearings?.map((h: any) => ({
      id: h.id.toString(),
      scNumber: h.sc_number,
      courtName: h.court_name,
      hearingDate: h.hearing_date,
      judgeName: h.judge_name,
      orderText: h.order_text,
      nextHearingDate: h.next_hearing_date,
    })) ?? [],
    bailRecords: c.bail_records?.map((b: any) => ({
      id: b.id.toString(),
      caseAccusedId: b.case_accused_id?.toString(),
      applicationDate: b.application_date,
      status: b.status,
      grantedDate: b.granted_date,
      courtName: b.court_name,
      suretyDetails: b.surety_details,
      conditions: b.conditions,
      notes: b.notes,
    })) ?? [],
  };
}
