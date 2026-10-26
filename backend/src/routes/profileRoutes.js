const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getMyProfile,
  createOrUpdateMyProfile,
  getMyMedications,
  addPatientMedication,
  updateMyMedicationStatus,
} = require('../controllers/profileController');

const router = express.Router();

// Protected profile routes
router
  .route('/me')
  .get(protect, getMyProfile)
  .put(protect, createOrUpdateMyProfile)
  .post(protect, createOrUpdateMyProfile);

router
  .route('/medications')
  .get(protect, getMyMedications)
  .post(protect, addPatientMedication);

router
  .route('/medications/:medId/status')
  .put(protect, updateMyMedicationStatus);

module.exports = router;
