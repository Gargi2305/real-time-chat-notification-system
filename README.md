# Real-Time Chat & Notification System

A backend system for real-time one-to-one messaging built using WebSockets, with user presence tracking and an event-driven architecture for message delivery and notifications.

## Overview
This project aims to design and implement the core backend components of a scalable real-time chat system. It focuses on low-latency message delivery, reliable storage, and decoupled communication using asynchronous messaging.

## Tech Stack
- Language: JavaScript / Python
- Backend: Node.js / FastAPI
- Real-Time Communication: WebSockets
- Database: PostgreSQL
- Caching & Presence: Redis
- Messaging: Kafka
- Authentication: JWT

## Key Features
- WebSocket-based real-time messaging for low-latency communication
- REST APIs for user management and chat initialization
- JWT-based authentication and secure session handling
- Redis-based user presence tracking with TTL-managed online/offline states
- Event-driven message pipeline using Kafka for decoupled delivery and notifications

## Architecture
The system separates message ingestion from delivery using an event-driven design. WebSockets handle live communication, PostgreSQL ensures durable storage, Redis manages presence state, and Kafka enables scalable asynchronous processing.

Detailed system design and flow diagrams are documented in the `/docs` directory.

## Current Status
🚧 In active development  
Core architecture and APIs defined. Incremental implementation in progress.

## Planned Enhancements
- Message delivery acknowledgements
- Offline message handling
- Notification service integration
- Horizontal scaling and load testing
