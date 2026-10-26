const express = require('express');
const router = express.Router();
const {
  checkPrescriptionDosage,
  checkPrescriptionInteraction,
  checkPrescriptionDuplicate,
  checkPrescriptionAllergySafety,
  analyzePrescription,
} = require('../controllers/medwiseController');
const { protect } = require('../middleware/authMiddleware');

// All MedWise engine endpoints require user authentication
router.use(protect);

// Dosage check (Phase 2 Step 1)
router.post('/prescriptions/:prescriptionId/dosage-check', checkPrescriptionDosage);

// Drug-drug interaction check (Phase 2 Step 2)
router.post('/prescriptions/:prescriptionId/interaction-check', checkPrescriptionInteraction);

// Duplicate medication check (Phase 2 Step 3)
router.post('/prescriptions/:prescriptionId/duplicate-check', checkPrescriptionDuplicate);

// Allergy & Safety check (Phase 2 Step 4)
router.post('/prescriptions/:prescriptionId/allergy-safety-check', checkPrescriptionAllergySafety);

// Full combined analysis — dosage + interaction + duplicate + allergy/safety (Phase 2 Step 4)
router.post('/prescriptions/:prescriptionId/analyze', analyzePrescription);

module.exports = router;


