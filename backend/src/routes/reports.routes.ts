import { Router } from 'express';
import {
  getAbsconderReport,
  getMonthlyAbstractReport,
  getYearlyComparisonReport,
  getPendingChargeSheetsReport,
  getBailExpiryAlertsReport,
  getCourtPendingReport,
  getDrugSeizuresReport,
  getTopOffendersReport,
  getDprExport,
  getCustomReport,
  getCourtDiary,
  getPerformanceMetrics
} from '../controllers/reports.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/absconder-list', getAbsconderReport);
router.get('/monthly-abstract', getMonthlyAbstractReport);
router.get('/yearly-comparison', getYearlyComparisonReport);
router.get('/pending-charge-sheets', getPendingChargeSheetsReport);
router.get('/bail-expiry-alerts', getBailExpiryAlertsReport);
router.get('/court-pending', getCourtPendingReport);
router.get('/drug-seizures', getDrugSeizuresReport);
router.get('/top-offenders', getTopOffendersReport);
router.get('/dpr-export', getDprExport);
router.get('/custom', getCustomReport);
router.get('/court-diary', getCourtDiary);
router.get('/performance', getPerformanceMetrics);

export default router;
