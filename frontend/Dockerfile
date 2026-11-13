# Base image: Node.js runs inside the container. CI uses this same development stage.
FROM node:22-bookworm-slim AS development
# All following paths are inside /app in the container.
WORKDIR /app
# Copy dependency files first so Docker can reuse the npm install layer.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
# Copy this service into the image. .dockerignore excludes local dependencies and secrets.
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Default command when the container starts.
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
