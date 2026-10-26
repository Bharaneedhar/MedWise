const express = require('express');
const router = express.Router();
const {
  getDoctorDashboard,
  getDoctorPatients,
  getPatientClinicalRecord,
  getDoctorClinicalOverview,
  getDoctorMedwiseReviews,
  updatePatientClinicalProfile,
  updatePatientMedicationStatus,
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All doctor routes are protected and restricted to 'doctor' role
router.use(protect);
router.use(authorize('doctor'));

router.get('/dashboard', getDoctorDashboard);
router.get('/patients', getDoctorPatients);
router.get('/patients/:patientId', getPatientClinicalRecord);
router.put('/patients/:patientId/clinical-profile', updatePatientClinicalProfile);
router.put('/patients/:patientId/medications/:medId/status', updatePatientMedicationStatus);
router.get('/clinical-overview', getDoctorClinicalOverview);
router.get('/medwise-reviews', getDoctorMedwiseReviews);

module.exports = router;
