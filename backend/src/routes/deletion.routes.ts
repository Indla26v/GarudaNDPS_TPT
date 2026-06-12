import { Router } from 'express';
import {
  getDeletionRequests,
  flagForDeletion,
  escalateDeletion,
  requestDeletion,
  approveDeletion,
  executeDeletion,
  rejectDeletion,
} from '../controllers/deletion.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize, requirePermission } from '../middleware/authorize.middleware';

const router = Router();

router.use(authenticate);

// List deletion requests (all authenticated users, scoped by role)
router.get('/', getDeletionRequests);

// ── SECURITY FIX #6: Defense-in-depth — add middleware authorization
// The controller already checks roles, but middleware ensures a missed
// controller check doesn't silently open access.

// Step 1: Flag a record for deletion (requires edit permission, not any user)
router.post('/flag', requirePermission('EDIT_RECORDS'), flagForDeletion);

// Step 2: Escalate the flag (SHO)
router.post('/:id/escalate', authorize('SHO'), escalateDeletion);

// Step 3: SDPO officially requests deletion
router.post('/:id/request', authorize('SDPO'), requestDeletion);

// Step 4: SP approves the deletion
router.post('/:id/approve', authorize('SP'), approveDeletion);

// Step 5: SP executes the final deletion
router.post('/:id/execute', authorize('SP'), executeDeletion);

// Reject at any step (by authorized role)
router.post('/:id/reject', authorize('SDPO'), rejectDeletion);

export default router;
