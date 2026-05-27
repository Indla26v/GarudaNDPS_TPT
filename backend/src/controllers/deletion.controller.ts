import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

export const getDeletionRequests = async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.role;
    const psId = (req as any).user.policeStationId;
    
    // We only show relevant requests to the role
    const where: any = {};
    if (userRole === 'DSP') {
      where.status = 'ESCALATED';
      // Join to get those matching their PS
    } else if (userRole === 'SP') {
      where.status = 'REQUESTED';
    } else if (userRole === 'ADMIN') {
      where.status = 'APPROVED';
    } else {
      where.status = 'FLAGGED';
    }

    const requests = await prisma.deletion_requests.findMany({
      where,
      include: {
        flagged_user: { select: { id: true, username: true, role: true, police_stations: true } }
      },
      orderBy: { flagged_at: 'desc' }
    });
    
    // Filter manually for DSP and SP logic due to complex joins in schema limits 
    let filteredRequests = requests;
    if (userRole === 'DSP' && psId) {
       filteredRequests = requests.filter(r => r.flagged_user?.police_stations?.id.toString() === psId.toString());
    } else if (userRole === 'SP') {
      // Find SP's district
      const spUser = await prisma.users.findUnique({ where: { id: BigInt((req as any).user.userId) }, include: { police_stations: true } });
      const spDistrict = spUser?.police_stations?.district;
      filteredRequests = requests.filter(r => r.flagged_user?.police_stations?.district === spDistrict);
    }

    const formatted = filteredRequests.map(r => ({
      id: r.id.toString(),
      entityType: r.entity_type,
      entityId: r.entity_id.toString(),
      reason: r.reason,
      status: r.status,
      flaggedBy: r.flagged_user?.username,
      station: r.flagged_user?.police_stations?.name,
      requestDate: r.flagged_at
    }));

    res.json(successResponse(formatted));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const flagForDeletion = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId, reason } = req.body;
    const userId = (req as any).user.userId;

    const request = await prisma.deletion_requests.create({
      data: {
        entity_type: entityType,
        entity_id: BigInt(entityId),
        reason,
        status: 'FLAGGED',
        flagged_by: BigInt(userId),
      }
    });

    await logAudit('FLAG', 'DELETION_REQUEST', request.id, req, `Deletion flagged for ${entityType} ${entityId}`);
    res.status(201).json(successResponse({ id: request.id.toString() }, 'Flagged for deletion'));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const escalateDeletion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    if (userRole !== 'CI' && userRole !== 'SI') return res.status(403).json({ message: 'Only CI/SI can escalate' });

    const request = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id as string) } });
    if (!request || request.status !== 'FLAGGED') return res.status(400).json({ message: 'Invalid state' });

    await prisma.deletion_requests.update({
      where: { id: BigInt(id as string) },
      data: { status: 'ESCALATED', escalated_by: BigInt(userId) }
    });

    res.json(successResponse({ id }, 'Escalated to DSP'));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const requestDeletion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    if (userRole !== 'DSP') return res.status(403).json({ message: 'Only DSP can request formally' });

    const request = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id as string) } });
    if (!request || request.status !== 'ESCALATED') return res.status(400).json({ message: 'Invalid state' });

    await prisma.deletion_requests.update({
      where: { id: BigInt(id as string) },
      data: { status: 'REQUESTED', requested_by: BigInt(userId) }
    });

    res.json(successResponse({ id }, 'Requested from SP'));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const approveDeletion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    if (userRole !== 'SP') return res.status(403).json({ message: 'Only SP can approve' });

    const request = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id as string) } });
    if (!request || request.status !== 'REQUESTED') return res.status(400).json({ message: 'Invalid state' });

    await prisma.deletion_requests.update({
      where: { id: BigInt(id as string) },
      data: { status: 'APPROVED', approved_by: BigInt(userId) }
    });

    res.json(successResponse({ id }, 'Approved for Admin execution'));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};

export const executeDeletion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;
    const userRole = (req as any).user.role;

    if (userRole !== 'ADMIN') return res.status(403).json({ message: 'Only ADMIN can execute' });

    const request = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id as string) } });
    if (!request || request.status !== 'APPROVED') return res.status(400).json({ message: 'Invalid state' });

    await prisma.$transaction(async (tx) => {
      // Actually delete the entity
      if (request.entity_type === 'CASE') {
        await tx.cases.delete({ where: { id: request.entity_id } });
      } else if (request.entity_type === 'OFFENDER') {
        await tx.offenders.delete({ where: { id: request.entity_id } });
      }

      await tx.deletion_requests.update({
        where: { id: BigInt(id as string) },
        data: { status: 'DELETED', deleted_by: BigInt(userId) }
      });
    });

    res.json(successResponse({ id }, 'Deleted successfully'));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
export const rejectDeletion = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const request = await prisma.deletion_requests.findUnique({ where: { id: BigInt(id as string) } });
    if (!request) return res.status(404).json({ message: 'Request not found' });

    await prisma.deletion_requests.update({
      where: { id: BigInt(id as string) },
      data: { status: 'REJECTED' }
    });

    res.json(successResponse({ id }, 'Rejected successfully'));
  } catch (error) { res.status(500).json({ message: 'Server error' }); }
};
