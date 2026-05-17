/**
 * GARUDA — Team Management Controller (Admin Only)
 * 
 * CRUD for teams: create, list, update, assign/remove members.
 */
import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

// ── List all teams ──────────────────────────────────────────────────
export const getTeams = async (req: Request, res: Response) => {
  try {
    const teams = await prisma.teams.findMany({
      include: {
        members: {
          select: {
            id: true,
            username: true,
            full_name: true,
            role: true,
            department: true,
            badge_number: true,
            is_active: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const formatted = teams.map(t => ({
      id: t.id.toString(),
      name: t.name,
      department: t.department,
      description: t.description,
      isActive: t.is_active,
      memberCount: t.members.length,
      members: t.members.map(m => ({
        id: m.id.toString(),
        username: m.username,
        fullName: m.full_name,
        role: m.role,
        department: m.department,
        badgeNumber: m.badge_number,
        isActive: m.is_active,
      })),
      createdAt: t.created_at,
    }));

    res.json(successResponse(formatted));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Create team ─────────────────────────────────────────────────────
export const createTeam = async (req: Request, res: Response) => {
  try {
    const { name, department, description } = req.body;
    if (!name || !department) {
      return res.status(400).json({ message: 'name and department are required' });
    }

    const existing = await prisma.teams.findUnique({ where: { name } });
    if (existing) {
      return res.status(409).json({ message: 'Team name already exists' });
    }

    const team = await prisma.teams.create({
      data: { name, department, description: description || null },
    });

    await logAudit('CREATE', 'TEAM', team.id, req, `Team "${name}" created for ${department}`);
    res.status(201).json(successResponse({ id: team.id.toString(), name }, 'Team created'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Update team ─────────────────────────────────────────────────────
export const updateTeam = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, department, description, isActive } = req.body;

    const existing = await prisma.teams.findUnique({ where: { id: BigInt(id) } });
    if (!existing) return res.status(404).json({ message: 'Team not found' });

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (department !== undefined) updateData.department = department;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.is_active = isActive;

    await prisma.teams.update({ where: { id: BigInt(id) }, data: updateData });
    await logAudit('UPDATE', 'TEAM', id, req as any, `Team updated: ${JSON.stringify(Object.keys(updateData))}`);

    res.json(successResponse({ id }, 'Team updated'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Add member to team ──────────────────────────────────────────────
export const addMember = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const team = await prisma.teams.findUnique({ where: { id: BigInt(id) } });
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const user = await prisma.users.findUnique({ where: { id: BigInt(userId as string) } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await prisma.users.update({
      where: { id: BigInt(userId as string) },
      data: { team_id: BigInt(id), department: team.department },
    });

    await logAudit('UPDATE', 'TEAM', id, req as any, `User ${user.username} added to team "${team.name}"`);
    res.json(successResponse({ teamId: id, userId }, 'Member added to team'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Remove member from team ─────────────────────────────────────────
export const removeMember = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = req.params.userId as string;

    const user = await prisma.users.findUnique({ where: { id: BigInt(userId) } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    await prisma.users.update({
      where: { id: BigInt(userId) },
      data: { team_id: null },
    });

    await logAudit('UPDATE', 'TEAM', id, req as any, `User ${user.username} removed from team`);
    res.json(successResponse({ teamId: id, userId }, 'Member removed'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Delete team ─────────────────────────────────────────────────────
export const deleteTeam = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Unassign all members first
    await prisma.users.updateMany({
      where: { team_id: BigInt(id) },
      data: { team_id: null },
    });

    await prisma.teams.delete({ where: { id: BigInt(id) } });
    await logAudit('DELETE', 'TEAM', id, req as any, `Team deleted`);

    res.json(successResponse({ id }, 'Team deleted'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
