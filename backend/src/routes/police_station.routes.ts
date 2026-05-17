import { Router } from 'express';
import { getAllPoliceStations, getPoliceStationById } from '../controllers/police_station.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', getAllPoliceStations);
router.get('/:id', getPoliceStationById);

export default router;
