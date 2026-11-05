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
