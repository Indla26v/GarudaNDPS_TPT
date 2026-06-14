import prisma from '../config/prisma';
import { Request } from 'express';

const VALID_ACTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT',
  'LOGIN', 'LOGOUT',
  'DELETION_FLAGGED', 'DELETION_ESCALATED', 'DELETION_REQUESTED',
  'DELETION_APPROVED', 'DELETION_EXECUTED', 'DELETION_REJECTED',
  'EDIT_REQUESTED', 'EDIT_APPROVED', 'EDIT_REJECTED',
  'UPDATE_ACCUSED',
];

export const logAudit = async (
  action: string,
  entityType: string,
  entityId: bigint | string | number | null = null,
  req?: Request,
  details?: string
) => {
  try {
    let userId: bigint | null = null;
    let ipAddress: string | null = null;
    let userAgent: string | null = null;

    if (req) {
      if ((req as any).user) {
        userId = BigInt((req as any).user.userId);
      }
      ipAddress = req.ip || req.connection.remoteAddress || null;
      userAgent = req.headers['user-agent'] || null;
    }

    let parsedAction: any = 'CREATE';
    if (VALID_ACTIONS.includes(action.toUpperCase())) {
      parsedAction = action.toUpperCase();
    }

    await prisma.audit_logs.create({
      data: {
        user_id: userId,
        action: parsedAction,
        entity_type: entityType,
        entity_id: entityId ? BigInt(entityId) : null,
        ip_address: ipAddress ? ipAddress.substring(0, 45) : null,
        user_agent: userAgent ? userAgent.substring(0, 255) : null,
        details: details || null,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};
