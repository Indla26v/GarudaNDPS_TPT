import { Router } from 'express';
import {
  createEnforcementCheck,
  submitTestResult,
  listEnforcementChecks,
  getEnforcementSummary,
  getPendingReview,
  reviewEnforcementCheck,
  submitVillageVisit,
  submitLodgeCheck,
  searchOffenders,
  submitDrunkDrive,
  submitCourierCheck,
  submitRailwayCheck,
  submitBusStandCheck,
  submitRowdySheeter,
  submitBoundOver,
  submitVehicleCheck,
  submitMvAct,
  submitPettyCases,
  submitPalleNidra,
  submitDroneSurveillance,
} from '../controllers/enforcement.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize, requirePermission } from '../middleware/authorize.middleware';

const router = Router();

router.use(authenticate);

// All authenticated officers can view and create enforcement checks
router.get('/', listEnforcementChecks);
router.get('/summary', getEnforcementSummary);
router.post('/', createEnforcementCheck);
router.put('/:id/test-result', submitTestResult);

// New Field Enforcement Module Routes
router.post('/search', searchOffenders);
router.post('/village-visit', submitVillageVisit);
router.post('/lodge-check', submitLodgeCheck);
router.post('/drunk-drive', submitDrunkDrive);
router.post('/courier-check', submitCourierCheck);
router.post('/courier-drive', submitCourierCheck);
router.post('/railway-check', submitRailwayCheck);
router.post('/bus-stand-check', submitBusStandCheck);
router.post('/rowdy-sheeter', submitRowdySheeter);
router.post('/bound-over', submitBoundOver);
router.post('/vehicle-check', submitVehicleCheck);
router.post('/mv-act', submitMvAct);
router.post('/petty-cases', submitPettyCases);
router.post('/palle-nidra', submitPalleNidra);
router.post('/drone-surveillance', submitDroneSurveillance);

// SHO+ only: review pending enforcement checks
router.get('/pending-review', requirePermission('ENFORCEMENT_REVIEW'), getPendingReview);
router.put('/:id/review', requirePermission('ENFORCEMENT_REVIEW'), reviewEnforcementCheck);

export default router;
