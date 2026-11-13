# Unit tests and CI

Current scope: Jest unit tests only. Do not run integration tests, browser end-to-end tests, or the legacy smoke script as part of this workflow. No database, Kafka broker, SMTP server, or application server is required by these tests.

## Run using Docker Desktop

First run or after changing test dependencies:

```powershell
.\docker\test-unit.ps1 -Build
```

Reuse existing images:

```powershell
.\docker\test-unit.ps1
```

Build/test only one changed module:

```powershell
.\docker\test-unit.ps1 -Service worker -Build
```

Each suite runs in an ephemeral container with `--network none`. The script never starts Compose dependencies. Coverage reports are written to each selected module's ignored `coverage/` directory. Existing development containers keep running. If test/source files changed without rebuilding the test image, use `-Build` for that module; Compose Watch updates running development containers, not the original image.

Each module also provides `npm test`, `npm run test:unit`, and `npm run test:ci` inside an appropriately built container. `test:ci` enforces coverage gates. Jest transforms backend TypeScript for isolated execution; production TypeScript/ESM builds are checked separately.

## Coverage scope

| Module | Unit coverage |
| --- | --- |
| Frontend | Shared buttons, labeled/error/hint inputs, same-origin URL configuration |
| Primary backend | Environment validation, JWT middleware decisions, request schemas |
| Hooks | Environment validation and webhook transaction orchestration using a mocked database |
| Processor | Environment validation and email payload extraction |
| Worker | Environment validation, SMTP transport settings, send success/failure using a mocked transport |

The initial coverage gate applies only to the explicitly listed files in each `jest.config.cjs`: 80% branches and 85% functions/lines/statements. It is not a claim of whole-application coverage. Server entrypoints, actual database transaction guarantees, Kafka delivery, and browser journeys are outside this unit suite. Extend focused unit coverage as logic is separated from entrypoints; do not import an entrypoint to start a server during a unit test.

Database, JWT verification, and mail delivery boundaries are replaced with Jest mocks where those calls are not the unit under test. Frontend tests use jsdom and React Testing Library, not a browser. Configuration tests mock dotenv and replace environment settings with synthetic values to avoid reading private files.

## GitHub Actions

`.github/workflows/ci.yml` runs on pull requests, pushes to main, and manual dispatch. It has five independent module jobs:

1. Build a module image with its own cached dependency layers.
2. Run Jest unit tests and coverage with network disabled.
3. Run TypeScript checks with network disabled.
4. Verify its production build; Prisma uses a dummy URL for generation, without a running database. Frontend build may download its Google font.
5. Upload per-module coverage reports for 14 days.

Images are not pushed to a registry. Nothing is deployed to EC2. CI uses read-only repository permissions and no application secrets. Coverage artifacts are collected even after a failed test when available. Concurrent outdated runs for the same branch/PR are canceled.

The workflow starts remotely after the files are committed/pushed to GitHub; local verification does not imply a GitHub Actions run has already occurred. Configure branch protection in GitHub if passing checks should be required before merge.


## Local verification results

All 145 Jest tests passed in 11 suites with networking disabled:

| Module | Passing tests |
| --- | ---: |
| Frontend | 12 |
| Primary backend | 46 |
| Hooks | 19 |
| Processor | 37 |
| Worker | 31 |

Coverage gates passed for the explicitly configured source files. All five modules also passed isolated TypeScript checks and production builds. CI YAML was parsed and its matrix/offline-test settings checked locally. No integration or end-to-end tests were run for this unit-testing/CI task. GitHub Actions execution remains pending until commit/push.

Small source changes made to support these tests: extracted hooks handler and processor payload logic into importable modules; rejected malformed/unsafe JWT user IDs and non-string/blank email payload fields. The application architecture and message contract remain unchanged.
