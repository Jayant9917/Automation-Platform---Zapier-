# Docker Desktop development

All services run in Linux containers in Docker Desktop. No host Node server, PostgreSQL or Kafka is required.

## Setup

Copy .env.docker.example to the ignored .env.docker file. Set JWT_PASSWORD, CREDENTIAL_ENCRYPTION_KEY and the Resend SMTP credentials. Keep the encryption key stable and privately backed up: changing it makes existing saved connections unreadable.

SMTP_ENDPOINT defaults to smtp.resend.com, SMTP_PORT to 465, and SMTP_USERNAME to resend. SMTP_PASSWORD is your private Resend API key; SMTP_FROM must use a sending domain verified in your Resend account. Compose requires authentication and TLS. Ports 465/2465 use implicit TLS; 587/2587 use STARTTLS. Credentials are supplied to the worker only, never the frontend.

```powershell
docker compose --env-file .env.docker up --watch
```

On the first start, add --build to build the application images. Open http://localhost:8080. Email goes to real inboxes through Resend; Mailpit is no longer included. Change WEB_PORT if occupied.

## Selective updates

Compose Watch syncs frontend app/components/public files and restarts only the affected backend for source changes. Dependency, Dockerfile and Prisma changes rebuild only the affected service. Docker reuses cached dependencies where possible. Keep Watch running for synchronization.

For an explicit source/dependency rebuild:

```powershell
docker compose --env-file .env.docker up -d --build --no-deps worker
```

For SMTP/environment changes only, recreate worker without rebuilding:

```powershell
docker compose --env-file .env.docker up -d --no-deps worker
```

A plain restart does not apply new environment values. Processor and worker have restart: unless-stopped to recover from unexpected process exits while respecting deliberate stops.

## Infrastructure and migrations

Containers connect to postgres:5432 and kafka:9092; these services have no host ports. Browser requests use gateway /api and /hooks. External GitHub/Tally requests need a public HTTPS endpoint such as your ngrok origin.

The db-init task applies primary-backend migrations and safely upserts the trigger/action catalog. Kafka init creates the topic; a one-time volume task sets Kafka ownership. Existing PostgreSQL and Kafka data are in named volumes.

After adding a reviewed migration, rebuild API, apply the migration, and update only affected consumers:

```powershell
docker compose --env-file .env.docker build primary-backend
docker compose --env-file .env.docker run --rm db-init
docker compose --env-file .env.docker up -d --no-deps primary-backend
```

Keep the service Prisma schema copies aligned. Do not reset data volumes to fix migrations.

## Tests and manual verification

Jest unit tests mock external boundaries and run in network-isolated containers. GitHub CI runs all five services with lint, formatting, unit tests/coverage, type checks and production builds. There is no integration/E2E suite.

Use the frontend to create and publish an automation, configure its trigger and actions, and inspect Task history. APP_ENV=development enables Send test event for saved generic Webhook workflows; other/missing values hide it and block its API endpoint. Recreate API after changing that flag, then refresh the browser.

Test events run real saved actions, including real Resend email delivery. Use only recipients and destinations you intend to contact. The old Mailpit-only smoke script has been removed.

## Logs and shutdown

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f worker processor
docker compose --env-file .env.docker down
```

Ordinary down preserves named data volumes. Do not add -v unless deliberately deleting data. This development configuration still uses HTTP, a development frontend and a single Kafka broker; production hardening and EC2/CD are separate work.
