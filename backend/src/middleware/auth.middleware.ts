import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

// ── SECURITY FIX #1: No hardcoded fallback — fail-fast if JWT_SECRET is missing
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error(
    'FATAL: JWT_SECRET environment variable is not set. ' +
    'Refusing to start. Set JWT_SECRET in your .env or hosting environment.'
  );
}

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Extract token from HttpOnly cookie, fallback to Authorization header
  let token: string | undefined = req.cookies?.garuda_access_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.sendStatus(401);
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // ── SECURITY FIX #7: Verify the user account is still active and not locked
    // This prevents deactivated/locked users from continuing to operate
    // with a previously issued JWT (up to 8h window otherwise).
    const dbUser = await prisma.users.findUnique({
      where: { id: BigInt(decoded.userId) },
      select: { is_active: true, locked_until: true },
    });

    if (!dbUser || !dbUser.is_active) {
      return res.status(401).json({ message: 'Account deactivated' });
    }

    if (dbUser.locked_until && new Date() < dbUser.locked_until) {
      return res.status(423).json({ message: 'Account locked. Try again later.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.sendStatus(403);
  }
};
