import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';

export const getDashboardSummary = async (req: Request, res: Response) => {
  try {
    const totalCases = await prisma.cases.count();
    const totalOffenders = await prisma.offenders.count();
    const totalArrests = await prisma.case_accused.count({ where: { arrest_status: 'ARRESTED' } });
    const totalAbsconders = await prisma.case_accused.count({ where: { arrest_status: 'ABSCONDING' } });
    
    const seizureAgg = await prisma.seizures.aggregate({
      _sum: {
        contraband_kg: true,
        cash_amount: true,
        vehicles_count: true
      }
    });

    const totalContraband = seizureAgg._sum.contraband_kg || 0;
    const totalCash = seizureAgg._sum.cash_amount || 0;
    const totalVehicles = seizureAgg._sum.vehicles_count || 0;

    const allPs = await prisma.police_stations.findMany();

    const psWiseData = await Promise.all(allPs.map(async (ps) => {
      const psId = ps.id;
      
      const psCases = await prisma.cases.count({ where: { ps_id: psId } });
      const psOffenders = await prisma.offenders.count({ where: { ps_id: psId } });
      
      const psArrests = await prisma.case_accused.count({
        where: {
          cases: { ps_id: psId },
          arrest_status: 'ARRESTED'
        }
      });
      const psAbsconding = await prisma.case_accused.count({
        where: {
          cases: { ps_id: psId },
          arrest_status: 'ABSCONDING'
        }
      });

      const psSeizureAgg = await prisma.seizures.aggregate({
        where: { cases: { ps_id: psId } },
        _sum: { contraband_kg: true, cash_amount: true }
      });

      return {
        psId: psId.toString(),
        psName: ps.name,
        psCode: ps.ps_code,
        totalCases: psCases,
        totalOffenders: psOffenders,
        totalArrests: psArrests,
        totalAbsconders: psAbsconding,
        totalContrabandKg: psSeizureAgg._sum.contraband_kg || 0,
        totalCashSeized: psSeizureAgg._sum.cash_amount || 0
      };
    }));

    res.json(successResponse({
      totalCases,
      totalOffenders,
      totalArrests,
      totalAbsconders,
      totalContrabandKg: totalContraband,
      totalCashSeized: totalCash,
      totalVehiclesSeized: totalVehicles,
      psWiseData
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
