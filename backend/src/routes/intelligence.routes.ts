import { Router } from 'express';
import { 
  getIntelligence, 
  createIntelligence, 
  getNetworkGraph, 
  getDuplicateContacts,
  predictRisk,
  getInterstateRoutes,
  getConsignmentTrails,
  getCaseLinkages
} from '../controllers/intelligence.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', getIntelligence);
router.post('/', createIntelligence);
router.get('/network-graph', getNetworkGraph);
router.get('/duplicate-contacts', getDuplicateContacts);
router.post('/predict-risk', predictRisk);
router.get('/interstate-routes', getInterstateRoutes);
router.get('/consignment-trails', getConsignmentTrails);
router.get('/case-linkages', getCaseLinkages);

export default router;
