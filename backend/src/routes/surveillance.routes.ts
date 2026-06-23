import { Router } from 'express';
import {
  listSurveillanceRecords,
  createSurveillanceRecord,
  updateSurveillanceRecord,
  getOffenderSurveillanceHistory
} from '../controllers/surveillance.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/', listSurveillanceRecords);
router.post('/', createSurveillanceRecord);
router.put('/:id', updateSurveillanceRecord);
router.get('/offender/:offenderId', getOffenderSurveillanceHistory);

export default router;
