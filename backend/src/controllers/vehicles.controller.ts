import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { getDashboardScope, ScopeUser } from '../utils/scope';

/**
 * GET /api/vehicles — List all seized vehicles with search/filter/pagination
 */
export const getSeizedVehicles = async (req: Request, res: Response) => {
  try {
    const { page = 0, size = 20, search, vehicleType, status } = req.query;
    const skip = Number(page) * Number(size);
    const take = Number(size);

    const user: ScopeUser = (req as any).user || {};
    const { psFilter, isStationLevel } = getDashboardScope(user);

    // Build where clause scoped to user's jurisdiction
    const where: any = {};

    // Scope by police station
    if (psFilter.ps_id) {
      where.cases = { ps_id: psFilter.ps_id };
    } else if (psFilter.police_stations) {
      where.cases = { police_stations: psFilter.police_stations };
    }

    // Search filter
    if (search) {
      const searchStr = String(search);
      where.OR = [
        { registration_no: { contains: searchStr, mode: 'insensitive' } },
        { owner_name: { contains: searchStr, mode: 'insensitive' } },
        { make_model: { contains: searchStr, mode: 'insensitive' } },
        { cases: { fir_no: { contains: searchStr, mode: 'insensitive' } } },
      ];
    }

    // Vehicle type filter
    if (vehicleType && vehicleType !== 'ALL') {
      where.vehicle_type = String(vehicleType);
    }

    // Status filter
    if (status && status !== 'ALL') {
      where.current_status = String(status);
    }

    const [vehicles, total] = await Promise.all([
      prisma.seized_vehicles.findMany({
        where,
        include: {
          cases: {
            select: {
              id: true,
              fir_no: true,
              case_date: true,
              police_stations: { select: { name: true, ps_code: true } },
            },
          },
        },
        skip,
        take,
        orderBy: { created_at: 'desc' },
      }),
      prisma.seized_vehicles.count({ where }),
    ]);

    res.json(successResponse({
      content: vehicles.map(toVehicleResponse),
      totalElements: total,
      totalPages: Math.ceil(total / take),
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/vehicles/:id — Get single vehicle details
 */
export const getSeizedVehicleById = async (req: Request, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    const vehicle = await prisma.seized_vehicles.findUnique({
      where: { id },
      include: {
        cases: {
          select: {
            id: true,
            fir_no: true,
            case_date: true,
            police_stations: { select: { name: true, ps_code: true } },
          },
        },
      },
    });

    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });
    res.json(successResponse(toVehicleResponse(vehicle)));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/vehicles/:id — Update vehicle status/details
 */
export const updateSeizedVehicle = async (req: Request, res: Response) => {
  try {
    const id = BigInt(req.params.id);
    const data = req.body;

    const existing = await prisma.seized_vehicles.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Vehicle not found' });

    const updateData: any = {};
    if (data.currentStatus !== undefined) updateData.current_status = data.currentStatus;
    if (data.courtOrderNo !== undefined) updateData.court_order_no = data.courtOrderNo;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    if (data.ownerName !== undefined) updateData.owner_name = data.ownerName;
    if (data.ownerAddress !== undefined) updateData.owner_address = data.ownerAddress;

    const updated = await prisma.seized_vehicles.update({
      where: { id },
      data: updateData,
      include: {
        cases: {
          select: {
            id: true,
            fir_no: true,
            case_date: true,
            police_stations: { select: { name: true, ps_code: true } },
          },
        },
      },
    });

    res.json(successResponse(toVehicleResponse(updated), 'Vehicle updated'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

function toVehicleResponse(v: any) {
  return {
    id: v.id.toString(),
    caseId: v.case_id.toString(),
    seizureId: v.seizure_id?.toString() || null,
    vehicleType: v.vehicle_type,
    registrationNo: v.registration_no,
    makeModel: v.make_model,
    color: v.color,
    chassisNo: v.chassis_no,
    engineNo: v.engine_no,
    ownerName: v.owner_name,
    ownerAddress: v.owner_address,
    seizureLocation: v.seizure_location,
    seizureDate: v.seizure_date,
    currentStatus: v.current_status,
    courtOrderNo: v.court_order_no,
    remarks: v.remarks,
    createdAt: v.created_at,
    firNo: v.cases?.fir_no,
    caseDate: v.cases?.case_date,
    psName: v.cases?.police_stations?.name,
    psCode: v.cases?.police_stations?.ps_code,
  };
}
