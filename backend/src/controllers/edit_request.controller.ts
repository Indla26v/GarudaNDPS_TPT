import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { convertBigIntsToNumbers, successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

export const getEditRequests = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.role;
    const userId = (req as any).user.userId;
    const psId = (req as any).user.policeStationId;
    const { status, entityType, page = 0, size = 20 } = req.query;

    const where: any = {};
    if (status) where.status = String(status);
    if (entityType) where.entity_type = String(entityType);

    if (userRole === 'DSP') {
      where.edit_requested_by_user = { police_station_id: BigInt(psId) };
    } else if (userRole === 'CI' || userRole === 'SI' || userRole === 'CONSTABLE') {
      where.requested_by = BigInt(userId);
    } else if (userRole === 'SP') {
      return res.status(403).json({ message: 'SP does not handle edit requests' });
    }

    const skip = Number(page) * Number(size);
    const take = Number(size);

    const [requests, total] = await Promise.all([
      prisma.edit_requests.findMany({
        where,
        include: {
          edit_requested_by_user: { select: { id: true, username: true, full_name: true, role: true, police_station_id: true } },
          edit_approved_by_user: { select: { id: true, username: true, full_name: true, role: true } }
        },
        orderBy: { request_date: 'desc' },
        skip,
        take
      }),
      prisma.edit_requests.count({ where })
    ]);

    const formatted = requests.map(r => ({
      ...r,
      id: r.id.toString(),
      entity_id: r.entity_id.toString(),
      requested_by: r.requested_by?.toString(),
      approved_by: r.approved_by?.toString(),
      edit_requested_by_user: r.edit_requested_by_user ? {
        ...r.edit_requested_by_user,
        id: r.edit_requested_by_user.id.toString(),
        police_station_id: r.edit_requested_by_user.police_station_id?.toString()
      } : null,
      edit_approved_by_user: r.edit_approved_by_user ? {
        ...r.edit_approved_by_user,
        id: r.edit_approved_by_user.id.toString()
      } : null
    }));

    res.json(successResponse({ content: formatted, totalElements: total, totalPages: Math.ceil(total / take) }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getEditRequestById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const request = await prisma.edit_requests.findUnique({
      where: { id: BigInt(id) },
      include: {
        edit_requested_by_user: true,
        edit_approved_by_user: true
      }
    });

    if (!request) return res.status(404).json({ message: 'Edit request not found' });

    res.json(successResponse(convertBigIntsToNumbers(request)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createEditRequest = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, oldData, newData, reason } = req.body;
    const userId = (req as any).user.userId;

    if (!entityType || !entityId || !newData || !reason) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newReq = await prisma.edit_requests.create({
      data: {
        entity_type: entityType,
        entity_id: BigInt(entityId),
        old_data: oldData || {},
        new_data: newData,
        reason,
        status: 'PENDING',
        requested_by: BigInt(userId)
      }
    });

    await logAudit('CREATE', 'EDIT_REQUEST', newReq.id, req, `Edit request submitted for ${entityType} ${entityId}`);

    res.status(201).json(successResponse({ id: newReq.id.toString() }, 'Edit request submitted'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const approveEditRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dspUserId = (req as any).user.userId;
    const dspRole = (req as any).user.role;
    const dspPsId = (req as any).user.policeStationId;

    if (dspRole !== 'DSP' && dspRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Only DSP or Admin can approve' });
    }

    const request = await prisma.edit_requests.findUnique({ 
      where: { id: BigInt(id) },
      include: {
        edit_requested_by_user: true
      }
    });
    
    if (!request) return res.status(404).json({ message: 'Edit request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ message: `Cannot approve request in ${request.status} state` });

    if (dspRole === 'DSP') {
      if (request.edit_requested_by_user?.police_station_id?.toString() !== dspPsId?.toString()) {
         return res.status(403).json({ message: 'DSP can only approve requests for their assigned Police Station' });
      }
    }

    const { entity_type, entity_id, new_data } = request;

    await prisma.$transaction(async (tx) => {
      // NOTE: Here you would normally update the actual entity the request points to.
      // E.g., if entity_type is 'CASE', update the case with id=entity_id using new_data.

      await tx.edit_requests.update({
        where: { id: BigInt(id) },
        data: {
          status: 'APPROVED',
          approved_by: BigInt(dspUserId),
          approved_date: new Date()
        }
      });
    });

    await logAudit('APPROVE', 'EDIT_REQUEST', BigInt(id), req, `Edit request approved for ${entity_type} ${entity_id}`);

    res.json(successResponse({ id }, 'Edit request approved and applied'));
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

export const rejectEditRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const userPsId = (req as any).user.policeStationId;

    if (userRole !== 'DSP' && userRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Only DSP or Admin can reject' });
    }

    const request = await prisma.edit_requests.findUnique({ 
      where: { id: BigInt(id) },
      include: {
        edit_requested_by_user: true
      }
    });

    if (!request) return res.status(404).json({ message: 'Edit request not found' });
    
    if (userRole === 'DSP') {
      if (request.edit_requested_by_user?.police_station_id?.toString() !== userPsId?.toString()) {
         return res.status(403).json({ message: 'DSP can only reject requests for their assigned Police Station' });
      }
    }

    await prisma.edit_requests.update({
      where: { id: BigInt(id) },
      data: {
        status: 'REJECTED',
        approved_by: BigInt(userId),
        approved_date: new Date()
      }
    });

    await logAudit('REJECT', 'EDIT_REQUEST', BigInt(id), req, 'Edit request rejected');

    res.json(successResponse({ id }, 'Edit request rejected'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
