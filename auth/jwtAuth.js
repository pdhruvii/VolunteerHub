// auth/jwtAuth.js
// JWT helpers: sign, verify, and extract Bearer tokens

const jwt = require('jsonwebtoken');

/**
 * Sign a JWT for the given user.
 * Required fields: user.id, user.role
 * Optional: user.email
 */
function signToken(user) {
  const secret = requireEnv('JWT_SECRET');
  const expiresIn = process.env.JWT_EXPIRES || '1h';

  const payload = {
    sub: user.id,        // subject: user id
    role: user.role,
    email: user.email || undefined,
  };

  return jwt.sign(payload, secret, { expiresIn });
}

/**
 * Verify a JWT string and return its decoded claims.
 * Throws if the token is invalid or expired.
 */
function verifyToken(token) {
  const secret = requireEnv('JWT_SECRET');
  return jwt.verify(token, secret);
}

/**
 * Extract the token part from an Authorization header of the form:
 *   Authorization: Bearer <token>
 * Returns the token string or null if not in Bearer format.
 */
function extractBearer(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  const prefix = 'Bearer ';
  if (!authHeader.startsWith(prefix)) return null;
  const token = authHeader.slice(prefix.length).trim();
  return token || null;
}

/**
 * Helper to require an environment variable to be set.
 * Throws a descriptive error if missing.
 */
function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return v;
}

module.exports = {
  signToken,
  verifyToken,
  extractBearer,
};
