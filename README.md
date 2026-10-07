# Zapier Clone - Automation Platform

A Zapier-like automation platform that allows users to create automated workflows (Zaps) by connecting triggers and actions. This project enables users to automate tasks across different services and platforms.

## 🚀 Features

- **User Authentication**: Sign up and sign in with JWT-based authentication
- **Zap Creation**: Create automated workflows by connecting triggers and actions
- **Webhook Triggers**: Receive webhook events to trigger Zaps
- **Multiple Actions**: Support for various actions including:
  - Email notifications (via SMTP)
  - Solana SOL transfers
  - Extensible action system for future integrations
- **Real-time Processing**: Event-driven architecture using Kafka for reliable message processing
- **Modern UI**: Beautiful Next.js frontend with Tailwind CSS

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v12 or higher)
- **Kafka** (for event streaming)
- **npm** or **yarn** package manager

## 🏗️ Project Structure

```
Zapier/
├── frontend/          # Next.js frontend application
├── primary-backend/   # Main Express API server
├── hooks/            # Webhook receiver service
├── processor/        # Outbox pattern processor (Kafka producer)
├── worker/           # Kafka consumer and action executor
└── .env.example      # Environment variables template
```

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Zapier
```

### 2. Set Up Environment Variables

Copy the `.env.example` file to create `.env` files in each service directory:

```bash
# For primary-backend
cp .env.example primary-backend/.env

# For processor
cp .env.example processor/.env

# For hooks
cp .env.example hooks/.env
```

Update the `.env` files with your actual configuration values. See [Environment Variables](#environment-variables) section for details.

### 3. Set Up PostgreSQL Database

Create a PostgreSQL database:

```bash
createdb zapier
# Or using psql:
# psql -U postgres
# CREATE DATABASE zapier;
```

### 4. Set Up Kafka

Install and start Kafka:

```bash
# Download Kafka from https://kafka.apache.org/downloads
# Start Zookeeper
bin/zookeeper-server-start.sh config/zookeeper.properties

# Start Kafka server
bin/kafka-server-start.sh config/server.properties

# Create the zap-events topic
bin/kafka-topics.sh --create --topic zap-events --bootstrap-server localhost:9092 --partitions 1 --replication-factor 1
```

### 5. Install Dependencies

Install dependencies for each service:

```bash
# Frontend
cd frontend
npm install

# Primary Backend
cd ../primary-backend
npm install

# Processor
cd ../processor
npm install

# Hooks
cd ../hooks
npm install

# Worker
cd ../worker
npm install
```

### 6. Set Up Database Schema

Run Prisma migrations for each service that uses the database:

```bash
# Primary Backend
cd primary-backend
npx prisma generate
npx prisma migrate deploy

# Processor
cd ../processor
npx prisma generate
npx prisma migrate deploy

# Hooks
cd ../hooks
npx prisma generate
npx prisma migrate deploy
```

## 🚀 Running the Application

### Development Mode

Start each service in a separate terminal:

**Terminal 1 - Primary Backend:**
```bash
cd primary-backend
npm run build
npm start
# Server runs on http://localhost:3000
```

**Terminal 2 - Hooks Service:**
```bash
cd hooks
npm run build
npm start
# Server runs on http://localhost:8000
```

**Terminal 3 - Processor:**
```bash
cd processor
npm run dev
# Runs in watch mode
```

**Terminal 4 - Worker:**
```bash
cd worker
npm run build
npm start
# Consumes messages from Kafka
```

**Terminal 5 - Frontend:**
```bash
cd frontend
npm run dev
# Server runs on http://localhost:3001 (or next available port)
```

## 📝 Environment Variables

### Required Variables

| Variable | Description | Service |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | primary-backend, processor, hooks |
| `JWT_PASSWORD` | Secret key for JWT token signing | primary-backend |
| `SMTP_ENDPOINT` | SMTP server hostname | worker |
| `SMTP_USERNAME` | SMTP authentication username | worker |
| `SMTP_PASSWORD` | SMTP authentication password | worker |
| `SOL_PRIVATE_KEY` | Base58 encoded Solana private key | worker |

### Optional Variables

| Variable | Description | Service |
|----------|-------------|---------|
| `KAFKAJS_NO_PARTITIONER_WARNING` | Suppress KafkaJS warnings | processor |
| `BACKEND_URL` | Backend API URL | frontend |
| `HOOKS_URL` | Hooks service URL | frontend |

See `.env.example` for a complete template with descriptions.

## 🔧 API Endpoints

### Authentication
- `POST /api/v1/user/signup` - Create a new user account
- `POST /api/v1/user/signin` - Sign in and get JWT token
- `GET /api/v1/user/user` - Get current user info (requires auth)

### Zaps
- `POST /api/v1/zap` - Create a new Zap
- `GET /api/v1/zap` - Get all Zaps for authenticated user
- `GET /api/v1/zap/:zapId` - Get a specific Zap

### Triggers
- `GET /api/v1/trigger` - Get available triggers

### Actions
- `GET /api/v1/action` - Get available actions

### Webhooks
- `POST /hooks/catch/:userId/:zapId` - Receive webhook events

## 🏛️ Architecture

This project follows a microservices architecture with event-driven communication. See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## 🧪 Testing

Currently, the project doesn't include automated tests. To test manually:

1. Start all services
2. Sign up a new user via the frontend
3. Create a Zap with a trigger and action
4. Send a webhook to the hooks service to trigger the Zap
5. Verify the action executes (check email or Solana transaction)

## 📦 Building for Production

Build each service:

```bash
# Frontend
cd frontend
npm run build
npm start

# Primary Backend
cd primary-backend
npm run build
npm start

# Other services follow similar pattern
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🔒 Security Notes

- **Never commit `.env` files** to version control
- Use strong, random values for `JWT_PASSWORD` in production
- Store `SOL_PRIVATE_KEY` securely (consider using a secrets manager)
- Hash passwords before storing (currently stored in plaintext - TODO)
- Use HTTPS in production
- Implement rate limiting for API endpoints
- Validate and sanitize all user inputs

## 🐛 Known Issues

- Passwords are stored in plaintext (should be hashed)
- No rate limiting implemented
- No input validation on some endpoints
- Kafka broker URLs are hardcoded in some services

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [Kafka Documentation](https://kafka.apache.org/documentation/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Express.js Documentation](https://expressjs.com/)

## 💡 Future Enhancements

- [ ] Add password hashing (bcrypt)
- [ ] Implement rate limiting
- [ ] Add comprehensive input validation
- [ ] Add unit and integration tests
- [ ] Support for more trigger types
- [ ] Support for more action types
- [ ] Webhook signature verification
- [ ] Zap execution history and logging
- [ ] User dashboard with Zap analytics
- [ ] Multi-tenant support