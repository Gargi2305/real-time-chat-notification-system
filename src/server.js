require("dotenv").config();

const { sendChatMessage } = require("./kafka/chatProducer"); //importing kafka function

const http = require("http"); //Node’s built-in HTTP module.
//Express sits on top of HTTP and WebSockets hook into HTTP during upgrade

const WebSocket = require("ws");
//Handles WS protocol and Emits connection, message, close
const jwt = require("jsonwebtoken"); //For verifying JWT tokens sent by clients during WS connection

const { createClient } = require("redis"); //import redis client

const app = require("./app");

const PORT = process.env.PORT || 3000;

const redisClient = createClient(); //creates a new redis client instance

// In-memory map: userId -> WebSocket
const userSockets = new Map();

redisClient.on("error", (err) => {
  console.error("❌ Redis Client Error", err); //logs Redis issues (.on("error"))
});

redisClient
  .connect() //connects to the Redis server (.connect)
  .then(() => {
    console.log("✅ Connected to Redis");
  });

// 1. Create HTTP server from Express app
const server = http.createServer(app);
//Creates a real HTTP server and Uses your Express app to handle HTTP routes

// 2. Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

// 3. Listen for WebSocket connections // Triggered when a client connects
wss.on("connection", async (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token"); //extracts token from URL by client

  //if token is missing or invalid, close the connection
  if (!token) {
    console.log("❌ No token provided. Closing connection.");
    ws.close();
    return;
  }

  // Verify the token

  let payload;

  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.log("❌ Invalid token. Closing connection.");
    ws.close();
    return;
  }

  console.log("✅ JWT verified. Payload:", payload);
  ws.user = payload;

  userSockets.set(ws.user.userId, ws); // store the WebSocket connection in the map with userId as key

  await redisClient.set(`user:${ws.user.userId}:online`, "1", { EX: 30 }); // we used async on wss.on to use await here
  console.log(`🟢 User ${ws.user.userId} marked online`);

  //end verification, proceed with connection

  console.log("✅ WebSocket client connected");

  // Heartbeat: refresh presence TTL every 10 seconds
  ws.heartbeat = setInterval(async () => {
    await redisClient.set(`user:${ws.user.userId}:online`, "1", { EX: 30 });
    // console.log(`💓 Heartbeat refreshed for user ${ws.user.userId}`);
  }, 10_000);

  //heartbeat done

  // 4. Listen for messages// Triggered when a client sends a message
  ws.on("message", async (message) => {
    const chatEvent = {
      from: ws.user.userId,
      to: 2, // TEMPORARY receiver (hardcoded for now)
      text: message.toString(),
      timestamp: Date.now(),
    };

    // 1. Publish to Kafka (always)
    await sendChatMessage(chatEvent);
    console.log("📤 Message published to Kafka");

    // 2. Temporary delivery logic (existing)
    const receiverUserId = 2; // still hardcoded for now
    const isOnline = await redisClient.get(`user:${receiverUserId}:online`);

    if (isOnline) {
      const receiverSocket = userSockets.get(receiverUserId);
      if (receiverSocket) {
        receiverSocket.send(
          `📨 Message from user ${ws.user.userId}: ${message}`,
        );
      }
    }

    // 3. Echo back to sender
    ws.send(`Echo: ${message}`);
  });

  // 5. Handle disconnect // Triggered when a client disconnects
  ws.on("close", async () => {
    // await redisClient.del(`user:${ws.user.userId}:online`); ealier code for// mark user offline on disconnect
    clearInterval(ws.heartbeat); // stop heartbeats
    userSockets.delete(ws.user.userId); // remove from map
    await redisClient.del(`user:${ws.user.userId}:online`); // this is code with TTL of 30s to mark user offline after 30s of disconnection instead of running forever like above code did
    console.log(`🔴 User ${ws.user.userId} marked offline`);
  });
});

// 6. Start the server
server.listen(PORT, () => {
  console.log(`HTTP + WS server running on port ${PORT}`);
});
