import { Router } from 'express';
import {
  getSeizedVehicles,
  getSeizedVehicleById,
  updateSeizedVehicle,
} from '../controllers/vehicles.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/authorize.middleware';

const router = Router();

router.use(authenticate);

router.get('/', getSeizedVehicles);
router.get('/:id', getSeizedVehicleById);

// Admin / Editor routes
router.put('/:id', requirePermission('VEHICLE_EDIT'), updateSeizedVehicle);

export default router;
