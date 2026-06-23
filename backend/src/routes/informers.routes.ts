import { Router } from 'express';
import {
  listInformers,
  registerInformer,
  updateInformer
} from '../controllers/informers.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/authorize.middleware';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('INFORMER_VIEW'), listInformers);
router.post('/', requirePermission('INFORMER_CREATE'), registerInformer);
router.put('/:id', requirePermission('INFORMER_CREATE'), updateInformer);

export default router;
