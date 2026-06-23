import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

// GET /api/offenders/:offenderId/imei
export const getImeiRecords = async (req: Request, res: Response) => {
  try {
    const offenderId = BigInt(String(req.params.offenderId));
    const records = await (prisma as any).imei_records.findMany({
      where: { offender_id: offenderId },
      orderBy: { created_at: 'desc' },
    });
    const data = records.map((r: any) => ({
      id: r.id.toString(),
      imeiNumber: r.imei_number,
      deviceMake: r.device_make,
      deviceModel: r.device_model,
      simNumber: r.sim_number,
      simProvider: r.sim_provider,
      mobileNumber: r.mobile_number,
      status: r.status,
      firstSeen: r.first_seen,
      lastSeen: r.last_seen,
      notes: r.notes,
    }));
    res.json(successResponse(data));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch IMEI records' });
  }
};

// POST /api/offenders/:offenderId/imei
export const createImeiRecord = async (req: Request, res: Response) => {
  try {
    const offenderId = BigInt(String(req.params.offenderId));
    const userId = (req as any).user?.userId ? BigInt((req as any).user.userId) : null;
    const { imeiNumber, deviceMake, deviceModel, simNumber, simProvider, mobileNumber, notes } = req.body;

    if (!imeiNumber || imeiNumber.length < 15) {
      return res.status(400).json({ message: 'Valid IMEI number (15 digits) is required' });
    }

    const record = await (prisma as any).imei_records.create({
      data: {
        offender_id: offenderId,
        imei_number: imeiNumber,
        device_make: deviceMake || null,
        device_model: deviceModel || null,
        sim_number: simNumber || null,
        sim_provider: simProvider || null,
        mobile_number: mobileNumber || null,
        notes: notes || null,
        created_by: userId,
      },
    });

    await logAudit('CREATE', 'IMEI_RECORD', record.id, req, 
      `IMEI ${imeiNumber} linked to offender #${offenderId}`);

    res.status(201).json(successResponse({ id: record.id.toString() }, 'IMEI record added'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to create IMEI record' });
  }
};

// PUT /api/offenders/:offenderId/imei/:id  (update status e.g. SWAPPED)
export const updateImeiRecord = async (req: Request, res: Response) => {
  try {
    const id = BigInt(String(req.params.id));
    const { status, lastSeen, notes } = req.body;

    const updated = await (prisma as any).imei_records.update({
      where: { id },
      data: {
        status: status || undefined,
        last_seen: lastSeen ? new Date(lastSeen) : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
    });

    await logAudit('UPDATE', 'IMEI_RECORD', id, req, `IMEI status → ${status}`);
    res.json(successResponse({ id: updated.id.toString() }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update IMEI record' });
  }
};
