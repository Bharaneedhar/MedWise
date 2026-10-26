const express = require('express');
const router = express.Router();
const {
  getMyConsultations,
  createConsultation,
  getConsultationById,
  updateConsultation,
} = require('../controllers/consultationController');
const { protect } = require('../middleware/authMiddleware');

// All consultation routes require valid authentication
router.use(protect);

router.get('/my', getMyConsultations);
router.get('/:id', getConsultationById);
router.post('/', createConsultation);
router.put('/:id', updateConsultation);

module.exports = router;
