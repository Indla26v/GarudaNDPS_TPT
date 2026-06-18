import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deactivateUser,
  getAuditLogs,
} from '../controllers/admin.controller';
import {
  getTeams,
  createTeam,
  updateTeam,
  addMember,
  removeMember,
  deleteTeam,
} from '../controllers/team.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/authorize.middleware';
import { importDprExcel, previewDprExcel, confirmDprImport } from '../controllers/import.controller';
import { uploadExcel } from '../middleware/upload.middleware';

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

// Team Management — ADMIN only
router.get('/teams', requirePermission('TEAM_MANAGEMENT'), getTeams);
router.post('/teams', requirePermission('TEAM_MANAGEMENT'), createTeam);
router.put('/teams/:id', requirePermission('TEAM_MANAGEMENT'), updateTeam);
router.post('/teams/:id/members', requirePermission('TEAM_MANAGEMENT'), addMember);
router.delete('/teams/:id/members/:userId', requirePermission('TEAM_MANAGEMENT'), removeMember);
router.delete('/teams/:id', requirePermission('TEAM_MANAGEMENT'), deleteTeam);

router.post('/import/dpr', requirePermission('USER_MANAGEMENT'), uploadExcel.single('file'), importDprExcel);
router.post('/import/dpr/preview', requirePermission('USER_MANAGEMENT'), uploadExcel.single('file'), previewDprExcel);
router.post('/import/dpr/confirm', requirePermission('USER_MANAGEMENT'), confirmDprImport);

export default router;
