import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

export const createCase = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    let userId = null;
    if ((req as any).user) {
       userId = BigInt((req as any).user.userId);
    }

    const newCase = await prisma.cases.create({
      data: {
        fir_no: data.firNo || data.fir_no,
        ps_id: BigInt(data.psId || data.ps_id),
        section_of_law: data.sectionOfLaw || data.section_of_law,
        case_date: data.caseDate || data.case_date ? new Date(data.caseDate || data.case_date) : new Date(),
        stage: data.stage || 'FIR',
        is_history_sheet: data.isHistorySheet !== undefined ? data.isHistorySheet : false,
        is_rowdy_sheet: data.isRowdySheet !== undefined ? data.isRowdySheet : false,
        created_by: userId,
      }
    });

    await logAudit('CREATE', 'CASE', newCase.id, req);

    res.status(201).json(successResponse({ id: newCase.id.toString() }, 'Case created'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCases = async (req: Request, res: Response) => {
  try {
    const { page = 0, size = 10 } = req.query;
    const skip = Number(page) * Number(size);
    const take = Number(size);

    const [cases, total] = await Promise.all([
      prisma.cases.findMany({
        include: {
          police_stations: true,
          users: true,
          case_accused: {
            include: { offenders: true, police_stations: true }
          },
          seizures: true
        },
        skip,
        take
      }),
      prisma.cases.count()
    ]);

    const formatted = cases.map(c => toCaseResponse(c));

    res.json(successResponse({ content: formatted, totalElements: total, totalPages: Math.ceil(total / take) }));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCaseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const caseItem = await prisma.cases.findUnique({
      where: { id: BigInt(id) },
      include: {
        police_stations: true,
        users: true,
        case_accused: {
          include: { offenders: true, police_stations: true }
        },
        seizures: true
      }
    });

    if (!caseItem) return res.status(404).json({ message: 'Case not found' });
    
    res.json(successResponse(toCaseResponse(caseItem)));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateAccused = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const accusedData = req.body; // Expecting an array

    // Delete existing
    await prisma.case_accused.deleteMany({
      where: { case_id: BigInt(id) }
    });

    // Create new
    const creates = accusedData.map((a: any) => ({
      case_id: BigInt(id),
      offender_id: BigInt(a.offenderId || a.offender_id),
      previous_cr_no: a.previousCrNo || a.previous_cr_no,
      previous_ps_id: a.previousPsId || a.previous_ps_id ? BigInt(a.previousPsId || a.previous_ps_id) : null,
      arrest_status: a.arrestStatus || a.arrest_status || 'ARRESTED',
      arrest_date: a.arrestDate || a.arrest_date ? new Date(a.arrestDate || a.arrest_date) : null,
      bail_date: a.bailDate || a.bail_date ? new Date(a.bailDate || a.bail_date) : null,
      bail_conditions: a.bailConditions || a.bail_conditions
    }));

    if (creates.length > 0) {
      await prisma.case_accused.createMany({ data: creates });
    }

    await logAudit('UPDATE_ACCUSED', 'CASE', id, req);

    res.json(successResponse({ id }, 'Accused list updated'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateSeizure = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const seizureData = req.body; // single object or array

    await prisma.seizures.deleteMany({
      where: { case_id: BigInt(id) }
    });

    const isArray = Array.isArray(seizureData);
    const dataArr = isArray ? seizureData : [seizureData];

    if (dataArr.length > 0) {
      const creates = dataArr.map(s => ({
        case_id: BigInt(id),
        contraband_kg: s.contrabandKg || s.contraband_kg,
        vehicles_count: s.vehiclesCount || s.vehicles_count || 0,
        cash_amount: s.cashAmount || s.cash_amount || 0,
        parcels_count: s.parcelsCount || s.parcels_count || 0,
        other_items: s.otherItems || s.other_items,
        seizure_date: s.seizureDate || s.seizure_date ? new Date(s.seizureDate || s.seizure_date) : null
      }));
      await prisma.seizures.createMany({ data: creates });
    }

    await logAudit('UPDATE_SEIZURE', 'CASE', id, req);

    res.json(successResponse({ id }, 'Seizure updated'));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCasesByOffender = async (req: Request, res: Response) => {
  try {
     const { offenderId } = req.params;
     const cases = await prisma.cases.findMany({
        where: {
          case_accused: {
            some: { offender_id: BigInt(offenderId) }
          }
        },
        include: {
          police_stations: true,
          users: true,
          case_accused: {
            include: { offenders: true, police_stations: true }
          },
          seizures: true
        }
     });

     const formatted = cases.map(c => toCaseResponse(c));
     res.json(successResponse(formatted));
  } catch(error) {
     res.status(500).json({ message: 'Server error' });
  }
}

function toCaseResponse(c: any) {
  return {
    id: c.id.toString(),
    firNo: c.fir_no,
    psId: c.ps_id.toString(),
    psName: c.police_stations?.name,
    sectionOfLaw: c.section_of_law,
    caseDate: c.case_date,
    stage: c.stage,
    isHistorySheet: c.is_history_sheet,
    isRowdySheet: c.is_rowdy_sheet,
    createdByName: c.users?.full_name,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    accused: c.case_accused.map((ca: any) => ({
      id: ca.id.toString(),
      offenderId: ca.offender_id.toString(),
      offenderName: ca.offenders?.full_name,
      previousCrNo: ca.previous_cr_no,
      previousPsId: ca.previous_ps_id?.toString(),
      arrestStatus: ca.arrest_status,
      arrestDate: ca.arrest_date,
      bailDate: ca.bail_date,
      bailConditions: ca.bail_conditions
    })),
    seizures: c.seizures.map((s: any) => ({
      id: s.id.toString(),
      contrabandKg: s.contraband_kg,
      vehiclesCount: s.vehicles_count,
      cashAmount: s.cash_amount,
      parcelsCount: s.parcels_count,
      otherItems: s.other_items,
      seizureDate: s.seizure_date
    }))
  };
}