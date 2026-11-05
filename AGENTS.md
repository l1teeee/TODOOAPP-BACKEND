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

# Rules

- Validate input only in `adapters/http` with zod.
- Scope every query by the authenticated user id.
- No N+1 queries; batch by ids.
- Domain and application code never import fastify, drizzle, pg or SDKs.
- Errors are `AppError` with a kind, mapped to HTTP only in `src/platform/http/error-handler.ts`.
- Use ESM with `.js` import suffixes.

# Commands

- `npm run dev`
- `npm run check` (lint, typecheck, build)
- `npm run openapi:export` (writes openapi.json, the contract the frontend repo generates its types from)

# Security and quality

- Dependabot (`.github/dependabot.yml`) opens weekly npm update PRs and security fix PRs. Merge one only after the review below and `npm run check` pass.
- Review agents: `.claude/agents/security-reviewer.md` and `.claude/agents/quality-reviewer.md`. Run both on every diff before merge; a `VERDICT: BLOCK` stops the merge.

## Platform services

- `ModuleContext` provides `config`, raw `env` for module-specific variables, `logger`, `db`, `events`, `email` and the `requireUser` authentication hook.
- Modules are created through `ModuleFactory`; they may provide `registerRoutes` and background `jobs`.
- Integration events carry `{ type, occurredAt, payload }`. Subscribers validate their own payload with zod; publishers and subscribers never share payload types. In-process handlers run in order; failures are logged without rejecting publication because the publisher's work is already committed.
- `USER_PROFILE_CREATED` is `identity.user_profile_created`, with payload `{ userId: string, email: string }`.
- Modules own their tables in `adapters/persistence/schema.ts`; never edit `drizzle/` by hand; the brain runs `npm run db:generate` after merging.
- The worker entry point is `src/worker.ts`. Run it as a separate Railway service with config file `/railway.worker.json`.
