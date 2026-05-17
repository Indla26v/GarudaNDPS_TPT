/**
 * GARUDA — Deletion Approval Chain Controller
 * 
 * Implements the 5-step deletion escalation path:
 *   CONSTABLE flags → SI/CI escalates → DSP requests → SP approves → ADMIN executes
 * 
 * Statuses: FLAGGED → ESCALATED → REQUESTED → APPROVED → DELETED
 * With REJECTED as a terminal state from any step.
 */
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';
import { hasPermission } from '../config/roles';

// ── List deletion requests (filtered by role/status) ──────────────────
export const getDeletionRequests = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, page = 0, size = 20 } = req.query;

    const where: any = {};
    if (status) where.status = String(status);

    // Scope by role: non-admin/SP see only their PS-related requests
    if (!['ADMIN', 'SP'].includes(user.role)) {
      // Get the user's PS
      const dbUser = await prisma.users.findUnique({ where: { id: user.userId } });
      if (dbUser?.police_station_id) {
        // Show requests flagged by users in the same PS
        const psUsers = await prisma.users.findMany({
          where: { police_station_id: dbUser.police_station_id },
          select: { id: true }
        });
        where.flagged_by = { in: psUsers.map(u => u.id) };
      }
    }

    const skip = Number(page) * Number(size);
    const take = Number(size);

    const [requests, total] = await Promise.all([
      prisma.deletion_requests.findMany({
        where,
        include: {
          flagged_user:   { select: { id: true, full_name: true, role: true } },
          escalated_user: { select: { id: true, full_name: true, role: true } },
          requested_user: { select: { id: true, full_name: true, role: true } },
          approved_user:  { select: { id: true, full_name: true, role: true } },
          deleted_user:   { select: { id: true, full_name: true, role: true } },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.deletion_requests.count({ where }),
    ]);

    const formatted = requests.map(r => ({
      id: r.id.toString(),
      entityType: r.entity_type,
      entityId: r.entity_id.toString(),
      reason: r.reason,
      status: r.status,
      rejectionReason: r.rejection_reason,
      flaggedBy: r.flagged_user ? { id: r.flagged_user.id.toString(), name: r.flagged_user.full_name, role: r.flagged_user.role } : null,
      flaggedAt: r.flagged_at,
      escalatedBy: r.escalated_user ? { id: r.escalated_user.id.toString(), name: r.escalated_user.full_name, role: r.escalated_user.role } : null,
      escalatedAt: r.escalated_at,
      requestedBy: r.requested_user ? { id: r.requested_user.id.toString(), name: r.requested_user.full_name, role: r.requested_user.role } : null,
      requestedAt: r.requested_at,
      approvedBy: r.approved_user ? { id: r.approved_user.id.toString(), name: r.approved_user.full_name, role: r.approved_user.role } : null,
      approvedAt: r.approved_at,
      deletedBy: r.deleted_user ? { id: r.deleted_user.id.toString(), name: r.deleted_user.full_name, role: r.deleted_user.role } : null,
      deletedAt: r.deleted_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    res.json(successResponse({ content: formatted, totalElements: total, totalPages: Math.ceil(total / take) }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Step 1: Flag a record for deletion (any role) ─────────────────────
export const flagForDeletion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { entityType, entityId, reason } = req.body;

    if (!entityType || !entityId) {
      return res.status(400).json({ message: 'entityType and entityId are required' });
    }

    const request = await prisma.deletion_requests.create({
      data: {
        entity_type: entityType,
        entity_id: BigInt(entityId),
        reason: reason || null,
        status: 'FLAGGED',
        flagged_by: BigInt(user.userId),
        flagged_at: new Date(),
      }
    });

    await logAudit('DELETION_FLAGGED', entityType, entityId, req,
      `Deletion flagged for ${entityType}#${entityId} by ${user.username}`);

    res.status(201).json(successResponse(
      { id: request.id.toString(), status: 'FLAGGED' },
      'Record flagged for deletion'
    ));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Step 2: Escalate the flag (SI / CI) ───────────────────────────────
export const escalateDeletion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    if (!hasPermission(user.role, 'ESCALATE_DELETION')) {
      return res.status(403).json({ message: 'Only SI/CI can escalate deletion flags' });
    }

    const existing = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'Deletion request not found' });
    if (existing.status !== 'FLAGGED') {
      return res.status(400).json({ message: `Cannot escalate: current status is ${existing.status}` });
    }

    const updated = await prisma.deletion_requests.update({
      where: { id: BigInt(id) },
      data: {
        status: 'ESCALATED',
        escalated_by: BigInt(user.userId),
        escalated_at: new Date(),
        updated_at: new Date(),
      }
    });

    await logAudit('DELETION_ESCALATED', existing.entity_type, existing.entity_id, req,
      `Deletion escalated for ${existing.entity_type}#${existing.entity_id} by ${user.username}`);

    res.json(successResponse({ id: updated.id.toString(), status: 'ESCALATED' }, 'Deletion escalated'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Step 3: DSP officially requests deletion ──────────────────────────
export const requestDeletion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    if (!hasPermission(user.role, 'REQUEST_DELETION')) {
      return res.status(403).json({ message: 'Only DSP can officially request deletion' });
    }

    const existing = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'Deletion request not found' });
    if (existing.status !== 'ESCALATED') {
      return res.status(400).json({ message: `Cannot request: current status is ${existing.status}` });
    }

    const updated = await prisma.deletion_requests.update({
      where: { id: BigInt(id) },
      data: {
        status: 'REQUESTED',
        requested_by: BigInt(user.userId),
        requested_at: new Date(),
        updated_at: new Date(),
      }
    });

    await logAudit('DELETION_REQUESTED', existing.entity_type, existing.entity_id, req,
      `Deletion officially requested for ${existing.entity_type}#${existing.entity_id} by DSP ${user.username}`);

    res.json(successResponse({ id: updated.id.toString(), status: 'REQUESTED' }, 'Deletion requested'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Step 4: SP approves the deletion ──────────────────────────────────
export const approveDeletion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    if (!hasPermission(user.role, 'APPROVE_DELETION')) {
      return res.status(403).json({ message: 'Only SP can approve deletion requests' });
    }

    const existing = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'Deletion request not found' });
    if (existing.status !== 'REQUESTED') {
      return res.status(400).json({ message: `Cannot approve: current status is ${existing.status}` });
    }

    const updated = await prisma.deletion_requests.update({
      where: { id: BigInt(id) },
      data: {
        status: 'APPROVED',
        approved_by: BigInt(user.userId),
        approved_at: new Date(),
        updated_at: new Date(),
      }
    });

    await logAudit('DELETION_APPROVED', existing.entity_type, existing.entity_id, req,
      `Deletion approved for ${existing.entity_type}#${existing.entity_id} by SP ${user.username}`);

    res.json(successResponse({ id: updated.id.toString(), status: 'APPROVED' }, 'Deletion approved'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Step 5: Admin executes the final deletion ─────────────────────────
export const executeDeletion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    if (!hasPermission(user.role, 'EXECUTE_DELETION')) {
      return res.status(403).json({ message: 'Only Admin can execute final deletion' });
    }

    const existing = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'Deletion request not found' });
    if (existing.status !== 'APPROVED') {
      return res.status(400).json({ message: `Cannot execute: current status is ${existing.status}` });
    }

    // Actually delete the target entity
    await performEntityDeletion(existing.entity_type, existing.entity_id);

    const updated = await prisma.deletion_requests.update({
      where: { id: BigInt(id) },
      data: {
        status: 'DELETED',
        deleted_by: BigInt(user.userId),
        deleted_at: new Date(),
        updated_at: new Date(),
      }
    });

    await logAudit('DELETION_EXECUTED', existing.entity_type, existing.entity_id, req,
      `${existing.entity_type}#${existing.entity_id} permanently deleted by Admin ${user.username}`);

    res.json(successResponse({ id: updated.id.toString(), status: 'DELETED' }, 'Record permanently deleted'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Reject a deletion request (at any step by authorized role) ────────
export const rejectDeletion = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    const existing = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'Deletion request not found' });
    if (['DELETED', 'REJECTED'].includes(existing.status)) {
      return res.status(400).json({ message: `Cannot reject: current status is ${existing.status}` });
    }

    const updated = await prisma.deletion_requests.update({
      where: { id: BigInt(id) },
      data: {
        status: 'REJECTED',
        rejection_reason: rejectionReason || 'No reason provided',
        updated_at: new Date(),
      }
    });

    await logAudit('DELETION_REJECTED', existing.entity_type, existing.entity_id, req,
      `Deletion rejected for ${existing.entity_type}#${existing.entity_id} by ${user.username}: ${rejectionReason}`);

    res.json(successResponse({ id: updated.id.toString(), status: 'REJECTED' }, 'Deletion request rejected'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Helper: actually delete the entity from DB ───────────────────────
async function performEntityDeletion(entityType: string, entityId: bigint) {
  switch (entityType.toUpperCase()) {
    case 'OFFENDER':
      await prisma.offenders.delete({ where: { id: entityId } });
      break;
    case 'CASE':
      await prisma.cases.delete({ where: { id: entityId } });
      break;
    case 'INTELLIGENCE':
      await prisma.intelligence_inputs.delete({ where: { id: entityId } });
      break;
    default:
      throw new Error(`Unknown entity type for deletion: ${entityType}`);
  }
}
