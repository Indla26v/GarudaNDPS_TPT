import { Router } from 'express';
import {
  uploadStatement,
  getDashboard,
  getUploads,
  getTransactions,
  getAlerts,
  getOffenderLinks,
  getFlowMap,
  getCommonCounterparties,
  getMonthlyAnalysis,
  rerunAnalysis,
} from '../controllers/finance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/authorize.middleware';
import { uploadStatement as uploadStatementFile } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

// Upload + parse a bank/UPI statement (FIN upload permission)
router.post('/upload-statement', requirePermission('FINANCE_UPLOAD'), uploadStatementFile.single('file'), uploadStatement);

// Intelligence query APIs (FIN view permission)
router.get('/dashboard', requirePermission('FINANCE_VIEW'), getDashboard);
router.get('/uploads', requirePermission('FINANCE_VIEW'), getUploads);
router.get('/transactions', requirePermission('FINANCE_VIEW'), getTransactions);
router.get('/alerts', requirePermission('FINANCE_VIEW'), getAlerts);
router.get('/offender-links', requirePermission('FINANCE_VIEW'), getOffenderLinks);
router.get('/common-counterparties', requirePermission('FINANCE_VIEW'), getCommonCounterparties);
router.get('/flow-map/:offenderId', requirePermission('FINANCE_VIEW'), getFlowMap);
router.get('/analysis/monthly/:offenderId', requirePermission('FINANCE_VIEW'), getMonthlyAnalysis);

// Re-run analysis (FIN analyze permission)
router.post('/rerun-analysis/:batchId', requirePermission('FINANCE_ANALYZE'), rerunAnalysis);

export default router;
