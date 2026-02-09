# 🚀 Real-Time Chat & Notification System

A scalable **real-time chat and notification backend** built using **WebSockets, Kafka, Redis, PostgreSQL, and Email notifications**.  
Designed to support **online/offline users**, asynchronous message processing, and durable message storage.

---

## ✨ Features

- 🔐 JWT-authenticated WebSocket connections  
- 💬 Real-time chat using WebSockets  
- 📨 Asynchronous message handling with Apache Kafka  
- 🗄 Persistent message storage in PostgreSQL  
- 🟢 Online/offline presence tracking using Redis (TTL + heartbeat)  
- 📧 Email notifications for offline users  
- 📜 Chat history REST API with pagination  
- ⚙️ Dockerized Kafka & Zookeeper  
- 📈 Horizontally scalable using Kafka consumer groups  

---

## 🏗 Architecture Overview

Client (WebSocket)
|
v
WebSocket Server (Node.js)
|
|--> Redis (online/offline presence)
|--> Kafka Producer (chat.messages topic)
|
v
Kafka Consumer
|
+-----------+-----------+
| |
PostgreSQL Email Service
(message storage) (offline notification)


---

## 🧩 Tech Stack

| Layer | Technology |
|------|------------|
| Runtime | Node.js |
| Real-time | WebSocket (`ws`) |
| Messaging | Apache Kafka |
| Presence | Redis |
| Database | PostgreSQL |
| Authentication | JWT |
| Notifications | Nodemailer (Gmail SMTP) |
| Infra | Docker, Docker Compose |

---

## 📂 Project Structure

src/
├── app.js # Express app (REST APIs)
├── server.js # HTTP + WebSocket server
├── kafka/
│ ├── chatProducer.js # Kafka producer
│ └── consumer.js # Kafka consumer
├── services/
│ └── emailService.js # Reusable email sender
├── utils/ # Helper utilities
└── ...


---

## 🔐 Authentication

All WebSocket connections require a **JWT token**.

Connection format:
ws://localhost:3000?token=<JWT_TOKEN>

Example JWT payload:
```json
{
  "userId": 2,
  "name": "gargi"
}
```
🔄 Message Flow
Client sends a message via WebSocket

Server publishes message to Kafka

Kafka consumer:

Stores message in PostgreSQL

Checks Redis for receiver presence

Sends email if receiver is offline

If receiver is online → message delivered instantly

📬 Offline Email Notifications
Emails are sent only if the receiver is offline

Receiver email is fetched dynamically from the users table

No hardcoded recipient emails

Uses Gmail SMTP via Nodemailer

Example email:

Hi user3,

You have a new message from user2:

"Hello "

Open the chat to reply.

🗃 Database Schema
users
id | name     | email
---+----------+-------------------------
1  | server   | realtime.chat.notify@gmail.com
2  | user1    | user1_email@gmail.com


messages
id | sender_id | receiver_id | content | created_at

📡 REST APIs
Health Check
GET /health

Fetch Chat History
GET /messages?user1=1&user2=2&limit=20&offset=0


Supports:

Pagination (limit, offset)

JWT authentication

🐳 Kafka Setup (Docker)

Start Kafka & Zookeeper:

docker-compose up -d


Ports:

Kafka → localhost:9092

Zookeeper → localhost:2181

🚀 Running the Project
1️⃣ Install dependencies
npm install

2️⃣ Start Redis
redis-server

3️⃣ Start PostgreSQL
docker start postgres

4️⃣ Run Kafka consumer
node src/kafka/consumer.js

5️⃣ Run server
npm run dev

🔒 Environment Variables
JWT_SECRET=supersecretkey
EMAIL_USER=realtime.chat.notify@gmail.com
EMAIL_PASS=your_app_password


⚠️ .env is gitignored and should never be committed.

📈 Scalability Notes

Kafka consumer groups enable horizontal scaling

Redis TTL ensures automatic offline detection

Stateless WebSocket server design

Easily extendable to push notifications & mobile apps

🎯 Future Enhancements

Message delivery acknowledgements

Read receipts

Typing indicators

Push notifications (FCM / APNs)

User authentication APIs

Monitoring & rate limiting

👩‍💻 Author

Gargi Jain
