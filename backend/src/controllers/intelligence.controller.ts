import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { getDashboardScope, ScopeUser } from '../utils/scope';
import { logAudit } from '../utils/auditLogger';

export const getIntelligence = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);

    let whereClause: any = {};
    if (psFilter.ps_id) {
      whereClause.ps_id = psFilter.ps_id;
    } else if (psFilter.police_stations) {
      const psIds = await prisma.police_stations.findMany({
        where: psFilter.police_stations,
        select: { id: true }
      });
      whereClause.ps_id = { in: psIds.map(ps => ps.id) };
    }

    const intelList = await prisma.intelligence_inputs.findMany({
      where: whereClause,
      include: {
        offenders: {
          select: { id: true, full_name: true }
        },
        informers: {
          select: { id: true, code_name: true }
        },
        police_stations: {
          select: { id: true, name: true }
        },
        users: {
          select: { id: true, full_name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    const data = intelList.map((intel) => ({
      id: intel.id.toString(),
      offenderId: intel.offender_id?.toString() || null,
      offenderName: intel.offenders?.full_name || '—',
      informerId: intel.informer_id?.toString() || null,
      informerCodeName: intel.informers?.code_name || '—',
      psId: intel.ps_id.toString(),
      psName: intel.police_stations?.name || '—',
      sourceType: intel.source_type,
      inputText: intel.input_text || '',
      supplyRoute: intel.supply_route || '',
      createdByName: intel.users?.full_name || '—',
      createdAt: intel.created_at
    }));

    res.json(successResponse(data));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch intelligence inputs' });
  }
};

export const createIntelligence = async (req: Request, res: Response) => {
  try {
    const user: ScopeUser = (req as any).user || {};
    const userId = user.userId ? BigInt(user.userId) : null;
    const { offenderId, psId, sourceType, inputText, supplyRoute, informerId } = req.body;

    if (!psId || !sourceType) {
      return res.status(400).json({ message: 'Police Station and Source Type are required' });
    }

    const newIntel = await prisma.intelligence_inputs.create({
      data: {
        offender_id: offenderId ? BigInt(offenderId) : null,
        informer_id: informerId ? BigInt(informerId) : null,
        ps_id: BigInt(psId),
        source_type: sourceType,
        input_text: inputText || null,
        supply_route: supplyRoute || null,
        created_by: userId
      }
    });

    await logAudit('CREATE', 'INTELLIGENCE_INPUT', newIntel.id, req, `New intelligence input created for station #${psId}`);

    res.status(201).json(successResponse({ id: newIntel.id.toString() }, 'Intelligence input recorded successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to record intelligence input' });
  }
};

export const getNetworkGraph = async (req: Request, res: Response) => {
  try {
    const serviceUrl = process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:8082';
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const psId = psFilter?.ps_id ? psFilter.ps_id.toString() : '';

    const url = new URL(`${serviceUrl}/analytics/network-graph`);
    if (psId) {
      url.searchParams.append('ps_id', psId);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Microservice responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(successResponse(data));
  } catch (error: any) {
    console.error('[NetworkGraph Controller Error]', error);
    res.status(500).json({ message: 'Failed to fetch network graph analytics: ' + error.message });
  }
};

export const getDuplicateContacts = async (req: Request, res: Response) => {
  try {
    const serviceUrl = process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:8082';
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const psId = psFilter?.ps_id ? psFilter.ps_id.toString() : '';

    const url = new URL(`${serviceUrl}/analytics/duplicate-contacts`);
    if (psId) {
      url.searchParams.append('ps_id', psId);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Microservice responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(successResponse(data));
  } catch (error: any) {
    console.error('[DuplicateContacts Controller Error]', error);
    res.status(500).json({ message: 'Failed to fetch contact correlation analytics: ' + error.message });
  }
};

export const predictRisk = async (req: Request, res: Response) => {
  try {
    const serviceUrl = process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:8082';
    const response = await fetch(`${serviceUrl}/analytics/predict-risk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      throw new Error(`Microservice responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(successResponse(data));
  } catch (error: any) {
    console.error('[PredictRisk Controller Error]', error);
    res.status(500).json({ message: 'Failed to run risk prediction: ' + error.message });
  }
};

export const getInterstateRoutes = async (req: Request, res: Response) => {
  try {
    const serviceUrl = process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:8082';
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const psId = psFilter?.ps_id ? psFilter.ps_id.toString() : '';

    const url = new URL(`${serviceUrl}/analytics/interstate-routes`);
    if (psId) {
      url.searchParams.append('ps_id', psId);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Microservice responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(successResponse(data));
  } catch (error: any) {
    console.error('[InterstateRoutes Controller Error]', error);
    res.status(500).json({ message: 'Failed to fetch interstate routes: ' + error.message });
  }
};

export const getConsignmentTrails = async (req: Request, res: Response) => {
  try {
    const serviceUrl = process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:8082';
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const psId = psFilter?.ps_id ? psFilter.ps_id.toString() : '';

    const url = new URL(`${serviceUrl}/analytics/consignment-trails`);
    if (psId) {
      url.searchParams.append('ps_id', psId);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Microservice responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(successResponse(data));
  } catch (error: any) {
    console.error('[ConsignmentTrails Controller Error]', error);
    res.status(500).json({ message: 'Failed to fetch consignment trails: ' + error.message });
  }
};

export const getCaseLinkages = async (req: Request, res: Response) => {
  try {
    const serviceUrl = process.env.INTELLIGENCE_SERVICE_URL || 'http://localhost:8082';
    const user: ScopeUser = (req as any).user || {};
    const { psFilter } = getDashboardScope(user);
    const psId = psFilter?.ps_id ? psFilter.ps_id.toString() : '';

    const url = new URL(`${serviceUrl}/analytics/case-linkage`);
    if (psId) {
      url.searchParams.append('ps_id', psId);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Microservice responded with status: ${response.status}`);
    }

    const data = await response.json();
    res.json(successResponse(data));
  } catch (error: any) {
    console.error('[CaseLinkage Controller Error]', error);
    res.status(500).json({ message: 'Failed to fetch case linkage index: ' + error.message });
  }
};
