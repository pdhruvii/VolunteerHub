// api/auth/devAuth.js
// Dev-time authentication (impersonation via header) + role-based authorization

// Role constants (keep consistent with proposal)
const ROLES = {
  COORDINATOR: 'coordinator', // admin/coordinator
  VOLUNTEER: 'volunteer'      // volunteer
};

// Two hard-coded dev users
const DEV_USERS = {
  admin: {
    id: 1,
    name: 'Admin User',
    email: 'admin@example.com',
    role: ROLES.COORDINATOR
  },
  vol: {
    id: 2,
    name: 'Volunteer User',
    email: 'vol@example.com',
    role: ROLES.VOLUNTEER
  }
};

// Dev-time auth: pick identity from request header X-Dev-User
// In production you can disable impersonation with ALLOW_IMPERSONATION=false
function devAuthenticate(req, res, next) {
  const allow = (process.env.ALLOW_IMPERSONATION ?? 'true').toLowerCase() === 'true';
  if (!allow) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const who = String(req.header('X-Dev-User') || '').toLowerCase();
  const user = DEV_USERS[who];

  if (!user) {
    return res.status(401).json({
      error: 'Missing or invalid X-Dev-User header (use "admin" or "vol")'
    });
  }

  // Attach the current user to the request object
  req.user = user;
  next();
}

// Authorization: only allow the specified roles
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

module.exports = { ROLES, devAuthenticate, requireRole };
