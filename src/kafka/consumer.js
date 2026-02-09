require("dotenv").config();

const { Pool } = require("pg");

const pgPool = new Pool({
  host: "localhost",
  port: 5432,
  user: "chatuser",
  password: "chatpassword",
  database: "chatdb",
});

const { Kafka } = require("kafkajs"); // import kafka
const { sendEmail } = require("../services/emailService"); // email notification when message is received

// ✅ ADDED: Redis
const { createClient } = require("redis");

const redisClient = createClient();

redisClient.on("error", (err) => {
  console.error("❌ Redis Client Error", err);
});
// ✅ END ADD

const kafka = new Kafka({
  clientId: "chat-consumer",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({
  groupId: "chat-message-processors", // consumers in same group share work
});

async function run() {
  // 0️⃣ Connect Redis FIRST
  await redisClient.connect();
  console.log("✅ Redis connected (consumer)");

  // 1️⃣ Connect to Kafka
  await consumer.connect();
  console.log("✅ Kafka consumer connected");

  // 2️⃣ Subscribe to topic
  await consumer.subscribe({
    topic: "chat.messages",
    fromBeginning: false,
  });

  console.log("📡 Subscribed to chat.messages");

  // 3️⃣ Start consuming messages
  await consumer.run({
    eachMessage: async ({ message }) => {
      // 1️⃣ Convert Kafka buffer to JS object
      const value = message.value.toString();
      const chatEvent = JSON.parse(value);

      console.log("📥 Received message:", chatEvent);

      // 2️⃣ Store in PostgreSQL
      try {
        await pgPool.query(
          `
          INSERT INTO messages (sender_id, receiver_id, content, created_at)
          VALUES ($1, $2, $3, to_timestamp($4 / 1000.0))
          `,
          [chatEvent.from, chatEvent.to, chatEvent.text, chatEvent.timestamp],
        );

        console.log("💾 Message stored in PostgreSQL");
      } catch (err) {
        console.error("❌ Failed to store message in PostgreSQL:", err);
        return;
      }

      // 3️⃣ Check if receiver is offline
      const isOnline = await redisClient.get(`user:${chatEvent.to}:online`);

      if (!isOnline) {
        console.log(`📧 User ${chatEvent.to} is offline. Sending email...`);

        // 4️⃣ Fetch receiver email + name
        const receiverResult = await pgPool.query(
          "SELECT email, name FROM users WHERE id = $1",
          [chatEvent.to],
        );

        if (receiverResult.rows.length === 0) {
          console.log("❌ Receiver not found in DB");
          return;
        }

        // 5️⃣ Fetch sender name (nice UX)
        const senderResult = await pgPool.query(
          "SELECT name FROM users WHERE id = $1",
          [chatEvent.from],
        );

        const receiverEmail = receiverResult.rows[0].email;
        const receiverName = receiverResult.rows[0].name;
        const senderName =
          senderResult.rows[0]?.name || `User ${chatEvent.from}`;

        try {
          console.log("📨 Email will be sent to:", receiverEmail);

          await sendEmail({
            to: receiverEmail,
            subject: "New chat message",
            text: `Hi ${receiverName},

You have a new message from ${senderName}:

"${chatEvent.text}"

Open the chat to reply.`,
          });
        } catch (err) {
          console.error("❌ Failed to send email:", err);
        }
      }
    },
  });
}

run().catch(console.error);
