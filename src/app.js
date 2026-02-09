const { Pool } = require("pg");

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

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/messages", async (req, res) => {
  const authHeader = req.headers.authorization;

  //JWT Authentication for End to End Encryption
  if (!authHeader) {
    return res.status(401).json({
      error: "Authorization header missing",
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      error: "Invalid authorization format",
    });
  }

  const token = parts[1];

  // Verify the token and extract user information
  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({
      error: "Invalid or expired token",
    });
  }

  const authenticatedUserId = payload.userId;
  //end authentication, proceed with fetching messages

  const { user1, user2 } = req.query;
  //only allow access if authenticated user is part of the conversation (either user1 or user2)
  if (
    authenticatedUserId !== Number(user1) &&
    authenticatedUserId !== Number(user2)
  ) {
    return res.status(403).json({
      error: "Forbidden",
    });
  }
  //end authorization

  if (!user1 || !user2) {
    return res.status(400).json({ error: "user1 and user2 are required" });
  }

  const limit = parseInt(req.query.limit) || 20; // Get limit from query params, default to 20
  const offset = parseInt(req.query.offset) || 0; // Get offset from query params, default to 0

  try {
    const result = await pgPool.query(
      `
      SELECT sender_id, receiver_id, content, created_at
      FROM messages
      WHERE (sender_id = $1 AND receiver_id = $2) 
      OR
      (sender_id = $2 AND receiver_id = $1)
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
      `,
      [user1, user2, limit, offset],
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Failed to fetch messages:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = app;
