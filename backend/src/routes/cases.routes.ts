import { Router } from 'express';
import {
  createCase,
  getCases,
  getCaseById,
  updateCase,
  updateAccused,
  updateSeizure,
  getCasesByOffender,
} from '../controllers/cases.controller';
import {
  getChargeSheet,
  upsertChargeSheet,
  getCourtHearings,
  addCourtHearing,
  getBailRecords,
  addBailRecord,
} from '../controllers/case_lifecycle.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/authorize.middleware';
import { uploadDocument } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

// Document upload endpoint
router.post('/upload', uploadDocument.single('file'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({
    success: true,
    data: {
      url: `/api/uploads/${req.file.filename}`,
      name: req.file.originalname
    }
  });
});

router.post('/', requirePermission('ADD_CASE'), createCase);
router.get('/', getCases);
router.get('/offender/:offenderId', getCasesByOffender);
router.get('/:id', getCaseById);
router.put('/:id', requirePermission('EDIT_RECORDS'), updateCase);
router.post('/:id/accused', requirePermission('EDIT_RECORDS'), updateAccused);
router.post('/:id/seizures', requirePermission('EDIT_RECORDS'), updateSeizure);

router.get('/:id/charge-sheet', getChargeSheet);
router.put('/:id/charge-sheet', requirePermission('EDIT_RECORDS'), upsertChargeSheet);
router.get('/:id/court-hearings', getCourtHearings);
router.post('/:id/court-hearings', requirePermission('EDIT_RECORDS'), addCourtHearing);
router.get('/:id/bail-records', getBailRecords);
router.post('/:id/bail-records', requirePermission('EDIT_RECORDS'), addBailRecord);

export default router;
