/**
 * GARUDA — Edit Request Controller
 * 
 * CI and SI can request edits (routed to DSP for approval).
 * DSP uniquely approves intra-PS edits.
 */
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';
import { hasPermission } from '../config/roles';

// ── List edit requests ────────────────────────────────────────────────
export const getEditRequests = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, page = 0, size = 20 } = req.query;

    const where: any = {};
    if (status) where.status = String(status);

    // DSP sees all requests for their PS; CI/SI see only their own
    if (user.role === 'DSP') {
      const dbUser = await prisma.users.findUnique({ where: { id: user.userId } });
      if (dbUser?.police_station_id) {
        const psUsers = await prisma.users.findMany({
          where: { police_station_id: dbUser.police_station_id },
          select: { id: true }
        });
        where.requested_by = { in: psUsers.map(u => u.id) };
      }
    } else if (!['ADMIN'].includes(user.role)) {
      where.requested_by = BigInt(user.userId);
    }

    const skip = Number(page) * Number(size);
    const take = Number(size);

    const [requests, total] = await Promise.all([
      prisma.edit_requests.findMany({
        where,
        include: {
          requested_user: { select: { id: true, full_name: true, role: true } },
          approved_user:  { select: { id: true, full_name: true, role: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.edit_requests.count({ where }),
    ]);

    const formatted = requests.map(r => ({
      id: r.id.toString(),
      entityType: r.entity_type,
      entityId: r.entity_id.toString(),
      changesJson: r.changes_json,
      reason: r.reason,
      status: r.status,
      rejectionReason: r.rejection_reason,
      requestedBy: r.requested_user ? { id: r.requested_user.id.toString(), name: r.requested_user.full_name, role: r.requested_user.role } : null,
      requestedAt: r.requested_at,
      approvedBy: r.approved_user ? { id: r.approved_user.id.toString(), name: r.approved_user.full_name, role: r.approved_user.role } : null,
      approvedAt: r.approved_at,
      createdAt: r.created_at,
    }));

    res.json(successResponse({ content: formatted, totalElements: total, totalPages: Math.ceil(total / take) }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Create an edit request (CI / SI) ──────────────────────────────────
export const createEditRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { entityType, entityId, changes, reason } = req.body;

    if (!hasPermission(user.role, 'REQUEST_EDIT')) {
      return res.status(403).json({ message: 'Only CI/SI can request edits' });
    }

    if (!entityType || !entityId || !changes) {
      return res.status(400).json({ message: 'entityType, entityId, and changes are required' });
    }

    const request = await prisma.edit_requests.create({
      data: {
        entity_type: entityType,
        entity_id: BigInt(entityId),
        changes_json: typeof changes === 'string' ? changes : JSON.stringify(changes),
        reason: reason || null,
        status: 'PENDING',
        requested_by: BigInt(user.userId),
        requested_at: new Date(),
      }
    });

    await logAudit('EDIT_REQUESTED', entityType, entityId, req,
      `Edit requested for ${entityType}#${entityId} by ${user.role} ${user.username}`);

    res.status(201).json(successResponse(
      { id: request.id.toString(), status: 'PENDING' },
      'Edit request submitted for DSP approval'
    ));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Approve an edit request (DSP only) ────────────────────────────────
export const approveEditRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    if (!hasPermission(user.role, 'APPROVE_EDIT')) {
      return res.status(403).json({ message: 'Only DSP can approve edit requests' });
    }

    const existing = await prisma.edit_requests.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'Edit request not found' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ message: `Cannot approve: current status is ${existing.status}` });
    }

    // Apply the changes
    const changes = JSON.parse(existing.changes_json);
    await applyEditChanges(existing.entity_type, existing.entity_id, changes);

    const updated = await prisma.edit_requests.update({
      where: { id: BigInt(id) },
      data: {
        status: 'APPROVED',
        approved_by: BigInt(user.userId),
        approved_at: new Date(),
        updated_at: new Date(),
      }
    });

    await logAudit('EDIT_APPROVED', existing.entity_type, existing.entity_id, req,
      `Edit approved for ${existing.entity_type}#${existing.entity_id} by DSP ${user.username}`);

    res.json(successResponse({ id: updated.id.toString(), status: 'APPROVED' }, 'Edit approved and applied'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Reject an edit request (DSP only) ─────────────────────────────────
export const rejectEditRequest = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!hasPermission(user.role, 'APPROVE_EDIT')) {
      return res.status(403).json({ message: 'Only DSP can reject edit requests' });
    }

    const existing = await prisma.edit_requests.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'Edit request not found' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ message: `Cannot reject: current status is ${existing.status}` });
    }

    const updated = await prisma.edit_requests.update({
      where: { id: BigInt(id) },
      data: {
        status: 'REJECTED',
        rejection_reason: rejectionReason || 'No reason provided',
        updated_at: new Date(),
      }
    });

    await logAudit('EDIT_REJECTED', existing.entity_type, existing.entity_id, req,
      `Edit rejected for ${existing.entity_type}#${existing.entity_id} by DSP ${user.username}: ${rejectionReason}`);

    res.json(successResponse({ id: updated.id.toString(), status: 'REJECTED' }, 'Edit request rejected'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Helper: apply edit changes to the entity ──────────────────────────
async function applyEditChanges(entityType: string, entityId: bigint, changes: any) {
  switch (entityType.toUpperCase()) {
    case 'OFFENDER':
      await prisma.offenders.update({
        where: { id: entityId },
        data: {
          ...(changes.full_name && { full_name: changes.full_name }),
          ...(changes.alias && { alias: changes.alias }),
          ...(changes.status && { status: changes.status }),
          ...(changes.category && { category: changes.category }),
          ...(changes.risk_score && { risk_score: changes.risk_score }),
          ...(changes.full_address && { full_address: changes.full_address }),
          ...(changes.occupation && { occupation: changes.occupation }),
          updated_at: new Date(),
        }
      });
      break;
    case 'CASE':
      await prisma.cases.update({
        where: { id: entityId },
        data: {
          ...(changes.section_of_law && { section_of_law: changes.section_of_law }),
          ...(changes.stage && { stage: changes.stage }),
          updated_at: new Date(),
        }
      });
      break;
    default:
      throw new Error(`Unsupported entity type for edit: ${entityType}`);
  }
}
