import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { getDashboardScope, ScopeUser } from '../utils/scope';
import { logAudit } from '../utils/auditLogger';

// Helper: build scoping where clause for surveillance_records based on linked offender's police station
function getSurveillanceWhere(user: ScopeUser): Record<string, any> {
  const { psFilter } = getDashboardScope(user);
  
  if (psFilter.ps_id) {
    return { offenders: { ps_id: psFilter.ps_id } };
  } else if (psFilter.police_stations) {
    return { offenders: { police_stations: psFilter.police_stations } };
  }
  return {};
}

// GET /api/surveillance
export const listSurveillanceRecords = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const baseWhere = getSurveillanceWhere(user);
    const { status, offenderId } = req.query;

    const whereClause: any = { ...baseWhere };
    if (status) {
      whereClause.verification_status = status;
    }
    if (offenderId) {
      whereClause.offender_id = BigInt(String(offenderId));
    }

    const records = await prisma.surveillance_records.findMany({
      where: whereClause,
      include: {
        offenders: {
          select: { id: true, full_name: true, alias: true, photo_url: true }
        },
        users: {
          select: { id: true, full_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const data = records.map((r) => ({
      id: r.id.toString(),
      offenderId: r.offender_id.toString(),
      offenderName: r.offenders?.full_name || '—',
      offenderAlias: r.offenders?.alias || '',
      offenderPhoto: r.offenders?.photo_url || null,
      scheduledDate: r.scheduled_date,
      verifiedBy: r.verified_by?.toString() || null,
      verifiedByName: r.users?.full_name || '—',
      verificationStatus: r.verification_status,
      currentAddress: r.current_address || '',
      currentOccupation: r.current_occupation || '',
      associatesNoted: r.associates_noted || '',
      geo_lat: r.geo_lat ? Number(r.geo_lat) : null,
      geo_lng: r.geo_lng ? Number(r.geo_lng) : null,
      notes: r.notes || '',
      createdAt: r.created_at
    }));

    res.json(successResponse(data));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch surveillance records' });
  }
};

// POST /api/surveillance
export const createSurveillanceRecord = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const userId = user.userId ? BigInt(user.userId) : null;
    const { offenderId, scheduledDate, status, currentAddress, currentOccupation, associatesNoted, geo_lat, geo_lng, notes } = req.body;

    if (!offenderId) {
      return res.status(400).json({ message: 'Offender ID is required' });
    }

    const record = await prisma.surveillance_records.create({
      data: {
        offender_id: BigInt(offenderId),
        scheduled_date: scheduledDate ? new Date(scheduledDate) : null,
        verification_status: status || 'PENDING',
        current_address: currentAddress || null,
        current_occupation: currentOccupation || null,
        associates_noted: associatesNoted || null,
        geo_lat: geo_lat ? parseFloat(String(geo_lat)) : null,
        geo_lng: geo_lng ? parseFloat(String(geo_lng)) : null,
        notes: notes || null,
        verified_by: userId
      }
    });

    await logAudit('CREATE', 'SURVEILLANCE_RECORD', record.id, req, `Created surveillance record for offender #${offenderId}`);

    res.status(201).json(successResponse({ id: record.id.toString() }, 'Surveillance record logged successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to log surveillance record' });
  }
};

// PUT /api/surveillance/:id
export const updateSurveillanceRecord = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const userId = user.userId ? BigInt(user.userId) : null;
    const recordId = BigInt(req.params.id as string);
    const { status, currentAddress, currentOccupation, associatesNoted, geo_lat, geo_lng, notes } = req.body;

    const existing = await prisma.surveillance_records.findUnique({
      where: { id: recordId }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Surveillance record not found' });
    }

    const updateData: any = {
      verification_status: status || undefined,
      current_address: currentAddress !== undefined ? currentAddress : undefined,
      current_occupation: currentOccupation !== undefined ? currentOccupation : undefined,
      associates_noted: associatesNoted !== undefined ? associatesNoted : undefined,
      geo_lat: geo_lat ? parseFloat(String(geo_lat)) : undefined,
      geo_lng: geo_lng ? parseFloat(String(geo_lng)) : undefined,
      notes: notes !== undefined ? notes : undefined,
    };
    if (userId !== null) {
      updateData.verified_by = userId;
    }

    const updated = await prisma.surveillance_records.update({
      where: { id: recordId },
      data: updateData
    });

    await logAudit('UPDATE', 'SURVEILLANCE_RECORD', recordId, req, `Updated surveillance record status to ${status || existing.verification_status}`);

    res.json(successResponse({ id: updated.id.toString() }, 'Surveillance record updated successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update surveillance record' });
  }
};

// GET /api/surveillance/offender/:offenderId
export const getOffenderSurveillanceHistory = async (req: Request, res: Response) => {
  try {
    const offenderId = BigInt(req.params.offenderId as string);

    const records = await prisma.surveillance_records.findMany({
      where: { offender_id: offenderId },
      include: {
        users: {
          select: { id: true, full_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const data = records.map((r) => ({
      id: r.id.toString(),
      offenderId: r.offender_id.toString(),
      scheduledDate: r.scheduled_date,
      verifiedBy: r.verified_by?.toString() || null,
      verifiedByName: r.users?.full_name || '—',
      verificationStatus: r.verification_status,
      currentAddress: r.current_address || '',
      currentOccupation: r.current_occupation || '',
      associatesNoted: r.associates_noted || '',
      geo_lat: r.geo_lat ? Number(r.geo_lat) : null,
      geo_lng: r.geo_lng ? Number(r.geo_lng) : null,
      notes: r.notes || '',
      createdAt: r.created_at
    }));

    res.json(successResponse(data));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch offender surveillance history' });
  }
};
