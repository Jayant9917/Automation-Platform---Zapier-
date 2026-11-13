FROM node:22-bookworm-slim AS development
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN DATABASE_URL=postgresql://build:build@postgres:5432/build npm run generate
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
