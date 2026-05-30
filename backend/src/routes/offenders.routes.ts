import { Router } from 'express';
import { getOffenders, getOffenderById, createOffender, updateOffender } from '../controllers/offenders.controller';
import { getInterrogations, addInterrogation } from '../controllers/case_lifecycle.controller';
import { exportOffendersCsv, getOffenderHistorySheet } from '../controllers/export.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize, requirePermission } from '../middleware/authorize.middleware';
import { uploadPhoto } from '../middleware/upload.middleware';

const router = Router();

router.use(authenticate);

// All authenticated users can view & search (scoped by PS in controller)
router.get('/', getOffenders);
router.get('/export', exportOffendersCsv);
router.get('/:offenderId/interrogations', getInterrogations);
router.get('/:id/history-sheet', getOffenderHistorySheet);
router.post('/:offenderId/interrogations', requirePermission('EDIT_RECORDS'), addInterrogation);
router.get('/:id', getOffenderById);

// Photo upload endpoint
router.post('/upload', uploadPhoto.single('photo'), (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({
    success: true,
    data: {
      url: `/api/uploads/${req.file.filename}`
    }
  });
});

// Create: all roles except SP (SP is district-level, doesn't add data directly)
router.post('/', requirePermission('ADD_CASE'), createOffender);

// Update: only ADMIN and DSP can directly edit; CI/SI must go through edit requests
router.put('/:id', requirePermission('EDIT_RECORDS'), updateOffender);

export default router;
