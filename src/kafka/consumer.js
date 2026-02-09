require("dotenv").config();

const { Pool } = require("pg");

const pgPool = new Pool({
  host: "localhost",
  port: 5432,
  user: "chatuser",
  password: "chatpassword",
  database: "chatdb",
});

const { Kafka } = require("kafkajs"); //import kafka

const { sendEmail } = require("../services/emailService"); //email notification when message is received

// ✅ ADDED: Redis
const { createClient } = require("redis");

const redisClient = createClient();

redisClient.on("error", (err) => {
  console.error("❌ Redis Client Error", err);
});

redisClient.connect().then(() => {
  console.log("✅ Redis connected (consumer)");
});
// ✅ END ADD

const kafka = new Kafka({
  //kafka instance
  clientId: "chat-consumer",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({
  groupId: "chat-message-processors", //creates a consumer instance with a group ID. Consumers in the same group share work / each message is processed by only one consumer in the group / enables horizontal scaling by adding more consumer instances to the same group
});

async function run() {
  // 1. Connect to Kafka
  await consumer.connect();
  console.log("✅ Kafka consumer connected");

  // 2. Subscribe to topic
  await consumer.subscribe({
    topic: "chat.messages", //tells what to read
    fromBeginning: false, //reads all past messages from the beginning of the topic.
  });

  console.log("📡 Subscribed to chat.messages");

  // 3. Start consuming messages
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
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
        return; // Exit early if DB operation fails
      }

      // ✅ ADDED: Online / offline detection (NO EMAIL YET)
      // 3️⃣ Check if receiver is offline
      const isOnline = await redisClient.get(`user:${chatEvent.to}:online`);

      if (!isOnline) {
        console.log(`📧 User ${chatEvent.to} is offline. Sending email...`);

        try {
          console.log(
            "📨 Email will be sent to:",
            process.env.TEST_RECEIVER_EMAIL,
          );

          await sendEmail({
            to: process.env.TEST_RECEIVER_EMAIL,
            subject: "New chat message",
            text: `You have a new message from user ${chatEvent.from}: ${chatEvent.text}`,
          });
        } catch (err) {
          console.error("❌ Failed to send email:", err);
        }
      }
      // ✅ END ADD
    },
  });
}

run().catch(console.error);
