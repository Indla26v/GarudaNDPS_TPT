import { Router } from 'express';
import { getIntelligence, createIntelligence } from '../controllers/intelligence.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', getIntelligence);
router.post('/', createIntelligence);

export default router;
