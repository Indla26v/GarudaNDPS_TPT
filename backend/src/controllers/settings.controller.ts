import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

const DEFAULT_SETTINGS: Record<string, string> = {
  CHARGE_SHEET_DUE_DAYS_COMMERCIAL: '180',
  CHARGE_SHEET_DUE_DAYS_NON_COMMERCIAL: '60',
  ABSCONDER_ALERT_THRESHOLD_DAYS: '30',
  COURT_HEARING_REMINDER_DAYS: '1',
};

// GET /api/admin/settings
export const getSystemSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.system_settings.findMany();
    const settingsMap = { ...DEFAULT_SETTINGS };

    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    res.json(successResponse(settingsMap));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch system settings' });
  }
};

// POST /api/admin/settings
export const updateSystemSettings = async (req: Request, res: Response) => {
  try {
    const updates = req.body; // e.g. { CHARGE_SHEET_DUE_DAYS_COMMERCIAL: '180' }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ message: 'Invalid payload' });
    }

    const upsertPromises = Object.entries(updates).map(([key, val]) => {
      return prisma.system_settings.upsert({
        where: { key },
        update: { value: String(val) },
        create: { key, value: String(val) },
      });
    });

    await Promise.all(upsertPromises);
    await logAudit('UPDATE', 'SYSTEM_SETTINGS', null, req, `Updated system configurations: ${Object.keys(updates).join(', ')}`);

    res.json(successResponse(null, 'System settings updated successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update system settings' });
  }
};

// GET /api/admin/system-health
export const getSystemHealth = async (req: Request, res: Response) => {
  try {
    // 1. Get database size using a Postgres-safe raw query
    let dbSize = 'Unknown';
    try {
      const sizeResult = await prisma.$queryRaw<[ { size: string } ]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size;
      `;
      if (sizeResult && sizeResult[0]) {
        dbSize = sizeResult[0].size;
      }
    } catch (err) {
      console.warn('Failed to query database size:', err);
    }

    // 2. Count active users
    const activeUsersCount = await prisma.users.count({
      where: { is_active: true }
    });

    // 3. Count recent audit logs in past 24h
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAuditLogsCount = await prisma.audit_logs.count({
      where: { timestamp: { gte: past24h } }
    });

    // 4. Memory usage & uptime
    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = process.uptime();

    const healthData = {
      dbSize,
      activeUsersCount,
      recentAuditLogsCount,
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      },
      uptime: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m`,
      status: 'HEALTHY',
    };

    res.json(successResponse(healthData));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch system health details' });
  }
};
