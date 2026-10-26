/**
 * Reusable role authorization middleware
 * @param  {...string} allowedRoles - Allowed roles (e.g. 'doctor', 'pharmacist', 'patient')
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: User role not determined',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access forbidden: Role '${req.user.role}' is not authorized to access this clinical resource`,
      });
    }

    next();
  };
};

module.exports = { authorizeRoles };
