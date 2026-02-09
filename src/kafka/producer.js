const { Pool } = require("pg");

const pgPool = new Pool({
  host: "localhost",
  port: 5432,
  user: "chatuser",
  password: "chatpassword",
  database: "chatdb",
});

const { Kafka } = require("kafkajs"); //import kafkacliet

const kafka = new Kafka({
  //create kafka instance,,
  clientId: "chat-service",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer(); //creates a producer instance

async function run() {
  //used async function as we will use await for producer calls
  // 1. Connect producer to Kafka
  await producer.connect();
  console.log("✅ Kafka producer connected"); //connects to the Kafka cluster (.connect) and logs success message

  // 2. Send a test message
  await producer.send({
    topic: "chat.messages", //event goes here
    messages: [
      //array containing message to send with key and value
      {
        key: "user-1-to-user-2", //used for partitioning and message ordering
        value: JSON.stringify({
          //value is the event data
          from: 1,
          to: 2,
          text: "Hello from Kafka producer",
          timestamp: Date.now(),
        }),
      },
    ],
  });

  console.log("📤 Message sent to Kafka");

  // 3. Disconnect cleanly
  await producer.disconnect();
  console.log("🔌 Kafka producer disconnected");
}

run().catch(console.error); //error handling
