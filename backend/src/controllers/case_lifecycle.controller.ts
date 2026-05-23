import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';
import { paramId } from '../utils/params';

export const getChargeSheet = async (req: Request, res: Response) => {
  try {
    const caseId = paramId(req);
    const cs = await prisma.charge_sheets.findUnique({
      where: { case_id: caseId },
    });
    res.json(successResponse(cs ? { ...cs, id: cs.id.toString(), case_id: cs.case_id.toString() } : null));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const upsertChargeSheet = async (req: Request, res: Response) => {
  try {
    const caseId = paramId(req);
    const d = req.body;
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (d.expectedSubmissionDate) updateData.expected_submission_date = new Date(d.expectedSubmissionDate);
    if (d.actualSubmissionDate) updateData.actual_submission_date = new Date(d.actualSubmissionDate);
    if (d.missingDocuments !== undefined || d.missing_documents !== undefined) {
      updateData.missing_documents = d.missingDocuments ?? d.missing_documents;
    }
    if (d.prosecutorName !== undefined || d.prosecutor_name !== undefined) {
      updateData.prosecutor_name = d.prosecutorName ?? d.prosecutor_name;
    }
    if (d.notes !== undefined) updateData.notes = d.notes;

    const cs = await prisma.charge_sheets.upsert({
      where: { case_id: caseId },
      create: {
        case_id: caseId,
        expected_submission_date: d.expectedSubmissionDate ? new Date(d.expectedSubmissionDate) : null,
        actual_submission_date: d.actualSubmissionDate ? new Date(d.actualSubmissionDate) : null,
        missing_documents: d.missingDocuments ?? d.missing_documents,
        prosecutor_name: d.prosecutorName ?? d.prosecutor_name,
        notes: d.notes,
      },
      update: updateData as any,
    });
    await logAudit('UPDATE', 'CHARGE_SHEET', cs.id, req);
    res.json(successResponse({ id: cs.id.toString() }, 'Charge sheet saved'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCourtHearings = async (req: Request, res: Response) => {
  try {
    const rows = await prisma.court_hearings.findMany({
      where: { case_id: paramId(req) },
      orderBy: { hearing_date: 'desc' },
    });
    res.json(successResponse(rows.map((h) => ({ ...h, id: h.id.toString(), case_id: h.case_id.toString() }))));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addCourtHearing = async (req: Request, res: Response) => {
  try {
    const d = req.body;
    const h = await prisma.court_hearings.create({
      data: {
        case_id: paramId(req),
        sc_number: d.scNumber ?? d.sc_number,
        court_name: d.courtName ?? d.court_name,
        hearing_date: d.hearingDate || d.hearing_date ? new Date(d.hearingDate || d.hearing_date) : null,
        judge_name: d.judgeName ?? d.judge_name,
        order_text: d.orderText ?? d.order_text,
        next_hearing_date: d.nextHearingDate || d.next_hearing_date ? new Date(d.nextHearingDate || d.next_hearing_date) : null,
      },
    });
    await logAudit('CREATE', 'COURT_HEARING', h.id, req);
    res.status(201).json(successResponse({ id: h.id.toString() }, 'Hearing added'));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getBailRecords = async (req: Request, res: Response) => {
  try {
    const rows = await prisma.bail_records.findMany({
      where: { case_id: paramId(req) },
      orderBy: { created_at: 'desc' },
    });
    res.json(successResponse(rows.map((b) => ({
      ...b,
      id: b.id.toString(),
      case_id: b.case_id.toString(),
      case_accused_id: b.case_accused_id?.toString() ?? null,
    }))));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addBailRecord = async (req: Request, res: Response) => {
  try {
    const d = req.body;
    const b = await prisma.bail_records.create({
      data: {
        case_id: paramId(req),
        case_accused_id: d.caseAccusedId || d.case_accused_id ? BigInt(d.caseAccusedId || d.case_accused_id) : null,
        application_date: d.applicationDate || d.application_date ? new Date(d.applicationDate || d.application_date) : null,
        status: d.status || 'PENDING',
        granted_date: d.grantedDate || d.granted_date ? new Date(d.grantedDate || d.granted_date) : null,
        court_name: d.courtName ?? d.court_name,
        surety_details: d.suretyDetails ?? d.surety_details,
        conditions: d.conditions,
        notes: d.notes,
      },
    });
    await logAudit('CREATE', 'BAIL_RECORD', b.id, req);
    res.status(201).json(successResponse({ id: b.id.toString() }, 'Bail record added'));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getInterrogations = async (req: Request, res: Response) => {
  try {
    const rows = await prisma.interrogation_sessions.findMany({
      where: { offender_id: paramId(req, 'offenderId') },
      include: { users: { select: { full_name: true } } },
      orderBy: { session_at: 'desc' },
    });
    res.json(successResponse(rows.map((s) => ({
      id: s.id.toString(),
      offenderId: s.offender_id.toString(),
      caseId: s.case_id?.toString() ?? null,
      officerName: s.users?.full_name,
      sessionAt: s.session_at,
      sourceInfo: s.source_info,
      purchasePrice: s.purchase_price,
      sellingPrice: s.selling_price,
      deliveryMode: s.delivery_mode,
      paymentMode: s.payment_mode,
      networkMembers: s.network_members,
      mobilesDisclosed: s.mobiles_disclosed,
      intelInputs: s.intel_inputs,
      notes: s.notes,
    }))));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const addInterrogation = async (req: Request, res: Response) => {
  try {
    const d = req.body;
    const userId = (req as any).user?.userId;
    const s = await prisma.interrogation_sessions.create({
      data: {
        offender_id: paramId(req, 'offenderId'),
        case_id: d.caseId || d.case_id ? BigInt(d.caseId || d.case_id) : null,
        officer_id: userId ? BigInt(userId) : null,
        session_at: d.sessionAt || d.session_at ? new Date(d.sessionAt || d.session_at) : new Date(),
        source_info: d.sourceInfo ?? d.source_info,
        purchase_price: d.purchasePrice ?? d.purchase_price,
        selling_price: d.sellingPrice ?? d.selling_price,
        delivery_mode: d.deliveryMode ?? d.delivery_mode,
        payment_mode: d.paymentMode ?? d.payment_mode,
        network_members: d.networkMembers ?? d.network_members,
        mobiles_disclosed: d.mobilesDisclosed ?? d.mobiles_disclosed,
        intel_inputs: d.intelInputs ?? d.intel_inputs,
        notes: d.notes,
      },
    });
    await logAudit('CREATE', 'INTERROGATION', s.id, req);
    res.status(201).json(successResponse({ id: s.id.toString() }, 'Interrogation session saved'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
