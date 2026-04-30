const cors = require("cors");
require("dotenv").config();

const { sendChatMessage } = require("./kafka/chatProducer");
const { sendEmailNotification } = require("./services/emailService");

const http = require("http");
const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
//const { createClient } = require("redis"); -- for deployment

const app = require("./app");

const PORT = process.env.PORT || 3000;

//const redisClient = createClient(); -- for deployment

// In-memory map: userId -> WebSocket
const userSockets = new Map();

// -- for deployment //  redisClient.on("error", (err) => {
//   console.error("❌ Redis Client Error", err);
// });

// redisClient.connect().then(() => {
//   console.log("✅ Connected to Redis");
// });  -- for deployment

//new code for deployment without redis

const { createClient } = require("redis");

let redisClient = null;

if (process.env.NODE_ENV !== "production") {
  redisClient = createClient();

  redisClient.on("error", (err) => {
    console.error("❌ Redis Client Error", err);
  });

  redisClient.connect().then(() => {
    console.log("✅ Connected to Redis");
  });
} else {
  console.log("⚠️ Redis disabled in production");
}

// Create HTTP server
const server = http.createServer(app);

// Attach WebSocket
const wss = new WebSocket.Server({ server });

// WebSocket connection
wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    console.log("❌ No token provided");
    ws.close();
    return;
  }

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.log("❌ Invalid token");
    ws.close();
    return;
  }

  console.log("✅ JWT verified:", payload);

  ws.user = payload;
  userSockets.set(ws.user.userId, ws);

  // await redisClient.set(`user:${ws.user.userId}:online`, "1", { EX: 30 }); -- for deployment
  if (redisClient) {
    await redisClient.set(`user:${ws.user.userId}:online`, "1", { EX: 30 });
  }
  // console.log(`🟢 User ${ws.user.userId} online`); -- for deployment
  if (redisClient) {
    console.log(`🟢 User ${ws.user.userId} online`);
  }

  console.log("✅ WebSocket connected");

  // Heartbeat
  ws.heartbeat = setInterval(async () => {
    // await redisClient.set(`user:${ws.user.userId}:online`, "1", { EX: 30 }); -- for deployment

    if (redisClient) {
      await redisClient.set(`user:${ws.user.userId}:online`, "1", { EX: 30 });
    }
  }, 10000);

  // MESSAGE HANDLER
  // MESSAGE HANDLER
  ws.on("message", async (message) => {
    try {
      const parsed = JSON.parse(message.toString());

      // 🔍 Convert email → userId
      const result = await app.locals.pgPool.query(
        "SELECT id FROM users WHERE email = $1",
        [parsed.to],
      );

      if (result.rows.length === 0) {
        ws.send(JSON.stringify({ type: "error", message: "User not found" }));
        return;
      }

      const receiverUserId = result.rows[0].id;

      const chatEvent = {
        from: ws.user.userId,
        to: receiverUserId,
        text: parsed.text,
        timestamp: Date.now(),
      };

      // 🔥 Kafka
      try {
        await sendChatMessage(chatEvent);
        console.log("📤 Message published to Kafka");
      } catch (err) {
        console.error("❌ Kafka failed:", err.message);
      }

      // ✅ Save to DB
      // await app.locals.pgPool.query(
      //   `INSERT INTO messages (sender_id, receiver_id, content)
      //  VALUES ($1, $2, $3)`,
      //   [ws.user.userId, receiverUserId, parsed.text],
      // );

      // 🔍 Get receiver socket
      const receiverSocket = userSockets.get(receiverUserId);

      // 🔍 Get sender name
      const senderResult = await app.locals.pgPool.query(
        "SELECT name FROM users WHERE id = $1",
        [ws.user.userId],
      );

      const senderName = senderResult.rows[0]?.name || "Unknown";

      // ✅ ALWAYS send back to sender
      ws.send(
        JSON.stringify({
          type: "message",
          from: ws.user.userId,
          senderName,
          text: parsed.text,
          timestamp: Date.now(),
        }),
      );

      // ✅ IF receiver online → send
      if (receiverSocket) {
        receiverSocket.send(
          JSON.stringify({
            type: "message",
            from: ws.user.userId,
            senderName,
            text: parsed.text,
            timestamp: Date.now(),
          }),
        );
      } else {
        // 📧 Email fallback
        console.log("📴 User offline → sending email");

        const receiverResult = await app.locals.pgPool.query(
          "SELECT email FROM users WHERE id = $1",
          [receiverUserId],
        );

        const receiverEmail = receiverResult.rows[0]?.email;

        if (receiverEmail) {
          try {
            await sendEmailNotification(receiverEmail, senderName, parsed.text);
            console.log("📧 Email sent successfully");
          } catch (err) {
            console.error("❌ Email failed:", err);
          }
        }
      }
    } catch (err) {
      console.error("❌ Message handler error:", err);
    }
  });

  // DISCONNECT
  ws.on("close", async () => {
    clearInterval(ws.heartbeat);
    userSockets.delete(ws.user.userId);

    // await redisClient.del(`user:${ws.user.userId}:online`); -- for deployment
    if (redisClient) {
      await redisClient.del(`user:${ws.user.userId}:online`);
    }

    console.log(`🔴 User ${ws.user.userId} offline`);
  });
});

// START SERVER
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
