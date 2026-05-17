import { Router } from 'express';
import { getOffenders, getOffenderById, createOffender, updateOffender } from '../controllers/offenders.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize, requirePermission } from '../middleware/authorize.middleware';

const router = Router();

router.use(authenticate);

// All authenticated users can view & search (scoped by PS in controller)
router.get('/', getOffenders);
router.get('/:id', getOffenderById);

// Create: all roles except SP (SP is district-level, doesn't add data directly)
router.post('/', requirePermission('ADD_CASE'), createOffender);

// Update: only ADMIN and DSP can directly edit; CI/SI must go through edit requests
router.put('/:id', requirePermission('EDIT_RECORDS'), updateOffender);

export default router;
