const jwt = require('jsonwebtoken');

/**
 * Generate a signed JWT token containing userId and role
 * @param {string} userId
 * @param {string} role
 * @returns {string} Signed JWT token
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d',
    }
  );
};

module.exports = generateToken;
