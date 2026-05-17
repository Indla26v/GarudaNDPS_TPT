import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';

export const getAllPoliceStations = async (req: Request, res: Response) => {
  try {
    const stations = await prisma.police_stations.findMany();
    const formatted = stations.map(s => ({
      id: s.id.toString(),
      name: s.name,
      district: s.district,
      state: s.state,
      psCode: s.ps_code
    }));
    res.json(successResponse(formatted));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const getPoliceStationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const s = await prisma.police_stations.findUnique({
      where: { id: BigInt(id) }
    });

    if (!s) return res.status(404).json({ message: 'Police station not found' });

    res.json(successResponse({
      id: s.id.toString(),
      name: s.name,
      district: s.district,
      state: s.state,
      psCode: s.ps_code
    }));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
