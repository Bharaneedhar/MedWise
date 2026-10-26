/**
 * Middleware to verify System Management access key
 */
const verifySystemManagementAccess = (req, res, next) => {
  const managementKey = req.headers['x-system-management-key'];
  const expectedKey = process.env.SYSTEM_MANAGEMENT_KEY || 'medwise-sys-admin-2026';

  if (!managementKey || managementKey !== expectedKey) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden: Invalid or missing System Management access key.',
    });
  }

  next();
};

module.exports = {
  verifySystemManagementAccess,
};
