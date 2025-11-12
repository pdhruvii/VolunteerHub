// api/app.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Import dev-time auth + role guard
const { ROLES, devAuthenticate, requireRole } = require('./auth/devAuth');

/**
 * Health endpoints (no auth required)
 * Keep these before auth so probes always work
 */
app.get('/healthz', (_req, res) => res.sendStatus(200));
app.get('/readyz', async (_req, res) => {
  // No DB wired yet — return 200 for now; later check DB connectivity here
  res.sendStatus(200);
});

/**
 * Dev-time authentication: inject current user from X-Dev-User
 * In production set ALLOW_IMPERSONATION=false to disable impersonation
 */
app.use(devAuthenticate);

/**
 * Placeholder business routes to demonstrate RBAC.
 * Replace handlers with real logic later; keep requireRole guards.
 */

// Admin only: create/update/delete events
app.post('/events', requireRole(ROLES.COORDINATOR), (req, res) => {
  res.status(201).json({ message: 'create event - ok (admin only)' });
});

app.put('/events/:id', requireRole(ROLES.COORDINATOR), (req, res) => {
  res.json({ message: `update event ${req.params.id} - ok (admin only)` });
});

app.delete('/events/:id', requireRole(ROLES.COORDINATOR), (req, res) => {
  res.sendStatus(204);
});

// Volunteer: update their participation
// (Optionally also allow coordinator if your business rules permit)
app.put('/events/:id/participation', requireRole(ROLES.VOLUNTEER /*, ROLES.COORDINATOR */), (req, res) => {
  res.json({ message: `update participation for event ${req.params.id} - ok (volunteer)` });
});

// Both roles can read list and details
app.get('/events', requireRole(ROLES.COORDINATOR, ROLES.VOLUNTEER), (req, res) => {
  res.json({ message: 'list events - ok (admin or volunteer)' });
});

app.get('/events/:id', requireRole(ROLES.COORDINATOR, ROLES.VOLUNTEER), (req, res) => {
  res.json({ message: `get event ${req.params.id} - ok (admin or volunteer)` });
});

// Start server
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});