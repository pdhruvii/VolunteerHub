// app.js
// Main Express application: API key + JWT auth, dev-time impersonation, RBAC, and all core routes

const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { ROLES, devAuthenticate, requireRole } = require('./auth/devAuth');
const { signToken, verifyToken, extractBearer } = require('./auth/jwtAuth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// === DATABASE POOL ===
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// === ACCESS GATE: API key OR JWT (except for public routes) ===
const accessGate = (req, res, next) => {
  const publicPaths = ['/register', '/login'];
  const isPublic =
    (req.method === 'GET' && req.path.startsWith('/health')) ||
    (req.method === 'POST' && publicPaths.includes(req.path));

  if (isPublic) return next();

  const authHeader = req.headers.authorization;

  // Try Bearer token first (could be JWT or API key)
  const maybeToken = extractBearer(authHeader);
  if (maybeToken) {
    // 1) Try JWT first
    try {
      const claims = verifyToken(maybeToken);
      req.user = {
        id: claims.sub,
        role: claims.role,
        email: claims.email || undefined,
      };
      return next();
    } catch {
      // 2) Fallback: treat it as API key
      const apiKey = process.env.API_KEY;
      if (apiKey && maybeToken === apiKey) {
        // Only service-level access; req.user is still undefined here
        return next();
      }
      return res.status(401).json({ error: 'Invalid token or API key' });
    }
  }

  // No Authorization header or not Bearer format
  return res.status(401).json({ error: 'Missing Authorization header' });
};
app.use(accessGate);

// === DEV-TIME IMPERSONATION (only if no JWT user set) ===
app.use(devAuthenticate);

// === HEALTH CHECKS ===
app.get('/health/alive', (_req, res) => res.sendStatus(200));

app.get('/health/db', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

// === UTILITIES ===
const getUser = async (id) => {
  if (!id) return null;
  const { rows } = await pool.query(
    'SELECT id, role, email, name FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

// === AUTH: REGISTER + LOGIN ===

// Register a new user (public)
app.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password too short' });
  }
  if (!['coordinator', 'volunteer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role`,
      [email, hash, name, role]
    );
    const user = rows[0];
    res.status(201).json({ id: user.id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login (public) -> returns JWT token + basic user info
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id, role: user.role, email: user.email });
    res.json({
      token,
      user: { id: user.id, role: user.role, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// === EVENTS ===

// Create event (coordinator only)
// created_by is taken from body if provided, otherwise from req.user.id
app.post('/events', requireRole(ROLES.COORDINATOR), async (req, res) => {
  let {
    title,
    description,
    event_date,
    start_time,
    end_time,
    location,
    created_by,
  } = req.body;
  if (!created_by && req.user?.id) created_by = req.user.id;

  if (
    !title ||
    !description ||
    !event_date ||
    !start_time ||
    !end_time ||
    !location ||
    !created_by
  ) {
    return res.status(400).json({ error: 'All fields required' });
  }

  const user = await getUser(created_by);
  if (!user || user.role !== 'coordinator') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO events (title, description, event_date, start_time, end_time, location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description, event_date, start_time, end_time, location, created_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List events (coordinator or volunteer)
app.get('/events', requireRole(ROLES.COORDINATOR, ROLES.VOLUNTEER), async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM events ORDER BY event_date, start_time'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get event by id (coordinator or volunteer)
app.get(
  '/events/:id',
  requireRole(ROLES.COORDINATOR, ROLES.VOLUNTEER),
  async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [
        req.params.id,
      ]);
      if (!rows.length) return res.status(404).json({ error: 'Event not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Patch event (coordinator only; must be the creator)
// created_by is taken from body or req.user.id
app.patch('/events/:id', requireRole(ROLES.COORDINATOR), async (req, res) => {
  let { created_by } = req.body;
  if (!created_by && req.user?.id) created_by = req.user.id;
  if (!created_by) return res.status(400).json({ error: 'created_by required' });

  const user = await getUser(created_by);
  if (!user || user.role !== 'coordinator') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const updates = {};
  const allowed = ['title', 'description', 'event_date', 'start_time', 'end_time', 'location'];
  for (const k of allowed) {
    if (req.body[k] !== undefined) updates[k] = req.body[k];
  }
  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No updates' });
  }

  const keys = Object.keys(updates);
  const setClause =
    keys.map((k, i) => `${k} = $${i + 1}`).join(', ') + ', updated_at = now()';
  const params = keys.map((k) => updates[k]);
  params.push(req.params.id, created_by);

  try {
    const { rows } = await pool.query(
      `UPDATE events
         SET ${setClause}
       WHERE id = $${params.length - 1} AND created_by = $${params.length}
       RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Event not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete event (coordinator only; must be the creator)
app.delete('/events/:id', requireRole(ROLES.COORDINATOR), async (req, res) => {
  let { created_by } = req.body;
  if (!created_by && req.user?.id) created_by = req.user.id;
  if (!created_by) return res.status(400).json({ error: 'created_by required' });

  const user = await getUser(created_by);
  if (!user || user.role !== 'coordinator') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { rowCount } = await pool.query(
      'DELETE FROM events WHERE id = $1 AND created_by = $2',
      [req.params.id, created_by]
    );
    if (!rowCount) return res.status(404).json({ error: 'Event not found' });
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// === VOLUNTEER ASSIGNMENTS ===

// Assign a volunteer to an event (coordinator only)
app.post(
  '/events/:eventId/assign',
  requireRole(ROLES.COORDINATOR),
  async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    try {
      const { rows: ev } = await pool.query(
        'SELECT created_by FROM events WHERE id = $1',
        [req.params.eventId]
      );
      if (!ev.length) return res.status(404).json({ error: 'Event not found' });

      const coordinator = await getUser(ev[0].created_by);
      if (!coordinator || coordinator.role !== 'coordinator') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { rows } = await pool.query(
        `INSERT INTO volunteer_assignments (event_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (event_id, user_id) DO NOTHING
         RETURNING *`,
        [req.params.eventId, userId]
      );
      if (!rows.length) return res.status(409).json({ error: 'Already assigned' });
      res.status(201).json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Delete an assignment (coordinator only)
app.delete(
  '/assignments/:id',
  requireRole(ROLES.COORDINATOR),
  async (req, res) => {
    try {
      const { rows: assign } = await pool.query(
        `SELECT va.*, e.created_by
           FROM volunteer_assignments va
           JOIN events e ON va.event_id = e.id
          WHERE va.id = $1`,
        [req.params.id]
      );
      if (!assign.length) return res.status(404).json({ error: 'Assignment not found' });

      const coordinator = await getUser(assign[0].created_by);
      if (!coordinator || coordinator.role !== 'coordinator') {
        return res.status(403).json({ error: 'Forbidden' });
      }

      await pool.query('DELETE FROM volunteer_assignments WHERE id = $1', [
        req.params.id,
      ]);
      res.sendStatus(204);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// Update assignment status (volunteer only)
// userId is taken from body or req.user.id
app.patch(
  '/assignments/:id/status',
  requireRole(ROLES.VOLUNTEER),
  async (req, res) => {
    const { status } = req.body;
    let { userId } = req.body;
    if (!userId && req.user?.id) userId = req.user.id;

    if (!['accepted', 'tentative', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const volunteer = await getUser(userId);
    if (!volunteer || volunteer.role !== 'volunteer') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE volunteer_assignments
            SET status = $1, updated_at = now()
          WHERE id = $2 AND user_id = $3
        RETURNING *`,
        [status, req.params.id, userId]
      );
      if (!rows.length) return res.status(404).json({ error: 'Assignment not found' });
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// === START SERVER ===
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
