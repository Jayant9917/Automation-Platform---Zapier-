# Architecture Documentation

## Overview

This project implements a Zapier-like automation platform using a microservices architecture with event-driven communication. The system allows users to create automated workflows (Zaps) that connect triggers to actions, enabling automation across different services and platforms.

## System Architecture

```
┌─────────────┐
│   Frontend  │ (Next.js)
│  (Port 3001)│
└──────┬──────┘
       │ HTTP/REST
       │
┌──────▼──────────────┐
│ Primary Backend     │ (Express.js)
│ (Port 3000)         │
│ - User Management   │
│ - Zap CRUD          │
│ - Authentication    │
└──────┬──────────────┘
       │
       │ PostgreSQL
       │
┌──────▼──────────────┐
│   PostgreSQL DB     │
│  - Users            │
│  - Zaps             │
│  - Triggers         │
│  - Actions          │
│  - ZapRuns          │
│  - ZapRunOutbox     │
└─────────────────────┘

┌─────────────┐
│   Hooks     │ (Express.js)
│ (Port 8000) │
│ - Webhook   │
│   Receiver  │
└──────┬──────┘
       │
       │ Writes to DB
       │
┌──────▼──────────────┐
│   PostgreSQL DB     │
│  (ZapRunOutbox)     │
└─────────────────────┘

┌─────────────┐
│  Processor  │ (Kafka Producer)
│             │
│ - Polls     │
│   Outbox    │
│ - Publishes │
│   to Kafka  │
└──────┬──────┘
       │
       │ Kafka Messages
       │
┌──────▼──────────────┐
│   Kafka Broker      │
│   (zap-events)      │
└──────┬──────────────┘
       │
       │ Consumes Messages
       │
┌──────▼──────────────┐
│    Worker           │ (Kafka Consumer)
│                     │
│ - Consumes Events   │
│ - Executes Actions  │
│   (Email, SOL, etc) │
└─────────────────────┘
```

## Components

### 1. Frontend (Next.js)

**Location:** `frontend/`

**Purpose:** User interface for creating and managing Zaps

**Key Features:**
- User authentication (signup/signin)
- Zap creation and management dashboard
- Trigger and action selection UI
- Real-time Zap status

**Technology Stack:**
- Next.js 14
- React 18
- Tailwind CSS
- TypeScript

**Configuration:**
- `BACKEND_URL`: Points to primary-backend API
- `HOOKS_URL`: Points to hooks service for webhook URLs

### 2. Primary Backend (Express.js)

**Location:** `primary-backend/`

**Purpose:** Main API server handling user management, authentication, and Zap CRUD operations

**Key Responsibilities:**
- User registration and authentication (JWT-based)
- Zap creation, retrieval, and management
- Trigger and action metadata management
- API route handling

**API Endpoints:**
- `/api/v1/user/*` - User management endpoints
- `/api/v1/zap/*` - Zap management endpoints
- `/api/v1/trigger/*` - Trigger metadata endpoints
- `/api/v1/action/*` - Action metadata endpoints

**Technology Stack:**
- Express.js
- Prisma ORM
- PostgreSQL
- JWT for authentication
- Zod for validation

**Port:** 3000

**Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_PASSWORD`: Secret for JWT token signing

### 3. Hooks Service

**Location:** `hooks/`

**Purpose:** Receives webhook events from external services and triggers Zap executions

**Key Responsibilities:**
- Receive webhook POST requests
- Create ZapRun records in the database
- Create ZapRunOutbox entries for event processing
- Transactional consistency (uses database transactions)

**Endpoint:**
- `POST /hooks/catch/:userId/:zapId` - Webhook receiver endpoint

**Technology Stack:**
- Express.js
- Prisma ORM
- PostgreSQL

**Port:** 8000

**Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string

**Flow:**
1. External service sends webhook to `/hooks/catch/:userId/:zapId`
2. Service creates a `ZapRun` record with webhook metadata
3. Service creates a `ZapRunOutbox` entry (transactional)
4. Processor picks up the outbox entry and publishes to Kafka

### 4. Processor Service

**Location:** `processor/`

**Purpose:** Implements the Outbox Pattern - polls the database for pending ZapRunOutbox entries and publishes them to Kafka

**Key Responsibilities:**
- Poll `ZapRunOutbox` table for pending entries
- Publish ZapRun IDs to Kafka topic `zap-events`
- Delete processed outbox entries
- Ensures reliable message delivery

**Technology Stack:**
- KafkaJS (Producer)
- Prisma ORM with PostgreSQL adapter
- PostgreSQL

**Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string
- `KAFKAJS_NO_PARTITIONER_WARNING`: Suppress warnings (optional)

**Flow:**
1. Continuously polls `ZapRunOutbox` table (batch of 10)
2. Publishes each ZapRun ID to Kafka topic `zap-events`
3. Deletes processed outbox entries
4. Repeats indefinitely

**Why Outbox Pattern?**
- Ensures transactional consistency
- Prevents message loss if Kafka is temporarily unavailable
- Allows retry logic for failed publishes

### 5. Worker Service

**Location:** `worker/`

**Purpose:** Consumes Kafka messages and executes Zap actions

**Key Responsibilities:**
- Consume messages from Kafka topic `zap-events`
- Parse ZapRun data from database
- Execute actions (Email, Solana transfers, etc.)
- Handle action failures gracefully

**Technology Stack:**
- KafkaJS (Consumer)
- Nodemailer (Email actions)
- Solana Web3.js (SOL transfer actions)
- Custom parser for template variables

**Environment Variables:**
- `SMTP_ENDPOINT`: SMTP server hostname
- `SMTP_USERNAME`: SMTP authentication username
- `SMTP_PASSWORD`: SMTP authentication password
- `SOL_PRIVATE_KEY`: Base58 encoded Solana private key

**Flow:**
1. Consumes messages from `zap-events` topic
2. Extracts ZapRun ID from message
3. Fetches ZapRun and associated Zap from database
4. Retrieves Zap's actions in order
5. Executes each action with parsed metadata
6. Commits Kafka offset after successful processing

**Supported Actions:**
- **Email**: Sends email via SMTP using Nodemailer
- **Solana Transfer**: Sends SOL tokens using Solana Web3.js
- **Extensible**: New actions can be added by implementing action handlers

### 6. Database (PostgreSQL)

**Location:** Shared across primary-backend, processor, and hooks

**Schema Overview:**

```
User
├── id (PK)
├── name
├── email (unique)
└── password

Zap
├── id (PK, UUID)
├── userId (FK → User)
├── triggerId (FK → Trigger)
├── actions (1:N → Action)
└── zapRuns (1:N → ZapRun)

Trigger
├── id (PK, UUID)
├── triggerId (FK → AvailableTriggers)
├── ZapId (FK → Zap, unique)
└── Metadata (JSON)

AvailableTriggers
├── id (PK, UUID)
├── name
└── image

Action
├── id (PK, UUID)
├── zapId (FK → Zap)
├── actionId (FK → AvailableActions)
├── Metadata (JSON)
└── sortingOrder

AvailableActions
├── id (PK, UUID)
├── name
└── image

ZapRun
├── id (PK, UUID)
├── zapId (FK → Zap)
├── metadata (JSON - webhook payload)
└── zapRunOutbox (1:1 → ZapRunOutbox)

