import { Router } from 'express';
import { createCase, getCases, getCaseById, updateAccused, updateSeizure, getCasesByOffender } from '../controllers/cases.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/authorize.middleware';

const router = Router();

router.use(authenticate);

// Create case: all roles with ADD_CASE permission
router.post('/', requirePermission('ADD_CASE'), createCase);

// Read: all authenticated users
router.get('/', getCases);
router.get('/:id', getCaseById);
router.get('/offender/:offenderId', getCasesByOffender);

// Update accused/seizures: only those with EDIT_RECORDS permission
router.post('/:id/accused', requirePermission('EDIT_RECORDS'), updateAccused);
router.post('/:id/seizures', requirePermission('EDIT_RECORDS'), updateSeizure);

export default router;
