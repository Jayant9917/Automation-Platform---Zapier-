# Base image: Node.js runs inside the container. CI uses this same development stage.
FROM node:22-bookworm-slim AS development
# All following paths are inside /app in the container.
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
# Copy dependency files first so Docker can reuse the npm install layer.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
# Copy this service into the image. .dockerignore excludes local dependencies and secrets.
COPY . .
# Generate the database client without connecting to a database.
RUN DATABASE_URL=postgresql://build:build@postgres:5432/build npm run generate
# Default command when the container starts.
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
