const express = require('express');
const router = express.Router();
const {
  lookupPatientByPid,
  getPrescriptions,
  getPrescriptionById,
  createPrescription,
  checkWithMedwise,
  updatePrescription,
  deletePrescription,
  approvePrescription,
  dispensePrescription,
  deliverPrescription,
} = require('../controllers/prescriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// PID-based patient lookup (must be before /:id to avoid route collision)
router.get('/patient-by-pid/:pid', authorize('doctor'), lookupPatientByPid);

router.get('/', getPrescriptions);
router.get('/:id', getPrescriptionById);
router.post('/', authorize('doctor'), createPrescription);
router.put('/:id', authorize('doctor'), updatePrescription);
router.delete('/:id', authorize('doctor'), deletePrescription);
router.post('/:id/check-medwise', authorize('doctor'), checkWithMedwise);
router.put('/:id/approve', authorize('doctor'), approvePrescription);
router.put('/:id/dispense', authorize('pharmacist'), dispensePrescription);
router.put('/:id/deliver', authorize('pharmacist'), deliverPrescription);

module.exports = router;
