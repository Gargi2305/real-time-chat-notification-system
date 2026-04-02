const cors = require("cors");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const pgPool = new Pool({
  host: "localhost",
  port: 5432,
  user: "chatuser",
  password: "chatpassword",
  database: "chatdb",
});

const express = require("express");

const app = express();

app.use(express.json());
app.use(cors()); // Enable CORS for all routes

// ================= AUTH ROUTES =================

// 🔐 Signup API
//const bcrypt = require("bcrypt");
app.get("/users/by-email", async (req, res) => {
  const { email } = req.query;

  const result = await pgPool.query("SELECT id FROM users WHERE email = $1", [
    email,
  ]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ id: result.rows[0].id });
});

app.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    await pgPool.query(
      "INSERT INTO users (name, email, password) VALUES ($1, $2, $3)",
      [name, email, hashedPassword],
    );

    res.status(201).json({ message: "User created" });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already exists" });
    }

    console.error("❌ Signup error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 🔐 Login API
//const bcrypt = require("bcrypt");

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pgPool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
    );

    res.json({ token });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// ================= EXISTING ROUTES =================

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/messages", async (req, res) => {
  const authHeader = req.headers.authorization;

  // 🔐 AUTH CHECK
  if (!authHeader) {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Invalid authorization format" });
  }

  let payload;
  try {
    payload = jwt.verify(parts[1], process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const authenticatedUserId = payload.userId;

  const { user1, user2 } = req.query;
  // user1 = myId, user2 = EMAIL

  if (!user1 || !user2) {
    return res.status(400).json({ error: "user1 and user2 are required" });
  }

  try {
    // 🔥 Convert email → id
    const user2Result = await pgPool.query(
      "SELECT id FROM users WHERE email = $1",
      [user2],
    );

    if (user2Result.rows.length === 0) {
      return res.json([]); // no messages if user not found
    }

    const user2Id = user2Result.rows[0].id;

    // 🔐 AUTHORIZATION CHECK
    if (
      authenticatedUserId !== Number(user1) &&
      authenticatedUserId !== user2Id
    ) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const result = await pgPool.query(
      `
      SELECT sender_id, receiver_id, content, created_at
      FROM messages
      WHERE 
        (sender_id = $1 AND receiver_id = $2)
        OR
        (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at ASC
      LIMIT $3 OFFSET $4
      `,
      [user1, user2Id, limit, offset],
    );

    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Failed to fetch messages:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = app;
app.locals.pgPool = pgPool;
