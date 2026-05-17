import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { convertBigIntsToNumbers, successResponse } from '../utils/transformers';
import { logAudit } from '../utils/auditLogger';

const JWT_SECRET = process.env.JWT_SECRET || 'G4rud4-Ant1Drug-Pl4tf0rm-S3cur3-K3y-2026-M1n1mum-256-B1t-L3ngth!!';

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.users.findUnique({ where: { username } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
       return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await prisma.users.update({
      where: { id: user.id },
      data: { last_login: new Date() }
    });

    const accessToken = jwt.sign(
      { userId: Number(user.id), username: user.username, role: user.role, department: user.department, policeStationId: user.police_station_id ? Number(user.police_station_id) : null },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    const refreshTokenString = generateRefreshToken();
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7); // 7 days expiry

    await prisma.refresh_tokens.create({
      data: {
        user_id: user.id,
        token: refreshTokenString,
        expiry_date: expiryDate,
        revoked: false
      }
    });

    // We can't attach req to logAudit directly without modifying it, but we can set mock req user.
    (req as any).user = { userId: user.id };
    await logAudit('LOGIN', 'USER', user.id, req);

    res.json(successResponse({
      accessToken,
      refreshToken: refreshTokenString,
      expiresIn: 8 * 60 * 60, // 8 hours in seconds
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      department: user.department,
      policeStationId: user.police_station_id ? Number(user.police_station_id) : null
    }));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token is required' });
  }

  try {
    const stored = await prisma.refresh_tokens.findUnique({
      where: { token: refreshToken },
      include: { users: true }
    });

    if (!stored || stored.revoked || new Date() > stored.expiry_date) {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = stored.users;
    if (!user) {
      return res.status(401).json({ message: 'Invalid refresh token user' });
    }

    const newAccessToken = jwt.sign(
      { userId: Number(user.id), username: user.username, role: user.role, department: user.department, policeStationId: user.police_station_id ? Number(user.police_station_id) : null },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json(successResponse({
      accessToken: newAccessToken,
      refreshToken: stored.token,
      expiresIn: 8 * 60 * 60,
      username: user.username,
      fullName: user.full_name,
      role: user.role,
      department: user.department,
      policeStationId: user.police_station_id ? Number(user.police_station_id) : null
    }));
  } catch(error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const logout = async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    // Revoke all
    await prisma.refresh_tokens.updateMany({
      where: { user_id: BigInt(userId), revoked: false },
      data: { revoked: true }
    });

    await logAudit('LOGOUT', 'USER', BigInt(userId), req);

    res.json(successResponse(null, 'Logged out successfully'));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: (req as any).user.userId }
    });
    
    if (!user) {
       return res.status(404).json({ message: 'User not found' });
    }
    
    const { password_hash, ...userWithoutPassword } = user;
    res.json(successResponse(convertBigIntsToNumbers(userWithoutPassword)));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
