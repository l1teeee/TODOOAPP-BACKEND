# TODO App - Backend API

## Overview

A long-running Fastify 5 API deployed on Railway. The frontend application is located in the [TODOAPP-FRONT](https://github.com/l1teeee/TODOAPP-FRONT) repository.

## Architecture

This project is built as a modular hexagonal monolith. Shared infrastructure lives in the platform layer (`src/platform`), while business capabilities reside in self-contained feature modules (`src/modules`).

```text
src/
├── main.ts                     # API process entry point & composition root
├── worker.ts                   # Background worker process entry point
├── scripts/
│   └── export-openapi.ts       # Script to export openapi.json
├── platform/                   # Shared platform kernel (never imports from modules)
│   ├── config/                 # Environment parsing and validation
│   ├── context/                # Platform context factory
│   ├── db/                     # Drizzle database client and migration runners
│   ├── email/                  # EmailSender port, Brevo/Resend/log adapters, layout
│   ├── errors/                 # AppError domain error definitions
│   ├── events/                 # In-process asynchronous event bus
│   ├── http/                   # Fastify server, middleware, routes, error handler
│   ├── identity/               # Supabase JWT verification and profile persistence
│   ├── jobs/                   # Background job runner
│   └── logging/                # Pino logger configuration
└── modules/                    # Hexagonal feature modules
    ├── index.ts                # Modules composition root
    ├── activities/             # Core activities module (habits, reminders, tasks)
    ├── auth-gateway/           # Turnstile verification & Supabase OTP auth gateway
    ├── lists/                  # Activity lists satellite
    ├── tags/                   # Colored activity tags satellite
    ├── subtasks/               # Checklist subtasks satellite
    ├── notifications/          # Reminder scans, email outbox & worker jobs
    ├── summary/                # Aggregated dashboard metrics
    └── ai-assistant/           # DeepInfra AI suggestions and daily briefing
```

### Module Independence and Extension Points

- **Zero cross-module imports**: Modules never directly import other modules. Satellite modules interact with core activities exclusively through the contract in `src/modules/activities/public.ts`.
- **Extension points**: Activities provides three registration hooks before HTTP routes freeze:
  - `addView({ field, schema, fallback, load })`: Appends custom fields to activity responses (e.g., `listId`, `tagIds`, `subtaskProgress`) using single batched queries.
  - `addFilter({ param, schema, condition })`: Appends query filters to the list endpoint (e.g., filtering by `listId` or `tagId`).
  - `addWrite({ field, schema, apply })`: Handles create and patch mutations within the core activity database transaction.
- **Asynchronous events**: Decoupled domain interactions use the platform event bus. For example, subtask creation emits `subtasks.created`, which the notifications module consumes independently without importing subtask types.
- **Removing a module**:
  1. Delete its folder under `src/modules/<name>/`.
  2. Remove its initialization from `src/modules/index.ts`.
  3. Generate and apply a migration to drop its tables (`npm run db:generate && npm run db:migrate:dev`).
     No other module or platform code needs modification.

## Stack

- **Runtime & Language**: Node.js `24.x`, TypeScript `5.9.3` (ESM with `.js` import suffixes).
- **Web Framework & HTTP**: Fastify `5.12.8`, `@fastify/cors` `11.4.1`, `@fastify/helmet` `13.2.0`, `@fastify/rate-limit` `11.2.2`, `@fastify/swagger` `9.9.3`, `fastify-type-provider-zod` `7.0.0`.
- **Validation**: Zod `4.6.7`.
- **Database & ORM**: PostgreSQL `pg` `8.23.1`, Drizzle ORM `drizzle-orm` `0.45.4`, Drizzle Kit `drizzle-kit` `0.31.11`.
- **Authentication & Identity**: Supabase Client `@supabase/supabase-js` `2.119.0`, Jose `jose` `6.2.15`.
- **Logging**: Pino `pino` `10.4.0`.
- **Development & Linting**: ESLint `9.39.5`, `@eslint/js` `9.39.5`, `typescript-eslint` `8.72.1`, Prettier `3.9.10`, `tsx` `4.23.15`, `@types/node` `24.19.2`, `@types/pg` `8.23.1`.

## Getting Started

### Prerequisites

- Node.js 24.x and npm
- A running PostgreSQL database instance (local or remote)
- A Supabase project (for authentication and profile management)

### Local Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

   _Note: `npm install` automatically triggers the `prepare` script to configure git hooks in `.githooks`._

2. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` to supply your database URL and Supabase credentials.

3. Run database migrations:

   ```bash
   npm run db:migrate:dev
   ```

4. Start the API development server:

   ```bash
   npm run dev
   ```

   The API will listen at `http://localhost:4000`. Check liveness at `/health` and database readiness at `/health/ready`.

5. Start the background worker process in a separate terminal:
   ```bash
   npm run dev:worker
   ```

## Scripts

| Script                   | Description                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| `npm run dev`            | Starts the API server in watch mode using `tsx` and `.env`.                      |
| `npm run dev:worker`     | Starts the background worker in watch mode using `tsx` and `.env`.               |
| `npm run build`          | Compiles TypeScript into `dist/`, excluding tests through `tsconfig.build.json`. |
| `npm test`               | Runs the Jest unit tests.                                                        |
| `npm run test:agent`     | Runs the Jest unit tests in band.                                                |
| `npm run start`          | Runs the compiled production API server from `dist/main.js`.                     |
| `npm run start:worker`   | Runs the compiled production worker process from `dist/worker.js`.               |
| `npm run db:generate`    | Generates SQL migration files from Drizzle schema definitions.                   |
| `npm run db:migrate`     | Runs pending database migrations using the compiled migration runner.            |
| `npm run db:migrate:dev` | Runs pending database migrations directly in TypeScript using `.env`.            |
| `npm run lint`           | Lints codebase using ESLint.                                                     |
| `npm run format`         | Formats all files with Prettier.                                                 |
| `npm run format:check`   | Checks code formatting against Prettier rules.                                   |
| `npm run typecheck`      | Validates TypeScript types without emitting files.                               |
| `npm run check`          | Runs lint, format check, typecheck, and build in sequence.                       |
| `npm run openapi:export` | Generates the OpenAPI 3 specification file (`openapi.json`).                     |
| `npm run prepare`        | Configures git hooks directory (`core.hooksPath=.githooks`).                     |

## Testing

Jest 30 uses the ts-jest ESM preset. Tests live in `src/**/__tests__/*.test.ts` next to the code and use in-memory fakes and a mocked fetch, so no database, network or `.env` is needed. Run them with `npm test`; the pre-push hook runs `npm run test:agent`.

## Environment Variables

| Name                    | Required          | Default                              | Description                                                                           |
| ----------------------- | ----------------- | ------------------------------------ | ------------------------------------------------------------------------------------- |
| `NODE_ENV`              | Yes               | None                                 | Runtime environment (`development`, `test`, `production`).                            |
| `HOST`                  | No                | `0.0.0.0`                            | IP address for the HTTP server to bind to.                                            |
| `PORT`                  | No                | `4000`                               | Port number for the HTTP server to listen on.                                         |
| `LOG_LEVEL`             | No                | `info`                               | Minimum log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`).     |
| `CORS_ORIGINS`          | Yes               | None                                 | Comma-separated allowed browser origins (no paths or trailing slashes).               |
| `TRUST_PROXY_HOPS`      | In production     | `0`                                  | Number of trusted reverse proxy hops (0-5); set to `1` on Railway.                    |
| `RATE_LIMIT_MAX`        | No                | `300`                                | Maximum requests allowed per rate limit window per client.                            |
| `RATE_LIMIT_WINDOW_MS`  | No                | `60000`                              | Rate limit window duration in milliseconds.                                           |
| `DATABASE_URL`          | Yes               | None                                 | PostgreSQL connection URI (`postgres://` or `postgresql://`).                         |
| `DATABASE_POOL_MAX`     | No                | `10`                                 | Maximum database connection pool size per process (1-50).                             |
| `DATABASE_SSL`          | No                | `false`                              | Enables TLS for PostgreSQL connection; required in production outside Railway.        |
| `SUPABASE_URL`          | Yes               | None                                 | Supabase project HTTPS URL without trailing slash; used for JWKS token verification.  |
| `SUPABASE_SECRET_KEY`   | For auth-gateway  | None                                 | Supabase service role secret key; server-only, never expose to client.                |
| `TURNSTILE_SECRET_KEY`  | For auth-gateway  | None                                 | Cloudflare Turnstile secret key for server-side captcha verification.                 |
| `EMAIL_PROVIDER`        | No                | `log`                                | Email delivery provider (`brevo`, `resend`, or `log`; `log` forbidden in production). |
| `EMAIL_FROM`            | Yes               | None                                 | Sender email address for outbound emails.                                             |
| `EMAIL_FROM_NAME`       | No                | `TODO App`                           | Display name for outbound sender.                                                     |
| `BREVO_API_KEY`         | For brevo         | None                                 | Brevo API key when `EMAIL_PROVIDER=brevo`.                                            |
| `RESEND_API_KEY`        | For resend        | None                                 | Resend API key when `EMAIL_PROVIDER=resend`.                                          |
| `APP_URL`               | For notifications | None                                 | Public origin of the frontend web application for email action links.                 |
| `REMINDER_LEAD_MINUTES` | No                | `15`                                 | Minutes prior to activity scheduled start time to enqueue email reminder (0-1440).    |
| `OUTBOX_BATCH_SIZE`     | No                | `20`                                 | Maximum emails claimed per worker outbox drain batch (1-100).                         |
| `DEEPINFRA_API_KEY`     | For ai-assistant  | None                                 | DeepInfra API key; setting this variable enables the AI assistant module.             |
| `DEEPINFRA_MODEL`       | No                | `deepseek-ai/DeepSeek-V4-Flash-0731` | Model identifier used for AI completions.                                             |
| `AI_TIMEOUT_MS`         | No                | `20000`                              | Timeout in milliseconds for DeepInfra API requests (1000-60000).                      |

## API

All endpoints except `/health`, `/health/ready`, `/v1/meta`, and `/v1/auth/*` require authentication via a Supabase bearer token: `Authorization: Bearer <access_token>`. The token is cryptographically verified against Supabase JWKS endpoints, ensuring issuer, audience, and expiry are valid. The authenticated user ID is strictly derived from the verified token claims.

Outside production, the OpenAPI contract is exposed at `GET /openapi.json` and can be regenerated via `npm run openapi:export`.

| Method   | Endpoint                                    | Purpose                                                                                                                  |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET`    | `/health`                                   | API process liveness check.                                                                                              |
| `GET`    | `/health/ready`                             | Database readiness check.                                                                                                |
| `GET`    | `/v1/meta`                                  | Lists all registered module names.                                                                                       |
| `GET`    | `/v1/me`                                    | Fetches the profile of the authenticated user.                                                                           |
| `PATCH`  | `/v1/me`                                    | Updates user profile settings (`displayName`, `timezone`, `emailNotifications`).                                         |
| `POST`   | `/v1/auth/register`                         | Verifies Turnstile token, generates Supabase signup code, and emails code.                                               |
| `POST`   | `/v1/auth/password-reset`                   | Verifies Turnstile token, generates recovery code, and emails code.                                                      |
| `POST`   | `/v1/auth/login-code`                       | Validates existing user profile, generates login OTP code, and emails code.                                              |
| `GET`    | `/v1/activities`                            | Lists active activities with optional filtering (`from`, `to`, `unscheduled`, `kind`, `status`, `q`, `listId`, `tagId`). |
| `POST`   | `/v1/activities`                            | Creates a new activity (`habit`, `reminder`, or `task`).                                                                 |
| `GET`    | `/v1/activities/completed`                  | Retrieves cursor-paginated completed activities (newest first).                                                          |
| `GET`    | `/v1/activities/trash`                      | Retrieves cursor-paginated trashed activities (newest first).                                                            |
| `GET`    | `/v1/activities/:id`                        | Retrieves an owned activity by ID (including trashed).                                                                   |
| `PATCH`  | `/v1/activities/:id`                        | Updates an owned activity.                                                                                               |
| `POST`   | `/v1/activities/:id/trash`                  | Moves an active activity to the trash.                                                                                   |
| `POST`   | `/v1/activities/:id/restore`                | Restores an activity from the trash to active status.                                                                    |
| `DELETE` | `/v1/activities/:id`                        | Permanently deletes a trashed activity (active activities return 409).                                                   |
| `GET`    | `/v1/activities/:activityId/subtasks`       | Lists checklist subtasks for an activity ordered by position.                                                            |
| `POST`   | `/v1/activities/:activityId/subtasks`       | Appends a single checklist subtask to an activity.                                                                       |
| `POST`   | `/v1/activities/:activityId/subtasks/batch` | Appends 1 to 10 checklist subtasks in batch.                                                                             |
| `PATCH`  | `/v1/subtasks/:id`                          | Updates a subtask's title or completion status (`isDone`).                                                               |
| `DELETE` | `/v1/subtasks/:id`                          | Deletes an owned checklist subtask.                                                                                      |
| `GET`    | `/v1/lists`                                 | Lists custom lists ordered by position.                                                                                  |
| `POST`   | `/v1/lists`                                 | Creates a new custom list.                                                                                               |
| `PATCH`  | `/v1/lists/:id`                             | Updates list name, icon, or position.                                                                                    |
| `DELETE` | `/v1/lists/:id`                             | Deletes a custom list (unlinks associated activities).                                                                   |
| `GET`    | `/v1/tags`                                  | Lists user tags ordered alphabetically by name.                                                                          |
| `POST`   | `/v1/tags`                                  | Creates a new colored tag.                                                                                               |
| `PATCH`  | `/v1/tags/:id`                              | Updates tag name or color.                                                                                               |
| `DELETE` | `/v1/tags/:id`                              | Deletes a tag (unlinks associated activities).                                                                           |
| `GET`    | `/v1/summary`                               | Retrieves dashboard metrics for a given date (`byStatus`, `byKind`, `completedLast7Days`, `overdueReminders`).           |
| `POST`   | `/v1/ai/subtask-suggestions`                | Generates AI subtask recommendations for an activity title/description.                                                  |
| `POST`   | `/v1/ai/daily-brief`                        | Generates a daily agenda summary message using AI.                                                                       |

## Auth Flows

The `auth-gateway` module coordinates user onboarding and recovery with Cloudflare Turnstile bot verification and Supabase Admin OTP generation, delivering branded transactional emails via the platform email sender:

- **Register**: Frontend completes a Cloudflare Turnstile challenge, then sends `{ email, password, fullName, turnstileToken }` to `POST /v1/auth/register`. The backend validates Turnstile, requests a signup OTP code using the Supabase admin API, and dispatches the code via email. The frontend completes signup by invoking Supabase client `verifyOtp({ email, token: code, type: "signup" })`.
- **Forgot Password**: Frontend completes Turnstile challenge and sends `{ email, turnstileToken }` to `POST /v1/auth/password-reset`. The backend generates a recovery code via Supabase admin and emails it. The frontend invokes Supabase `verifyOtp({ email, token: code, type: "recovery" })` and updates credentials with `updateUser({ password })`.
- **Login with Code**: Frontend sends `{ email }` to `POST /v1/auth/login-code` (Turnstile omitted). The backend confirms a profile exists for the email, generates a login OTP via Supabase admin, and emails it. The frontend authenticates via `verifyOtp({ email, token: code, type: "magiclink" })`.
- **Login with Password**: Frontend authenticates directly against Supabase auth.

### Security and Rate Limits

- All three gateway routes return `202 Accepted` immediately while background dispatch proceeds, preventing email enumeration.
- Auth endpoints enforce IP rate limiting (5 requests per 15 minutes) and a distributed 60-second cooldown per hashed email stored in `auth_email_cooldowns` (using SHA-256 hashes of trimmed, lowercased emails).
- Required Supabase dashboard configurations:
  - Disable **Allow new users to sign up** under Auth providers (ensures public signups cannot bypass Turnstile).
  - Set **Email OTP expiry** to 3600 seconds.
  - Set **Email OTP length** to 6 (matching frontend `NEXT_PUBLIC_OTP_LENGTH`).
  - Configure **Site URL** to match the frontend origin.

## Email

The platform abstracts email dispatch via the `EmailSender` port with three interchangeable adapters:

- `BrevoEmailSender`: Dispatches transactional emails via the Brevo API (`EMAIL_PROVIDER=brevo`).
- `ResendEmailSender`: Dispatches emails via the Resend API (`EMAIL_PROVIDER=resend`).
- `LogEmailSender`: Development/test logger adapter (`EMAIL_PROVIDER=log`; disabled in production).

### Transactional Outbox Pattern

All notifications follow a reliable transactional outbox pattern:

- **Enqueueing**: Reminders and subtask notification emails are written directly to the `email_outbox` table within the same database transaction as the triggering action.
- **Worker Scanning**: The worker process runs `notifications.reminder-scan` every 60 seconds. It evaluates user timezones, queries reminders within `REMINDER_LEAD_MINUTES`, and inserts outbox rows deduplicated by `(activity_id, remind_at)`.
- **Worker Draining**: The worker runs `notifications.outbox-drain` every 15 seconds, locking batches with `FOR UPDATE SKIP LOCKED`. Emails are dispatched through `EmailSender` and retried with exponential backoff (2, 4, 8, 16 minutes) up to 5 attempts before terminal failure.
- **Cleanup**: The worker runs `notifications.outbox-cleanup` hourly to purge delivered outbox records.
- **Email Design & Deliverability**: Emails are rendered with `renderEmail` (`src/platform/email/email-layout.ts`) using a responsive, accessible layout. Ensure your custom sender domain is fully verified with SPF and DKIM in Brevo or Resend for production delivery.

## AI Assistant

The AI assistant module provides intelligent activity breakdowns and daily summaries powered by DeepInfra:

- **Subtask suggestions**: `POST /v1/ai/subtask-suggestions` generates up to five actionable checklist subtask titles for an activity.
- **Daily brief**: `POST /v1/ai/daily-brief` generates a friendly overview of the user's daily schedule and tasks.
- **Model selection**: Configured via `DEEPINFRA_MODEL` (defaults to `deepseek-ai/DeepSeek-V4-Flash-0731`).
- **Privacy and security**: AI requests are bounded in size (input strings truncated to schema limits). Model responses are treated as untrusted plain text—never evaluated as code or interpolated into SQL. The module is disabled automatically when `DEEPINFRA_API_KEY` is not set.

## Deploy on Railway

The production architecture consists of three interconnected Railway services:

1. **Postgres Service**: Managed Railway PostgreSQL database. Use the internal network URL (`DATABASE_URL`) with `.railway.internal` host to avoid public network hops and disable SSL overhead (`DATABASE_SSL=false`).
2. **API Service**:
   - Configured via `railway.json`.
   - Pre-deploy command runs migrations: `npm run db:migrate`.
   - Start command: `npm run start`.
   - Healthcheck path: `/health` with 60s timeout.
   - Set `TRUST_PROXY_HOPS=1` to accurately detect client IP behind Railway's reverse proxy.
   - Set `CORS_ORIGINS` to your production frontend domain (e.g., `https://your-app.vercel.app`).
3. **Worker Service**:
   - Long-running service configured via `railway.worker.json`.
   - Start command: `npm run start:worker`.
   - Shares the same environment variables and database as the API service. Runs background reminder scans, outbox draining, and cleanup.

## Security

- **Dependabot**: Configured in `.github/dependabot.yml` to generate automated weekly dependency updates and security patches.
- **Review Agents**: Pre-merge code inspections are enforced using specialized agents:
  - `.claude/agents/security-reviewer.md`: Verifies authentication, authorization, IDOR prevention, injection safety, and secret handling.
  - `.claude/agents/quality-reviewer.md`: Enforces hexagonal modular architecture, independence, and code cleanliness.
- **Snyk Integration**: Scans dependencies (Snyk Open Source) and source code (Snyk Code) for vulnerabilities.
- **Pre-Push Gate**: Git pre-push hook (`.githooks/pre-push`) blocks pushes if `npm run check`, `npm audit --omit=dev --audit-level=high`, or Snyk high/critical scans fail (bypassable only via `SKIP_SNYK=1` for explicit opt-out).
- **Security Advisor Agent**: `.claude/agents/security-advisor.md` runs test suites, dependency audits, Snyk scans, and diff checklists before giving a final `PASS` or `BLOCK` verdict.

## Error Format

The API standardizes all errors into a predictable JSON payload:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": []
  }
}
```

Domain and application errors inherit from `AppError` and are mapped to HTTP status codes centrally in `src/platform/http/error-handler.ts`. Internal error details and database exception messages are never leaked to clients.