ZapRunOutbox
├── id (PK, UUID)
├── zapRunId (FK → ZapRun, unique)
```

**Key Design Decisions:**
- Uses UUIDs for Zap, Trigger, and Action IDs for better distributed system compatibility
- JSON metadata fields allow flexible configuration without schema changes
- Outbox pattern table (`ZapRunOutbox`) ensures reliable event processing

### 7. Kafka Message Broker

**Purpose:** Event streaming platform for decoupling services

**Topic:** `zap-events`

**Message Format:**
- Key: None (or ZapRun ID)
- Value: ZapRun ID (string)

**Consumer Group:** `main-worker`

**Why Kafka?**
- Decouples processor from worker
- Provides message persistence and replay capability
- Supports horizontal scaling of workers
- Ensures at-least-once delivery semantics

## Data Flow

### Creating a Zap

1. **User creates Zap via Frontend**
   - Frontend → Primary Backend: `POST /api/v1/zap`
   - Primary Backend creates Zap, Trigger, and Actions in database
   - Returns Zap ID to frontend

### Triggering a Zap

1. **External Service Sends Webhook**
   - External Service → Hooks Service: `POST /hooks/catch/:userId/:zapId`
   - Hooks Service creates ZapRun and ZapRunOutbox (transactional)

2. **Processor Publishes Event**
   - Processor polls ZapRunOutbox table
   - Processor → Kafka: Publishes ZapRun ID to `zap-events` topic
   - Processor deletes processed outbox entries

3. **Worker Executes Actions**
   - Worker consumes message from Kafka
   - Worker fetches ZapRun and Zap from database
   - Worker executes actions in order:
     - Parses action metadata templates (e.g., `{metadata.field}`)
     - Executes action (send email, transfer SOL, etc.)
   - Worker commits Kafka offset

## Design Patterns

### 1. Outbox Pattern

**Used in:** Processor service

**Purpose:** Ensures reliable message publishing while maintaining transactional consistency

**Implementation:**
- Webhook data is written to `ZapRun` and `ZapRunOutbox` in a single transaction
- Processor polls `ZapRunOutbox` and publishes to Kafka
- After successful publish, outbox entry is deleted

**Benefits:**
- Guarantees no message loss if Kafka is down
- Maintains ACID properties
- Allows retry logic

### 2. Event-Driven Architecture

**Used in:** Overall system design

**Purpose:** Decouple services and enable asynchronous processing

**Implementation:**
- Hooks service writes to database
- Processor reads from database and publishes to Kafka
- Worker consumes from Kafka and executes actions

**Benefits:**
- Services can scale independently
- Fault tolerance (if worker is down, messages queue in Kafka)
- Loose coupling between components

### 3. Template Parsing

**Used in:** Worker service

**Purpose:** Allow dynamic values in action configurations

**Implementation:**
- Action metadata can contain templates like `{metadata.field}`
- Parser extracts values from webhook metadata
- Supports nested fields: `{metadata.user.name}`

**Example:**
- Webhook payload: `{ "user": { "name": "John", "email": "john@example.com" } }`
- Email body template: `"Hello {metadata.user.name}, you received {metadata.amount} SOL"`
- Parsed result: `"Hello John, you received 0.5 SOL"`

## Security Considerations

### Current Implementation

- JWT-based authentication for API endpoints
- CORS enabled on primary-backend
- Environment variables for sensitive data

### Security Gaps & Recommendations

1. **Password Storage**
   - ⚠️ Currently stored in plaintext
   - ✅ Should use bcrypt or similar hashing

2. **JWT Secret**
   - ⚠️ Default value in code
   - ✅ Should be strong random string in production

3. **Webhook Security**
   - ⚠️ No signature verification
   - ✅ Should implement webhook signature validation

4. **Rate Limiting**
   - ⚠️ Not implemented
   - ✅ Should add rate limiting to prevent abuse

5. **Input Validation**
   - ⚠️ Partial validation (Zod schemas exist but not comprehensive)
   - ✅ Should validate all inputs thoroughly

6. **SQL Injection**
   - ✅ Protected by Prisma ORM (parameterized queries)

7. **Environment Variables**
   - ✅ Sensitive data stored in .env files
   - ✅ .env files in .gitignore

## Scalability Considerations

### Current Limitations

1. **Single Kafka Broker**: Hardcoded to `localhost:9092`
2. **Single Worker Instance**: No horizontal scaling support
3. **Synchronous Action Execution**: Actions run sequentially
4. **Database Connection Pooling**: Not explicitly configured

### Scaling Strategies

1. **Horizontal Scaling**
   - Add multiple worker instances (same consumer group)
   - Kafka will distribute messages across workers
   - Add multiple processor instances (idempotent operations)

2. **Database Optimization**
   - Add connection pooling
   - Add database indexes on frequently queried fields
   - Consider read replicas for read-heavy operations

3. **Kafka Configuration**
   - Use multiple Kafka brokers for high availability
   - Increase topic partitions for better parallelism
   - Configure replication factor for durability

4. **Caching**
   - Cache Zap configurations in worker
   - Cache trigger/action metadata in primary-backend

## Monitoring & Observability

### Current State

- Basic console logging
- No structured logging
- No metrics collection
- No distributed tracing

### Recommendations

1. **Logging**
   - Implement structured logging (JSON format)
   - Add correlation IDs for request tracing
   - Log levels: DEBUG, INFO, WARN, ERROR

2. **Metrics**
   - Zap execution count
   - Action success/failure rates
   - Kafka consumer lag
   - Database query performance

3. **Alerting**
   - Worker failures
   - Kafka consumer lag threshold
   - Database connection issues
   - High error rates

## Deployment Considerations

### Development

- All services run locally
- Single PostgreSQL instance
- Single Kafka broker
- Environment variables in .env files

### Production Recommendations

1. **Containerization**
   - Docker containers for each service
   - Docker Compose for local development
   - Kubernetes for production orchestration

2. **Database**
   - Managed PostgreSQL service (AWS RDS, Google Cloud SQL)
   - Automated backups
   - Connection pooling (PgBouncer)

3. **Kafka**
   - Managed Kafka service (Confluent Cloud, AWS MSK)
   - Multiple brokers for high availability
   - Proper topic configuration (retention, replication)

4. **Secrets Management**
   - Use secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Never commit secrets to version control
   - Rotate secrets regularly

5. **Load Balancing**
   - Load balancer for primary-backend
   - Load balancer for hooks service
   - Health check endpoints

## Future Enhancements

1. **Action Types**
   - HTTP requests
   - Database operations
   - File operations
   - More blockchain integrations

2. **Trigger Types**
   - Scheduled triggers (cron)
   - Database change triggers
   - File system triggers

3. **Features**
   - Zap execution history
   - Zap analytics and metrics
   - Zap testing/debugging tools
   - Multi-tenant support
   - Zap sharing and templates

4. **Reliability**
   - Retry logic for failed actions
   - Dead letter queue for failed messages
   - Action timeout handling
   - Circuit breakers for external services