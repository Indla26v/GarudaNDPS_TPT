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
  // ── SECURITY FIX #11: Mitigate insecure deserialization
  // Ensure we only parse JSON, and strictly allowlist fields to prevent prototype pollution or arbitrary field injection.
  let changes: any;
  try {
    changes = JSON.parse(changesJson);
  } catch (err) {
    throw new Error('Invalid changes JSON');
  }

  if (typeof changes !== 'object' || changes === null || Array.isArray(changes)) {
    throw new Error('Changes must be an object');
  }

  if (entityType === 'CASE') {
    const data: Record<string, unknown> = {};
    if (typeof changes.firNo === 'string') data.fir_no = changes.firNo;
    else if (typeof changes.fir_no === 'string') data.fir_no = changes.fir_no;
    
    if (changes.psId) data.ps_id = BigInt(changes.psId);
    else if (changes.ps_id) data.ps_id = BigInt(changes.ps_id);
    
    if (typeof changes.sectionOfLaw === 'string') data.section_of_law = changes.sectionOfLaw;
    else if (typeof changes.section_of_law === 'string') data.section_of_law = changes.section_of_law;
    
    if (typeof changes.caseDate === 'string' || typeof changes.caseDate === 'number') data.case_date = new Date(changes.caseDate);
    else if (typeof changes.case_date === 'string' || typeof changes.case_date === 'number') data.case_date = new Date(changes.case_date);
    
    if (typeof changes.stage === 'string') data.stage = changes.stage;

    if (Object.keys(data).length > 0) {
      await prisma.cases.update({ where: { id: entityId }, data: data as any });
    }
  } else if (entityType === 'OFFENDER') {
    const data: Record<string, unknown> = {};
    if (typeof changes.fullName === 'string') data.full_name = changes.fullName;
    else if (typeof changes.full_name === 'string') data.full_name = changes.full_name;
    
    if (typeof changes.alias === 'string') data.alias = changes.alias;
    if (typeof changes.category === 'string') data.category = changes.category;
    if (typeof changes.status === 'string') data.status = changes.status;

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
      where: { id: BigInt(id as string) },
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

    if (!['SDPO', 'SP', 'SHO'].includes(approverRole)) {
      return res.status(403).json({ message: 'Only SDPO, SHO, or SP can approve' });
    }

    const request = await prisma.edit_requests.findUnique({
      where: { id: BigInt(id as string) },
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
        where: { id: BigInt(id as string) },
        data: {
          status: 'APPROVED',
          approved_by: BigInt(approverId),
          approved_at: new Date(),
        },
      });
    });

    await logAudit('EDIT_APPROVED', 'EDIT_REQUEST', BigInt(id as string), req, `Approved ${request.entity_type} ${request.entity_id}`);

    res.json(successResponse({ id }, 'Edit request approved and applied'));
  } catch (error: any) {
    // ── SECURITY FIX #20: Do not leak internal error messages
    console.error('approveEditRequest error:', error);
    res.status(500).json({ message: 'Failed to process edit request' });
  }
};

export const rejectEditRequest = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;
    const userPsId = (req as any).user.policeStationId;
    const { rejectionReason } = req.body;

    if (!['SDPO', 'SP', 'SHO'].includes(userRole)) {
      return res.status(403).json({ message: 'Only SDPO, SHO, or SP can reject' });
    }

    const request = await prisma.edit_requests.findUnique({
      where: { id: BigInt(id as string) },
      include: { requested_user: true },
    });

    if (!request) return res.status(404).json({ message: 'Edit request not found' });

    if (userRole === 'DSP' && userPsId) {
      if (request.requested_user?.police_station_id?.toString() !== userPsId?.toString()) {
        return res.status(403).json({ message: 'DSP can only reject requests for their police station' });
      }
    }

    await prisma.edit_requests.update({
      where: { id: BigInt(id as string) },
      data: {
        status: 'REJECTED',
        approved_by: BigInt(userId),
        approved_at: new Date(),
        rejection_reason: rejectionReason || 'Rejected',
      },
    });

    await logAudit('EDIT_REJECTED', 'EDIT_REQUEST', BigInt(id as string), req, 'Edit request rejected');

    res.json(successResponse({ id }, 'Edit request rejected'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
