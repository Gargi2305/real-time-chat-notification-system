const { Pool } = require("pg");

const pgPool = new Pool({
  host: "localhost",
  port: 5432,
  user: "chatuser",
  password: "chatpassword",
  database: "chatdb",
});

const { Kafka } = require("kafkajs");

// 1. Create Kafka client
const kafka = new Kafka({
  clientId: "chat-service",
  brokers: ["localhost:9092"],
});

// 2. Create producer instance
const producer = kafka.producer();

// 3. Connect producer ONCE
let isConnected = false; //producer connects only once when server is started,, and not per message

async function connectProducer() {
  if (!isConnected) {
    await producer.connect(); //this is "Lazy Connection" pattern, we connect when first message is sent,, and then for later messages we reuse the connection!
    isConnected = true;
    console.log("✅ Kafka producer connected (chat service)");
  }
}

// 4. Function to send chat message event to Kafka
async function sendChatMessage(event) {
  await connectProducer();

  await producer.send({
    //this is the actual sending of message to kafka, we specify the topic and the message payload
    topic: "chat.messages",
    messages: [
      {
        value: JSON.stringify(event),
      },
    ],
  });
}

module.exports = {
  sendChatMessage,
}; //by exporting sendChatMessage function, we allow server.js to call it
