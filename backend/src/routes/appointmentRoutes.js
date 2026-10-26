const express = require('express');
const router = express.Router();
const {
  createAppointment,
  getDoctorAppointments,
  getDoctorFollowUps,
  getAppointmentById,
  updateAppointment,
  lookupPatientByPid,
  getDepartmentsAndDoctors,
  getAvailableSlots,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All appointment routes require authentication
router.use(protect);

// Admin appointment booking endpoints
router.get('/patient-lookup', authorize('admin'), lookupPatientByPid);
router.get('/departments-doctors', authorize('admin'), getDepartmentsAndDoctors);
router.get('/available-slots', authorize('admin'), getAvailableSlots);
router.post('/', authorize('admin'), createAppointment);

// Doctor specific appointment endpoints
router.get('/doctor', authorize('doctor'), getDoctorAppointments);
router.get('/doctor/follow-ups', authorize('doctor'), getDoctorFollowUps);

// Shared / individual appointment endpoints
router.get('/:id', getAppointmentById);
router.put('/:id', authorize('doctor'), updateAppointment);

module.exports = router;
