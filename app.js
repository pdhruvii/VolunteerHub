const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
// require("dotenv").config();

const app = express();
// const PORT = process.env.PORT || 3000;

app.use(express.json());

// === DATABASE ===
const pool = new Pool({
  host: process.env.DB_HOST || "db",
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const authMiddleware = (req, res, next) => {
  const publicPaths = ["/register", "/login"];
  if (req.method === "GET" && req.path.startsWith("/health")) return next();
  if (req.method === "POST" && publicPaths.includes(req.path)) return next();

  if (!process.env.API_KEY) {
    return res.status(500).json({ error: "API key not configured on server" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.API_KEY}`) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }

  next();
};
app.use(authMiddleware);

app.get("/health/alive", (_, res) => res.sendStatus(200));
app.get("/health/db", async (_, res) => {
  try {
    await pool.query("SELECT 1");
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

const getUser = async (id) => {
  const { rows } = await pool.query("SELECT id, role FROM users WHERE id = $1", [id]);
  return rows[0] || null;
};

app.post("/register", async (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name || !role)
    return res.status(400).json({ error: "All fields required" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: "Invalid email" });
  if (password.length < 6)
    return res.status(400).json({ error: "Password too short" });
  if (!["coordinator", "volunteer"].includes(role))
    return res.status(400).json({ error: "Invalid role" });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [email, hash, name, role]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err) {
    if (err.code === "23505")
      return res.status(409).json({ error: "Email already exists" });
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!rows.length) return res.status(401).json({ error: "Invalid credentials" });
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    res.json({ message: "Login successful", userId: user.id, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/events", async (req, res) => {
  const { title, description, event_date, start_time, end_time, location, created_by } = req.body;
  if (!title || !description || !event_date || !start_time || !end_time || !location || !created_by)
    return res.status(400).json({ error: "All fields required" });

  const user = await getUser(created_by);
  if (!user || user.role !== "coordinator")
    return res.status(403).json({ error: "Forbidden" });

  try {
    const { rows } = await pool.query(
      `INSERT INTO events (title, description, event_date, start_time, end_time, location, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, event_date, start_time, end_time, location, created_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/events", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM events ORDER BY event_date");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/events/:id", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM events WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: "Event not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/events/:id", async (req, res) => {
  const { created_by } = req.body;
  if (!created_by) return res.status(400).json({ error: "created_by required" });

  const user = await getUser(created_by);
  if (!user || user.role !== "coordinator")
    return res.status(403).json({ error: "Forbidden" });

  const updates = {};
  const allowed = ["title", "description", "event_date", "start_time", "end_time", "location"];
  for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k];
  if (!Object.keys(updates).length) return res.status(400).json({ error: "No updates" });

  const sets = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
  const values = Object.values(updates);
  values.push(req.params.id, created_by);

  try {
    const { rows } = await pool.query(
      `UPDATE events SET ${sets.join(", ")}
       WHERE id = $${values.length - 1} AND created_by = $${values.length}
       RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: "Event not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/events/:id", async (req, res) => {
  const { created_by } = req.body;
  if (!created_by) return res.status(400).json({ error: "created_by required" });

  const user = await getUser(created_by);
  if (!user || user.role !== "coordinator")
    return res.status(403).json({ error: "Forbidden" });

  try {
    const { rowCount } = await pool.query(
      "DELETE FROM events WHERE id = $1 AND created_by = $2",
      [req.params.id, created_by]
    );
    if (!rowCount) return res.status(404).json({ error: "Event not found" });
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/events/:eventId/assign", async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    const { rows: ev } = await pool.query("SELECT created_by FROM events WHERE id = $1", [req.params.eventId]);
    if (!ev.length) return res.status(404).json({ error: "Event not found" });
    const coordinator = await getUser(ev[0].created_by);
    if (!coordinator || coordinator.role !== "coordinator")
      return res.status(403).json({ error: "Forbidden" });

    const { rows } = await pool.query(
      `INSERT INTO volunteer_assignments (event_id, user_id)
       VALUES ($1, $2) ON CONFLICT (event_id, user_id) DO NOTHING
       RETURNING *`,
      [req.params.eventId, userId]
    );
    if (!rows.length) return res.status(409).json({ error: "Already assigned" });
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/assignments/:id", async (req, res) => {
  try {
    const { rows: assign } = await pool.query(
      `SELECT va.*, e.created_by FROM volunteer_assignments va
       JOIN events e ON va.event_id = e.id
       WHERE va.id = $1`,
      [req.params.id]
    );
    if (!assign.length) return res.status(404).json({ error: "Assignment not found" });

    const coordinator = await getUser(assign[0].created_by);
    if (!coordinator || coordinator.role !== "coordinator")
      return res.status(403).json({ error: "Forbidden" });

    await pool.query("DELETE FROM volunteer_assignments WHERE id = $1", [req.params.id]);
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/assignments/:id/status", async (req, res) => {
  const { status, userId } = req.body;
  if (!["accepted", "tentative", "declined"].includes(status))
    return res.status(400).json({ error: "Invalid status" });
  if (!userId) return res.status(400).json({ error: "userId required" });

  const volunteer = await getUser(userId);
  if (!volunteer || volunteer.role !== "volunteer")
    return res.status(403).json({ error: "Forbidden" });

  try {
    const { rows } = await pool.query(
      `UPDATE volunteer_assignments SET status = $1
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [status, req.params.id, userId]
    );
    if (!rows.length) return res.status(404).json({ error: "Assignment not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// === START SERVER ===
// app.listen(PORT, () => {
//   console.log(`VolunteerHub running on http://0.0.0.0:${PORT}`);
// });
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});