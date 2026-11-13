# Docker Desktop development

All application processes and infrastructure run in Linux containers. Install/start Docker Desktop with its Linux engine. No host npm install, Node server, PostgreSQL, or Kafka is required.

## First start

A private `.env.docker` has been created for this workspace with a private JWT secret and credential encryption key. For another checkout, copy `.env.docker.example` to `.env.docker` and set a random JWT secret and CREDENTIAL_ENCRYPTION_KEY (32 random bytes encoded as 64 hexadecimal characters). Keep the encryption key stable and back it up privately; changing it makes saved provider credentials unreadable. Never commit the private file.

```powershell
docker compose --env-file .env.docker up --build --watch
```

Open http://localhost:8080 for ActionHub and http://localhost:8025 for captured email. Localhost is the published Docker gateway; no application server runs directly on Windows. These ports bind to loopback for development only. Change WEB_PORT or MAIL_PORT if occupied.

PostgreSQL and Kafka have no host ports. Services connect to `postgres:5432` and `kafka:9092`. Browser requests use the current origin with `/api` and `/hooks` routes. External services cannot reach these loopback URLs without a separately configured public endpoint.

## Normal development: reuse images

```powershell
docker compose --env-file .env.docker up --watch
```

Compose Watch syncs frontend app/components/public changes for hot reload. Backend source edits sync and restart only that service, without rebuilding an image. Linux dependencies and generated clients stay in the image; Windows node_modules and Prisma engines are excluded. Watch must remain running for source synchronization.

Package manifests, lockfiles, Dockerfiles, and service Prisma files have service-specific rebuild rules. Docker caches the dependency installation layer until the corresponding manifest/lockfile changes. A service rebuild never requires rebuilding PostgreSQL, Kafka, or unrelated application images. Watch rules intentionally do not run migrations automatically.

For an explicit targeted rebuild (after updating the lockfile too):

```powershell
docker compose --env-file .env.docker up -d --build --no-deps worker
```

Replace `worker` with the changed service. Image rebuilds recreate that service's container; dependent services use stable Docker DNS names. Initial source synchronization catches up edits made while Watch was stopped.

For source changes when Watch is not running, start Watch or rebuild that specific service; a plain container restart does not copy host source into an image.

## Dependencies and checks inside Docker

```powershell
docker compose --env-file .env.docker exec worker npm run typecheck
docker compose --env-file .env.docker exec primary-backend npm run build
```

Update package.json and package-lock.json together. For an npm dependency update without host tooling, run a temporary Node container mounting only that service's directory, and use `npm install --package-lock-only` there. Watch will rebuild that service. Automated Jest test scripts are a separate upcoming task; existing test placeholders are not passing test suites.

## Database initialization and schema changes

`db-init` uses the API image, runs only primary-backend migrations, then upserts the webhook trigger and Email action. `kafka-init` creates the topic idempotently. Applications wait for successful initialization; health checks gate the gateway.

The Docker database is a separate named volume. Existing host database contents are not imported or altered. Initial migration verification is against this new development database; existing-data upgrades still require a backup and rehearsal.

After adding a reviewed database migration, rebuild the API image, run the init task, then recreate consumers whose schemas changed:

```powershell
docker compose --env-file .env.docker build primary-backend
docker compose --env-file .env.docker run --rm db-init
docker compose --env-file .env.docker up -d --no-deps primary-backend
```

Keep consumer Prisma schemas aligned until the authoritative-schema synchronization task is implemented. Do not reset volumes to work around a migration failure.

## Email

Development uses Mailpit at `mailpit:1025`. The worker explicitly disables SMTP authentication and TLS only for this internal mail sink. Captured mail never leaves the stack. Normal worker defaults still require authentication and TLS. Do not use the development override for a real provider.

## Logs, shutdown, and data

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f worker processor
docker compose --env-file .env.docker down
```

Ordinary `down` preserves PostgreSQL and Kafka named volumes. Never add `-v` unless intentionally deleting development data. Mailpit messages are ephemeral. Updating .env.docker requires recreating affected services with `up -d`; restart alone does not apply environment changes.

Proxy configuration is mounted read-only; apply a change with `docker compose --env-file .env.docker restart proxy`. Other unwatched files require an explicit targeted rebuild or an added Watch rule.

## Scope

This configuration is for development, not EC2 production. It uses development database credentials, HTTP, Next.js development mode, and a single Kafka broker. Public deployment, password hashing, authenticated webhooks, retry/idempotency behavior, and production image hardening remain separate work.

## Full-stack smoke check

This creates a development-only test account/workflow and confirms email arrives in Mailpit:

```powershell
Get-Content -Raw docker/smoke.mjs | docker compose --env-file .env.docker exec -T frontend node --input-type=module
```

This is an operational smoke check, not the planned Jest test suite.

## Verified in this workspace

- Linux development images built and all five modules passed typecheck inside containers.
- Fresh Docker PostgreSQL initialized with eight primary-backend migrations; repeated initialization found no pending migrations and seed remained idempotent.
- Full-stack smoke passed through the gateway and captured email in Mailpit.
- Compose Watch source edit restarted only hooks: all image IDs and container IDs stayed unchanged, and other services kept their start times.
- Targeted worker build/update left every unrelated image, container ID, and start time unchanged.
- Kafka's first-start volume permission is initialized by an isolated one-shot task; the broker runs as its normal non-root user.

These are development smoke checks. Jest suites, automated browser testing, and CI/CD remain upcoming work.

## GitHub trigger setup

Open a saved workflow at `/zap/<id>` and use its GitHub: issue opened panel. Enter owner/repository and the same secret configured in GitHub. The API encrypts the secret; hooks verifies raw-body signatures, filters issue-opened events, and records delivery IDs before creating action jobs. Email remains on Mailpit.

A private `GITHUB_SECRETS` value can optionally be imported only by the owner of the workflow named by `GITHUB_SETUP_WORKFLOW_ID`. Other workflows need their own secret. These variables are setup-only and are never sent to the frontend. Do not use the JWT secret as the webhook secret or credential encryption key.

After saving, enable the GitHub webhook and redeliver a ping. A 404 can mean the connection has not been configured or is disabled. GitHub continues to show a previous failure until a new delivery occurs. Keep the tunnel running, and use its HTTPS origin with `/hooks/github/<id>`.
