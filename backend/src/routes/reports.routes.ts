import { Router } from 'express';
import { getAbsconderReport } from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/absconder-list', getAbsconderReport);

export default router;
