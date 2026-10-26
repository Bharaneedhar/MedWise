const express = require('express');
const router = express.Router();
const {
  getSystemUsers,
  deleteUserAccount,
} = require('../controllers/systemManagementController');
const {
  verifySystemManagementAccess,
} = require('../middleware/systemManagementMiddleware');

// Protect all system management routes with verification key
router.use(verifySystemManagementAccess);

// System Management user routes
router.get('/users', getSystemUsers);
router.delete('/users/:userId', deleteUserAccount);

module.exports = router;
