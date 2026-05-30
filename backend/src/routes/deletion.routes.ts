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

// Step 1: Flag a record for deletion (any authenticated user)
router.post('/flag', flagForDeletion);

// Step 2: Escalate the flag (SHO)
router.post('/:id/escalate', escalateDeletion);

// Step 3: SDPO officially requests deletion
router.post('/:id/request', requestDeletion);

// Step 4: SP approves the deletion
router.post('/:id/approve', approveDeletion);

// Step 5: SP executes the final deletion
router.post('/:id/execute', executeDeletion);

// Reject at any step (by authorized role)
router.post('/:id/reject', authorize('SDPO'), rejectDeletion);

export default router;
