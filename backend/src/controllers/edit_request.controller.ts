import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { convertBigIntsToNumbers, successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

function formatEditRequest(r: any) {
  return {
    id: r.id.toString(),
    entity_type: r.entity_type,
    entity_id: r.entity_id.toString(),
    changes_json: r.changes_json,
    reason: r.reason,
    status: r.status,
    requested_by: r.requested_by.toString(),
    requested_at: r.requested_at,
    approved_by: r.approved_by?.toString() ?? null,
    approved_at: r.approved_at,
    rejection_reason: r.rejection_reason,
    created_at: r.created_at,
    requested_user: r.requested_user
      ? {
          id: r.requested_user.id.toString(),
          username: r.requested_user.username,
          full_name: r.requested_user.full_name,
          role: r.requested_user.role,
          police_station_id: r.requested_user.police_station_id?.toString() ?? null,
        }
      : null,
    approved_user: r.approved_user
      ? {
          id: r.approved_user.id.toString(),
          username: r.approved_user.username,
          full_name: r.approved_user.full_name,
          role: r.approved_user.role,
        }
      : null,
  };
}

async function applyEntityChanges(entityType: string, entityId: bigint, changesJson: string) {
  const changes = JSON.parse(changesJson);

  if (entityType === 'CASE') {
    const data: Record<string, unknown> = {};
    if (changes.firNo !== undefined) data.fir_no = changes.firNo;
    if (changes.fir_no !== undefined) data.fir_no = changes.fir_no;
    if (changes.psId !== undefined) data.ps_id = BigInt(changes.psId);
    if (changes.ps_id !== undefined) data.ps_id = BigInt(changes.ps_id);
    if (changes.sectionOfLaw !== undefined) data.section_of_law = changes.sectionOfLaw;
    if (changes.section_of_law !== undefined) data.section_of_law = changes.section_of_law;
    if (changes.caseDate !== undefined) data.case_date = new Date(changes.caseDate);
    if (changes.case_date !== undefined) data.case_date = new Date(changes.case_date);
    if (changes.stage !== undefined) data.stage = changes.stage;
    if (Object.keys(data).length > 0) {
      await prisma.cases.update({ where: { id: entityId }, data: data as any });
    }
  } else if (entityType === 'OFFENDER') {
    const data: Record<string, unknown> = {};
    if (changes.fullName !== undefined) data.full_name = changes.fullName;
    if (changes.full_name !== undefined) data.full_name = changes.full_name;
    if (changes.alias !== undefined) data.alias = changes.alias;
    if (changes.category !== undefined) data.category = changes.category;
    if (changes.status !== undefined) data.status = changes.status;
    if (Object.keys(data).length > 0) {
      await prisma.offenders.update({ where: { id: entityId }, data: data as any });
    }
  }
}

export const getEditRequests = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.role;
    const userId = (req as any).user.userId;
    const psId = (req as any).user.policeStationId;
    const { status, entityType, page = 0, size = 20 } = req.query;

    const where: any = {};
    if (status) where.status = String(status);
    if (entityType) where.entity_type = String(entityType);

    if (userRole === 'DSP' && psId) {
      where.requested_user = { police_station_id: BigInt(psId) };
    } else if (['CI', 'SI', 'CONSTABLE'].includes(userRole)) {
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
          requested_user: {
            select: { id: true, username: true, full_name: true, role: true, police_station_id: true },
          },
          approved_user: { select: { id: true, username: true, full_name: true, role: true } },
        },
        orderBy: { requested_at: 'desc' },
        skip,
        take,
      }),
      prisma.edit_requests.count({ where }),
    ]);

    res.json(
      successResponse({
        content: requests.map(formatEditRequest),
        totalElements: total,
        totalPages: Math.ceil(total / take),
      })
    );
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
        requested_user: true,
        approved_user: true,
      },
    });

    if (!request) return res.status(404).json({ message: 'Edit request not found' });

    res.json(successResponse(formatEditRequest(request)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const createEditRequest = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, changes, changesJson, reason } = req.body;
    const userId = (req as any).user.userId;

    const payload = changesJson ?? (changes ? JSON.stringify(changes) : null);
    if (!entityType || !entityId || !payload || !reason) {
      return res.status(400).json({ message: 'Missing required fields: entityType, entityId, changes/changesJson, reason' });
    }

    const newReq = await prisma.edit_requests.create({
      data: {
        entity_type: entityType,
        entity_id: BigInt(entityId),
        changes_json: typeof payload === 'string' ? payload : JSON.stringify(payload),
        reason,
        status: 'PENDING',
        requested_by: BigInt(userId),
      },
    });

    await logAudit('EDIT_REQUESTED', 'EDIT_REQUEST', newReq.id, req, `Edit request for ${entityType} ${entityId}`);

    res.status(201).json(successResponse({ id: newReq.id.toString() }, 'Edit request submitted'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const approveEditRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const approverId = (req as any).user.userId;
    const approverRole = (req as any).user.role;
    const approverPsId = (req as any).user.policeStationId;

    if (!['DSP', 'ADMIN', 'CI'].includes(approverRole)) {
      return res.status(403).json({ message: 'Only DSP, CI, or Admin can approve' });
    }

    const request = await prisma.edit_requests.findUnique({
      where: { id: BigInt(id) },
      include: { requested_user: true },
    });

    if (!request) return res.status(404).json({ message: 'Edit request not found' });
    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: `Cannot approve request in ${request.status} state` });
    }

    if (approverRole === 'DSP' && approverPsId) {
      if (request.requested_user?.police_station_id?.toString() !== approverPsId?.toString()) {
        return res.status(403).json({ message: 'DSP can only approve requests for their police station' });
      }
    }

    await prisma.$transaction(async (tx) => {
      await applyEntityChanges(request.entity_type, request.entity_id, request.changes_json);

      await tx.edit_requests.update({
        where: { id: BigInt(id) },
        data: {
          status: 'APPROVED',
          approved_by: BigInt(approverId),
          approved_at: new Date(),
        },
      });
    });

    await logAudit('EDIT_APPROVED', 'EDIT_REQUEST', BigInt(id), req, `Approved ${request.entity_type} ${request.entity_id}`);

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
    const { rejectionReason } = req.body;

    if (!['DSP', 'ADMIN', 'CI'].includes(userRole)) {
      return res.status(403).json({ message: 'Only DSP, CI, or Admin can reject' });
    }

    const request = await prisma.edit_requests.findUnique({
      where: { id: BigInt(id) },
      include: { requested_user: true },
    });

    if (!request) return res.status(404).json({ message: 'Edit request not found' });

    if (userRole === 'DSP' && userPsId) {
      if (request.requested_user?.police_station_id?.toString() !== userPsId?.toString()) {
        return res.status(403).json({ message: 'DSP can only reject requests for their police station' });
      }
    }

    await prisma.edit_requests.update({
      where: { id: BigInt(id) },
      data: {
        status: 'REJECTED',
        approved_by: BigInt(userId),
        approved_at: new Date(),
        rejection_reason: rejectionReason || 'Rejected',
      },
    });

    await logAudit('EDIT_REJECTED', 'EDIT_REQUEST', BigInt(id), req, 'Edit request rejected');

    res.json(successResponse({ id }, 'Edit request rejected'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
