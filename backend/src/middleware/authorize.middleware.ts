import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from './auth.middleware';
import { hasMinimumRole, hasPermission } from '../config/roles';

const JWT_SECRET = process.env.JWT_SECRET || 'G4rud4-Ant1Drug-Pl4tf0rm-S3cur3-K3y-2026-M1n1mum-256-B1t-L3ngth!!';

/**
 * Middleware that requires the user to have a minimum role level.
 * Roles are ranked: ADMIN > SP > DSP > CI > SI > CONSTABLE
 * 
 * Usage: router.get('/admin-only', authenticate, authorize('ADMIN'), handler);
 */
export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Check if user's role is in the allowed roles list
    const isAllowed = allowedRoles.some(
      (allowed) => hasMinimumRole(user.role, allowed)
    );

    if (!isAllowed) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        required: allowedRoles,
        current: user.role,
      });
    }

    next();
  };
}

/**
 * Middleware that checks a specific permission from the permission matrix.
 * 
 * Usage: router.get('/audit', authenticate, requirePermission('AUDIT_LOGS'), handler);
 */
export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!hasPermission(user.role, permission)) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        required: permission,
        current: user.role,
      });
    }

    next();
  };
}
