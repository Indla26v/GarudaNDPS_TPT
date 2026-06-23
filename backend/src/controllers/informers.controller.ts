import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { getDashboardScope, ScopeUser } from '../utils/scope';
import { logAudit } from '../utils/auditLogger';

// Helper: build scoping where clause for informers based on creator's police station
async function getInformerWhere(user: ScopeUser): Promise<Record<string, any>> {
  const { psFilter } = getDashboardScope(user);
  
  if (psFilter.ps_id) {
    // Return informers created by users in the same police station
    const userIds = await prisma.users.findMany({
      where: { police_station_id: psFilter.ps_id },
      select: { id: true }
    });
    return { created_by: { in: userIds.map(u => u.id) } };
  } else if (psFilter.police_stations) {
    const stations = await prisma.police_stations.findMany({
      where: psFilter.police_stations,
      select: { id: true }
    });
    const userIds = await prisma.users.findMany({
      where: {
        OR: [
          { police_station_id: { in: stations.map(s => s.id) } },
          { police_station_id: null }
        ]
      },
      select: { id: true }
    });
    return { created_by: { in: userIds.map(u => u.id) } };
  }
  return {};
}

// GET /api/informers
export const listInformers = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const baseWhere = await getInformerWhere(user);

    const informersList = await prisma.informers.findMany({
      where: baseWhere,
      include: {
        users: {
          select: { id: true, full_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const data = informersList.map((inf) => ({
      id: inf.id.toString(),
      codeName: inf.code_name,
      phone: inf.phone || '',
      rating: inf.rating || 'C',
      status: inf.status,
      createdByName: inf.users?.full_name || '—',
      createdAt: inf.created_at
    }));

    res.json(successResponse(data));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch informers list' });
  }
};

// POST /api/informers
export const registerInformer = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const userId = user.userId ? BigInt(user.userId) : null;
    const { codeName, phone, rating } = req.body;

    if (!codeName) {
      return res.status(400).json({ message: 'Code name is required' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if codeName is unique
    const existing = await prisma.informers.findUnique({
      where: { code_name: codeName }
    });

    if (existing) {
      return res.status(400).json({ message: 'Informer with this code name already exists' });
    }

    const informer = await prisma.informers.create({
      data: {
        code_name: codeName,
        phone: phone || null,
        rating: rating || 'C',
        status: 'ACTIVE',
        created_by: userId
      }
    });

    await logAudit('CREATE', 'INFORMER', informer.id, req, `Registered informer with code name ${codeName}`);

    res.status(201).json(successResponse({ id: informer.id.toString() }, 'Informer registered successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to register informer' });
  }
};

// PUT /api/informers/:id
export const updateInformer = async (req: Request, res: Response) => {
  try {
    const informerId = BigInt(req.params.id as string);
    const { rating, status, phone } = req.body;

    const existing = await prisma.informers.findUnique({
      where: { id: informerId }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Informer not found' });
    }

    const updated = await prisma.informers.update({
      where: { id: informerId },
      data: {
        rating: rating || undefined,
        status: status || undefined,
        phone: phone !== undefined ? phone : undefined
      }
    });

    await logAudit('UPDATE', 'INFORMER', informerId, req, `Updated informer ${existing.code_name}`);

    res.json(successResponse({ id: updated.id.toString() }, 'Informer profile updated successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update informer profile' });
  }
};
