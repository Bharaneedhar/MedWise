const express = require('express');
const router = express.Router();
const { searchMedicines, getMedicineById } = require('../controllers/medicineController');
const {
  getMedicineInteractions,
  getMedicineSafetyRules,
  getMedicineDosageGuidelines,
} = require('../controllers/clinicalSafetyController');
const { protect } = require('../middleware/authMiddleware');

// All medicine endpoints require valid user authentication
router.use(protect);

router.get('/', searchMedicines);
router.get('/:id/interactions', getMedicineInteractions);
router.get('/:id/safety', getMedicineSafetyRules);
router.get('/:id/dosage-guidelines', getMedicineDosageGuidelines);
router.get('/:id', getMedicineById);

module.exports = router;
