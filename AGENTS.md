# Architecture

This is a modular monolith with hexagonal modules. `src/platform` is the shared kernel (config, errors, HTTP, DB later); it never imports from `src/modules`.

Each feature lives in `src/modules/<name>/`:

- `domain/`: entities, value objects and rules; imports nothing outside `domain/` except `src/platform/errors`.
- `application/`: use cases and port interfaces; imports only its own `domain/` and platform types.
- `adapters/`: `http/` routes and zod schemas, `persistence/` repositories, and other drivers.
- `module.ts`: the `AppModule` that wires adapters to use cases.

# Module independence

A module never imports another module. The only exception will be the core `activities` module's `public.ts` contract. Cross-module reactions use events or ports wired in a composition root. Composition roots (`src/main.ts`, `src/modules/index.ts`, later `src/worker.ts`) are the only files that know every module.

# Removing a module

Delete its folder, remove its entry in `src/modules/index.ts`, and add a migration that drops its tables. Nothing else may break.

# Extension points

Satellites import only `src/modules/activities/public.ts`. The composition root creates activities first, then passes `activities.extensions` and `activities.access` to satellites. Register extensions before routes are registered; registration is frozen when activity routes build their schemas. Field and parameter names must be unique across extensions and must not match core fields or query parameters.

- Add a response field with `addView({ field, schema, fallback, load })`. `load({ userId, activityIds })` must use one batched query for all activity ids and return a map keyed by activity id. The presenter calls each loader once per response, in parallel, and supplies `fallback` for missing entries.
- Add a list filter with `addFilter({ param, schema, condition })`. `condition({ userId, value })` returns a scoped SQL condition, such as a correlated EXISTS against the satellite's association table.
- Add a create/patch field with `addWrite({ field, schema, apply })`. `apply({ executor, userId, activityId, value })` must use the supplied transaction executor; throwing rolls back both the core write and satellite associations. Use distinct names for related view, filter and write extensions.

Satellites own their association tables, with foreign keys to `activitiesTable` using `onDelete: "cascade"`. Scope association queries by user id. Use `activities.access.findOwned` to read an owned, non-trashed activity summary. Removing a satellite requires deleting its folder and its composition-root lines, then generating the migration to drop its tables; activities needs no edits.

# Rules

- Validate input only in `adapters/http` with zod.
- Scope every query by the authenticated user id.
- No N+1 queries; batch by ids.
- Reads that run on most requests use Drizzle prepared statements built once in the repository factory (`sql.placeholder`, `= any(...::uuid[])` for id lists, unique statement names); rare filter combinations keep the dynamic builder; never prepare queries that run inside a transaction. Named prepared statements need a direct or session-mode Postgres connection (Railway private network is fine); never point `DATABASE_URL` at a transaction-mode pooler such as PgBouncer or the Supabase pooler on port 6543.
- Domain and application code never import fastify, drizzle, pg or SDKs.
- Errors are `AppError` with a kind, mapped to HTTP only in `src/platform/http/error-handler.ts`.
- Use ESM with `.js` import suffixes.

# Observability

- Only `src/platform/observability` imports `@sentry/*` or OpenTelemetry SDK packages; modules log through `context.logger` and may add spans only with `@opentelemetry/api`.
- Every `error` or `fatal` log becomes a Sentry issue, so use `error` only for failures someone must act on, `warn` for expected or handled problems, and pass errors as `err`.
- Never put tokens, passwords, email contents or request bodies in logs or span attributes. Query parameters never appear in logs or Sentry; the logger and Sentry strip Drizzle `params:` lines.
- Parse new observability settings in `observability-config.ts`.

# Commands

- `npm run dev`
- `npm run check` (lint, typecheck, build)
- `npm test` (Jest unit tests; `npm run test:agent` runs them in band)
- `npm run openapi:export` (writes openapi.json, the contract the frontend repo generates its types from)

# Load tests

- Every new or changed HTTP endpoint adds or updates its k6 scenario in `load-tests/scenarios/<module>.js` (see `load-tests/README.md`, "Adding a module").
- Modules that call paid or rate-limited third parties are excluded and listed in `load-tests/scenarios/index.js`.
- Never run load tests against production.

# Security and quality

- Dependabot (`.github/dependabot.yml`) opens weekly npm update PRs and security fix PRs. Merge one only after the review below and `npm run check` pass.
- Review agents: `.claude/agents/security-reviewer.md` and `.claude/agents/quality-reviewer.md`. Run both on every diff before merge; a `VERDICT: BLOCK` stops the merge.

## Platform services

- Modules render emails with `renderEmail` from `src/platform/email/email-layout.ts`; never build email HTML by hand.
- `ModuleContext` provides `config`, raw `env` for module-specific variables, `logger`, `db`, `events`, `email` and the `requireUser` authentication hook. Modules attach `requireUser` with `onRequest` so authentication runs before body parsing.
- Modules are created through `ModuleFactory`; they may provide `registerRoutes` and background `jobs`.
- Background work lives in module `jobs` and runs in the worker process. Notification producers enqueue email in the database outbox; only the worker drains it through the platform `EmailSender`, with retries and stale-claim recovery. Reminder deduplication and outbox inserts share a transaction.
- Integration events carry `{ type, occurredAt, payload }`. Subscribers validate their own payload with zod; publishers and subscribers never share payload types. In-process handlers run in order; failures are logged without rejecting publication because the publisher's work is already committed.
- `USER_PROFILE_CREATED` is `identity.user_profile_created`, with payload `{ userId: string, email: string }`.
- Modules own their tables in `adapters/persistence/schema.ts`; never edit `drizzle/` by hand; the brain runs `npm run db:generate` after merging.
- The worker entry point is `src/worker.ts`. It runs as a separate Railway service whose settings (start command `npm run start:worker`) live in Railway, not in the repo.

# Pre-push gate and security advisor

- The hook in `.githooks/pre-push` runs `check`, the unit tests, `npm audit` and Snyk (`SKIP_SNYK=1` only for an explicit, temporary opt-out).
- `npm install` sets `core.hooksPath` through the `prepare` script.
- Run the `security-advisor` agent before asking for a merge or a push.
