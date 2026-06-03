import { Router } from 'express';
import {
  createEnforcementCheck,
  submitTestResult,
  listEnforcementChecks,
  getEnforcementSummary,
  getPendingReview,
  reviewEnforcementCheck,
} from '../controllers/enforcement.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize, requirePermission } from '../middleware/authorize.middleware';

const router = Router();

router.use(authenticate);

// All authenticated officers can view and create enforcement checks
router.get('/', listEnforcementChecks);
router.get('/summary', getEnforcementSummary);
router.post('/', createEnforcementCheck);
router.put('/:id/test-result', submitTestResult);

// SHO+ only: review pending enforcement checks
router.get('/pending-review', requirePermission('ENFORCEMENT_REVIEW'), getPendingReview);
router.put('/:id/review', requirePermission('ENFORCEMENT_REVIEW'), reviewEnforcementCheck);

export default router;
