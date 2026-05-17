/**
 * GARUDA — User Management Controller (Admin Only)
 * 
 * Full CRUD for user accounts, role assignment, PS assignment.
 */
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

// ── List all users ────────────────────────────────────────────────────
export const getUsers = async (req: Request, res: Response) => {
  try {
    const { role, psId, page = 0, size = 20 } = req.query;
    const where: any = {};
    if (role) where.role = String(role);
    if (psId) where.police_station_id = BigInt(psId as string);

    const skip = Number(page) * Number(size);
    const take = Number(size);

    const [users, total] = await Promise.all([
      prisma.users.findMany({
        where,
        include: { police_stations: true },
        orderBy: { created_at: 'desc' },
        skip,
        take,
      }),
      prisma.users.count({ where }),
    ]);

    const formatted = users.map(u => ({
      id: u.id.toString(),
      username: u.username,
      fullName: u.full_name,
      role: u.role,
      policeStationId: u.police_station_id?.toString() || null,
      policeStationName: u.police_stations?.name || null,
      isActive: u.is_active,
      lastLogin: u.last_login,
      createdAt: u.created_at,
    }));

    res.json(successResponse({ content: formatted, totalElements: total, totalPages: Math.ceil(total / take) }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Get single user ──────────────────────────────────────────────────
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.users.findUnique({
      where: { id: BigInt(id) },
      include: { police_stations: true },
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(successResponse({
      id: user.id.toString(),
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      policeStationId: user.police_station_id?.toString() || null,
      policeStationName: user.police_stations?.name || null,
      isActive: user.is_active,
      lastLogin: user.last_login,
      createdAt: user.created_at,
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Create user ──────────────────────────────────────────────────────
export const createUser = async (req: Request, res: Response) => {
  try {
    const { username, password, fullName, role, policeStationId } = req.body;

    if (!username || !password || !fullName || !role) {
      return res.status(400).json({ message: 'username, password, fullName, and role are required' });
    }

    // Check for existing username
    const existing = await prisma.users.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await prisma.users.create({
      data: {
        username,
        password_hash: passwordHash,
        full_name: fullName,
        role,
        police_station_id: policeStationId ? BigInt(policeStationId) : null,
        is_active: true,
      }
    });

    await logAudit('CREATE', 'USER', newUser.id, req,
      `User ${username} created with role ${role}`);

    res.status(201).json(successResponse(
      { id: newUser.id.toString(), username: newUser.username, role: newUser.role },
      'User created successfully'
    ));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Update user (role, PS assignment, active status) ─────────────────
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, role, policeStationId, isActive, password } = req.body;

    const existing = await prisma.users.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'User not found' });

    const updateData: any = {};
    if (fullName !== undefined) updateData.full_name = fullName;
    if (role !== undefined) updateData.role = role;
    if (policeStationId !== undefined) updateData.police_station_id = policeStationId ? BigInt(policeStationId) : null;
    if (isActive !== undefined) updateData.is_active = isActive;
    if (password) updateData.password_hash = await bcrypt.hash(password, 12);

    await prisma.users.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    await logAudit('UPDATE', 'USER', id, req,
      `User ${existing.username} updated: ${JSON.stringify(Object.keys(updateData))}`);

    res.json(successResponse({ id }, 'User updated successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Deactivate user ──────────────────────────────────────────────────
export const deactivateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await prisma.users.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'User not found' });

    await prisma.users.update({
      where: { id: BigInt(id) },
      data: { is_active: false },
    });

    // Revoke all refresh tokens
    await prisma.refresh_tokens.updateMany({
      where: { user_id: BigInt(id), revoked: false },
      data: { revoked: true },
    });

    await logAudit('UPDATE', 'USER', id, req,
      `User ${existing.username} deactivated`);

    res.json(successResponse({ id }, 'User deactivated'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Get audit logs (Admin only) ──────────────────────────────────────
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { action, entityType, userId, page = 0, size = 50 } = req.query;

    const where: any = {};
    if (action) where.action = String(action);
    if (entityType) where.entity_type = String(entityType);
    if (userId) where.user_id = BigInt(userId as string);

    const skip = Number(page) * Number(size);
    const take = Number(size);

    const [logs, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where,
        include: { users: { select: { id: true, full_name: true, username: true, role: true } } },
        orderBy: { timestamp: 'desc' },
        skip,
        take,
      }),
      prisma.audit_logs.count({ where }),
    ]);

    const formatted = logs.map(l => ({
      id: l.id.toString(),
      action: l.action,
      entityType: l.entity_type,
      entityId: l.entity_id?.toString() || null,
      details: l.details,
      ipAddress: l.ip_address,
      timestamp: l.timestamp,
      user: l.users ? {
        id: l.users.id.toString(),
        name: l.users.full_name,
        username: l.users.username,
        role: l.users.role,
      } : null,
    }));

    res.json(successResponse({ content: formatted, totalElements: total, totalPages: Math.ceil(total / take) }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
