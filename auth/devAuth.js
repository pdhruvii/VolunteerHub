// auth/devAuth.js
// Dev-time identity impersonation + route-level RBAC (role-based access control)

const ROLES = {
  COORDINATOR: 'coordinator',
  VOLUNTEER: 'volunteer',
};

// Two fixed dev-time users (UUIDs are arbitrary but valid)
const DEV_USERS = {
  admin: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Admin User',
    email: 'admin@example.com',
    role: ROLES.COORDINATOR,
  },
  vol: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Volunteer User',
    email: 'vol@example.com',
    role: ROLES.VOLUNTEER,
  },
};

/**
 * Dev-time authentication middleware:
 * - Only runs when ALLOW_IMPERSONATION=true.
 * - If req.user is already set by JWT, it does nothing.
 * - Otherwise, it reads X-Dev-User: admin|vol and attaches a fake user to req.user.
 */
function devAuthenticate(req, _res, next) {
  // If JWT or some other auth already set req.user, do not override
  if (req.user) return next();

  const allow = (process.env.ALLOW_IMPERSONATION ?? 'true').toLowerCase() === 'true';
  if (!allow) return next();

  const who = String(req.header('X-Dev-User') || '').toLowerCase();
  const user = DEV_USERS[who];
  if (user) {
    req.user = user;
  }
  next();
}

/**
 * Route-level RBAC:
 * - When ENABLE_ROUTE_RBAC=true, requires req.user and checks that user.role is in allowedRoles.
 * - When ENABLE_ROUTE_RBAC=false, it simply skips checks and calls next().
 */
function requireRole(...allowedRoles) {
  const enabled = (process.env.ENABLE_ROUTE_RBAC ?? 'true').toLowerCase() === 'true';
  return (req, res, next) => {
    if (!enabled) return next();
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { ROLES, devAuthenticate, requireRole };
