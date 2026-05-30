import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ROLE_HIERARCHY, hasPermission } from '../config/roles';

/**
 * Middleware that requires the user to have a minimum role level.
 * Roles are ranked: SP > ASP > SDPO > SHO > CONSTABLE
 */
export function authorize(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const userRank = ROLE_HIERARCHY[user.role];
    const isAllowed = allowedRoles.some(allowed => {
      const allowedRank = ROLE_HIERARCHY[allowed];
      return userRank !== undefined && allowedRank !== undefined && userRank <= allowedRank;
    });

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
 * Now checks both role rank AND department membership.
 */
export function requirePermission(permission: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !user.role) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!hasPermission(user.role, user.department || '', permission as any)) {
      return res.status(403).json({
        message: 'Insufficient permissions',
        required: permission,
        current: { role: user.role, department: user.department },
      });
    }

    next();
  };
}
