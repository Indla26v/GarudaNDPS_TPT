import { Router } from 'express';
import {
  getSystemSettings,
  updateSystemSettings,
  getSystemHealth
} from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/authorize.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize('SP')); // Enforce SP (Admin) role for settings/health changes

router.get('/settings', getSystemSettings);
router.post('/settings', updateSystemSettings);
router.get('/system-health', getSystemHealth);

export default router;
