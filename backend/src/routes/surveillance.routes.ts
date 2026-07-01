import { Router } from 'express';
import {
  listSurveillanceRecords,
  createSurveillanceRecord,
  updateSurveillanceRecord,
  getOffenderSurveillanceHistory,
  getSurveillanceDashboard,
  addMobile,
  listMobiles,
  addImei,
  listImeis,
  getMapLogs,
  addSocialIntel,
  listSocialIntel,
  addMessagingIntel,
  listMessagingIntel,
  getCorrelations,
  uploadTowerDump,
  getTowerIntersections,
} from '../controllers/surveillance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/authorize.middleware';
import { uploadExcel } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

// ── Reads — TECH_VIEW_ALL (CYBER_ANALYTICS; SP bypasses) ───────────────
router.get('/', requirePermission('TECH_VIEW_ALL'), listSurveillanceRecords);
router.get('/dashboard', requirePermission('TECH_VIEW_ALL'), getSurveillanceDashboard);
router.get('/mobiles', requirePermission('TECH_VIEW_ALL'), listMobiles);
router.get('/imeis', requirePermission('TECH_VIEW_ALL'), listImeis);
router.get('/social', requirePermission('TECH_VIEW_ALL'), listSocialIntel);
router.get('/messaging', requirePermission('TECH_VIEW_ALL'), listMessagingIntel);
router.get('/map-logs', requirePermission('TECH_VIEW_ALL'), getMapLogs);
router.get('/correlations', requirePermission('TECH_VIEW_ALL'), getCorrelations);
router.get('/tower-intersections', requirePermission('TECH_VIEW_ALL'), getTowerIntersections);
router.get('/offender/:offenderId', requirePermission('TECH_VIEW_ALL'), getOffenderSurveillanceHistory);

// ── Writes — TECH_ADD ──────────────────────────────────────────────────
router.post('/', requirePermission('TECH_ADD'), createSurveillanceRecord);
router.put('/:id', requirePermission('TECH_ADD'), updateSurveillanceRecord);
router.post('/mobile', requirePermission('TECH_ADD'), addMobile);
router.post('/imei', requirePermission('TECH_ADD'), addImei);
router.post('/social', requirePermission('TECH_ADD'), addSocialIntel);
router.post('/messaging', requirePermission('TECH_ADD'), addMessagingIntel);
router.post('/tower-dump', requirePermission('TECH_ADD'), uploadExcel.single('file'), uploadTowerDump);

export default router;
