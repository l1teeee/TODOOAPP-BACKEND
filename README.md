# TODO App - Backend API

## Overview

A Fastify 5 API running on Railway. The frontend is in [TODOAPP-FRONT](https://github.com/l1teeee/TODOAPP-FRONT).

## Stack

Node.js 24.x, Fastify 5.12.8, TypeScript 5.9.3 and Zod 4.6.7. The API uses @fastify/cors 11.4.1, @fastify/helmet 13.2.0, @fastify/rate-limit 11.2.2, @fastify/swagger 9.9.3 and fastify-type-provider-zod 7.0.0. The project also includes drizzle-orm 0.45.4, pg 8.23.1, drizzle-kit 0.31.11, ESLint 9.39.5, @eslint/js 9.39.5, typescript-eslint 8.72.1, Prettier 3.9.10, tsx 4.23.15, @types/node 24.19.2 and @types/pg 8.23.1.

Prettier is configured in `.prettierrc.json`, with exclusions in `.prettierignore`.

## Architecture

This modular hexagonal monolith keeps shared configuration, database, Supabase identity, email, events, jobs and HTTP infrastructure in `src/platform`. Feature modules are independent and created through `ModuleFactory` in `src/modules/index.ts`. Each receives a `ModuleContext` with configuration, raw environment, logger, Drizzle database, event bus, email sender and authentication hook. See `AGENTS.md` for dependency and removal rules.

```text
src/
  main.ts
  worker.ts
  modules/
    index.ts
  platform/
    config/env.ts
    context/create-platform.ts
    db/
      database.ts
      migrate.ts
    email/
    errors/app-error.ts
    events/event-bus.ts
    http/
      create-server.ts
      error-handler.ts
      http-server.ts
      system-routes.ts
    identity/
      domain/
      application/
      adapters/
    jobs/
      background-job.ts
      run-jobs.ts
    logging/create-logger.ts
    modules/app-module.ts
  scripts/export-openapi.ts
```

## Requirements

Node.js 24 and npm.

## Getting started

Run `npm install`, copy `.env.example` to `.env`, and configure Postgres and your Supabase project origin. Apply the generated migrations with `npm run db:migrate:dev`, then run `npm run dev`. Visit http://localhost:4000/health for liveness and http://localhost:4000/health/ready for database readiness. Run `npm run dev:worker` in a separate terminal for module jobs.

## Scripts

| Script                   | Description                                   |
| ------------------------ | --------------------------------------------- |
| `npm run dev`            | Start the API in watch mode.                  |
| `npm run dev:worker`     | Start the worker in watch mode.               |
| `npm run build`          | Compile TypeScript.                           |
| `npm run start`          | Start the compiled API.                       |
| `npm run start:worker`   | Start the compiled worker.                    |
| `npm run db:generate`    | Generate migrations from persistence schemas. |
| `npm run db:migrate`     | Apply migrations using the compiled runner.   |
| `npm run db:migrate:dev` | Apply migrations from TypeScript with `.env`. |
| `npm run lint`           | Run ESLint.                                   |
| `npm run format`         | Format files with Prettier.                   |
| `npm run format:check`   | Check formatting with Prettier.               |
| `npm run typecheck`      | Check TypeScript types.                       |
| `npm run check`          | Run lint, format check, typecheck and build.  |
| `npm run openapi:export` | Export the OpenAPI contract.                  |

## Environment variables

| Name                   | Required      | Default    | Description                                                                         |
| ---------------------- | ------------- | ---------- | ----------------------------------------------------------------------------------- |
| `NODE_ENV`             | Yes           | None       | `development`, `test` or `production`.                                              |
| `HOST`                 | No            | `0.0.0.0`  | Listening address.                                                                  |
| `PORT`                 | No            | `4000`     | Listening port.                                                                     |
| `LOG_LEVEL`            | No            | `info`     | Minimum log level.                                                                  |
| `CORS_ORIGINS`         | Yes           | —          | Comma-separated allowed origins.                                                    |
| `TRUST_PROXY_HOPS`     | In production | `0`        | Trusted proxy hops (0-5); use `1` on Railway.                                       |
| `RATE_LIMIT_MAX`       | No            | `300`      | Maximum requests per window.                                                        |
| `RATE_LIMIT_WINDOW_MS` | No            | `60000`    | Rate limit window in milliseconds.                                                  |
| `DATABASE_URL`         | Yes           | None       | Postgres URL starting with `postgres://` or `postgresql://`.                        |
| `DATABASE_POOL_MAX`    | No            | `10`       | Maximum connections per API or worker process (1-50).                               |
| `DATABASE_SSL`         | No            | `false`    | `true` enables Postgres TLS.                                                        |
| `SUPABASE_URL`         | Yes           | None       | Supabase HTTPS origin without a trailing slash; used for issuer and JWKS discovery. |
| `EMAIL_PROVIDER`       | No            | `log`      | `brevo`, `resend` or `log`; production requires brevo or resend.                    |
| `EMAIL_FROM`           | Yes           | None       | Sender email address.                                                               |
| `EMAIL_FROM_NAME`      | No            | `TODO App` | Sender display name.                                                                |
| `BREVO_API_KEY`        | For brevo     | None       | Brevo transactional email API key.                                                  |
| `RESEND_API_KEY`       | For resend    | None       | Resend email API key.                                                               |

Modules parse their own environment variables from `ModuleContext.env`.

## API contract

`GET /openapi.json` is available outside production. Run `npm run openapi:export` to write `openapi.json` for frontend type generation.

Send the Supabase access token as `Authorization: Bearer <token>` to `GET /v1/me` or `PATCH /v1/me`. The API verifies the token against Supabase JWKS and ensures a local profile. PATCH accepts `displayName` (trimmed, 1-80 characters, or null), `timezone` (from `Intl.supportedValuesOf("timeZone")`) and `emailNotifications` (boolean), with at least one field and no extra keys.

All activities endpoints require the same Supabase bearer token and scope data to the authenticated user.

| Method | Endpoint                     | Response                    | Purpose                                                                       |
| ------ | ---------------------------- | --------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/v1/activities`             | 200 `{ items }`             | List active habits, reminders and tasks.                                      |
| GET    | `/v1/activities/completed`   | 200 `{ items, nextCursor }` | Page through completed activities, newest first.                              |
| GET    | `/v1/activities/trash`       | 200 `{ items, nextCursor }` | Page through trashed activities, newest first.                                |
| GET    | `/v1/activities/:id`         | 200 activity                | Read an owned activity, including one in the trash.                           |
| POST   | `/v1/activities`             | 201 activity                | Create an activity with required `kind` and `title`.                          |
| PATCH  | `/v1/activities/:id`         | 200 activity                | Update fields; set `status: "completed"` to complete it. `kind` is immutable. |
| POST   | `/v1/activities/:id/trash`   | 200 activity                | Move an activity to the trash.                                                |
| POST   | `/v1/activities/:id/restore` | 200 activity                | Restore an activity from the trash.                                           |
| DELETE | `/v1/activities/:id`         | 204                         | Permanently delete a trashed activity; an active activity returns 409.        |

The active list accepts `from` and `to` together (real `YYYY-MM-DD` dates, inclusive, at most 62 days), `unscheduled=true` (undated activities excluding habits), `kind`, `status`, `q` (literal text search), and `limit` (1-500, default 300). Date ranges also include habits. Completed and trash lists accept an opaque `cursor` and `limit` (1-100, default 50); pass `nextCursor` for the next page. Times use `HH:MM`, timestamps use ISO strings, and nullable fields accept null. Habits cannot have a scheduled date or location; reminders require a scheduled date and start time; an end time must follow the start time. Satellite response fields, filters and write fields are registered before routes and appear in OpenAPI.

## Auth flows

The `auth-gateway` module must be registered in `src/modules/index.ts` at integration. Configure `TURNSTILE_SECRET_KEY` and the server-only `SUPABASE_SECRET_KEY` (a Supabase secret or service_role key). Set `EMAIL_PROVIDER=brevo` and configure the platform email sender to deliver these emails through Brevo. Brevo needs an authenticated sender domain for good delivery.

- Register: the frontend obtains a Turnstile token, then sends `{ email, password, fullName, turnstileToken }` to `POST /v1/auth/register`. The API verifies Turnstile, generates a signup code with the Supabase admin API, and sends the code through the platform email sender. The frontend confirms the email with Supabase `verifyOtp({ email, token: code, type: "signup" })`.
- Forgot password: the frontend obtains a Turnstile token and sends `{ email, turnstileToken }` to `POST /v1/auth/password-reset`. The API generates and emails a recovery code. The frontend calls Supabase `verifyOtp({ email, token: code, type: "recovery" })`, then `updateUser({ password })` using the resulting session.
- Login: the frontend authenticates directly against Supabase.

Both API routes return `202` after CAPTCHA verification while code generation and email delivery run in the background. Registration returns `{ status: "verification_sent" }` and password reset returns `{ status: "reset_sent" }`, regardless of whether the email exists. An existing account receives an account reminder on registration; if signup was unfinished, it directs the recipient to use Forgot password to set a new password and confirm the email. An unknown email receives no recovery email. Each route allows five requests per IP every 15 minutes.

Both flows share a 60-second per-email cooldown across replicas. The database stores only a SHA-256 hex hash of the trimmed, lowercased email in `auth_email_cooldowns`; requests during the cooldown silently skip code generation and delivery and keep the same `202` response. Generate the migration for this module's `adapters/persistence/schema.ts` at integration before enabling the module. Background tasks have a 15-second timeout, clear their timers when settled, and log failures using only the event and error code or status. The timeout bounds shutdown waiting without cancelling underlying operations.

Registration trims full names to 1-80 characters, permits only Unicode letters and marks, spaces, apostrophes, hyphens and periods, and collapses inner whitespace. Passwords require 8-72 characters, at least one letter and one digit, and at most 72 UTF-8 bytes. Cloudflare test secrets beginning with `1x0000`, `2x0000` or `3x0000` are rejected in production.

Required Supabase settings: disable **Allow new users to sign up** so public signup cannot bypass Turnstile (admin-generated sign-ups still work), set email OTP length to **6**, OTP expiry to **3600 seconds**, and password minimum length to **8**. The browser handles code verification and password updates directly against Supabase; the API uses admin-generated codes so Supabase does not send these emails.

## AI assistant

Set `DEEPINFRA_API_KEY` on Railway to enable the AI assistant module. `DEEPINFRA_MODEL` selects the model and defaults to `deepseek-ai/DeepSeek-V4-Flash-0731`. Authenticated clients can send an activity title and optional description to `POST /v1/ai/subtask-suggestions` to receive up to five suggested subtask titles. The activity text is sent to DeepInfra to generate the suggestions.

Authenticated clients can send a first name, local time, locale and today's items to `POST /v1/ai/daily-brief` to receive a friendly reminder message. Activity titles and times are sent to DeepInfra along with the other supplied details. When the module is off, the frontend falls back to a local message.

## Deploy on Railway

Create a new service from [TODOOAPP-BACKEND](https://github.com/l1teeee/TODOOAPP-BACKEND). Railway uses the Railpack builder configured in `railway.json`. Set the environment variables, including `TRUST_PROXY_HOPS=1`, generate a public domain, and use `/health` as the healthcheck.

Set `NODE_ENV=production`, `DATABASE_URL`, `SUPABASE_URL`, `EMAIL_FROM` and a production email provider with its API key. Configure `DATABASE_SSL` for your Postgres connection. `/health/ready` returns 503 when the database cannot be reached.

The API service runs `npm run db:migrate` as its pre-deploy command after the build and before starting the new deployment. Modules own their tables in `adapters/persistence/schema.ts`; generate migrations with `npm run db:generate` after merging schema changes and include the generated `drizzle/` files in the deployment. Never edit migrations by hand. An initial generated migration is required before deploying the profiles table.

Create a second, long-running Railway service from the same repository for the worker. Set its config file to `/railway.worker.json` and give it the same platform environment variables. It builds the same code and starts with `npm run start:worker`; the API service owns migrations. Each module job runs without overlap, waits its interval after completion, and logs failures before continuing. SIGTERM and SIGINT stop jobs, await active runs and close the database, with a 10-second shutdown limit.

The event bus is in-process: API and worker processes have separate subscribers and do not exchange events. Each subscriber validates its own event payload.

## Error format

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [] } }
```

`details` is optional.
