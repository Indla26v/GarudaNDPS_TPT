import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  getAuditLogs,
} from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/authorize.middleware';

const router = Router();

router.use(authenticate);

// All routes require ADMIN — User Management
router.get('/users', requirePermission('USER_MANAGEMENT'), getUsers);
router.get('/users/:id', requirePermission('USER_MANAGEMENT'), getUserById);
router.post('/users', requirePermission('USER_MANAGEMENT'), createUser);
router.put('/users/:id', requirePermission('USER_MANAGEMENT'), updateUser);
router.delete('/users/:id', requirePermission('USER_MANAGEMENT'), deactivateUser);

// Audit Logs — ADMIN only
router.get('/audit-logs', requirePermission('AUDIT_LOGS'), getAuditLogs);

export default router;
