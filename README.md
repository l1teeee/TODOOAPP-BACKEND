# TODO App - Backend API

## Overview

A Fastify 5 API running on Railway. The frontend is in [TODOAPP-FRONT](https://github.com/l1teeee/TODOAPP-FRONT).

## Stack

Node.js 24.x, Fastify 5.12.8, TypeScript 5.9.3 and Zod 4.6.7. The API uses @fastify/cors 11.4.1, @fastify/helmet 13.2.0, @fastify/rate-limit 11.2.2, @fastify/swagger 9.9.3 and fastify-type-provider-zod 7.0.0. The project also includes drizzle-orm 0.45.4, pg 8.23.1, drizzle-kit 0.31.11, ESLint 9.39.5, @eslint/js 9.39.5, typescript-eslint 8.72.1, Prettier 3.9.10, tsx 4.23.15, @types/node 24.19.2 and @types/pg 8.23.1.

Prettier is configured in `.prettierrc.json`, with exclusions in `.prettierignore`.

## Architecture

This modular hexagonal monolith keeps shared configuration, errors and HTTP infrastructure in `src/platform`. Feature modules are independent and registered through `AppModule` and `src/modules/index.ts`. See `AGENTS.md` for dependency and removal rules.

```text
src/
  main.ts
  modules/
    index.ts
  platform/
    config/env.ts
    errors/app-error.ts
    http/
      create-server.ts
      error-handler.ts
      http-server.ts
      system-routes.ts
    modules/app-module.ts
  scripts/export-openapi.ts
```

## Requirements

Node.js 24 and npm.

## Getting started

Run `npm install`, copy `.env.example` to `.env`, then run `npm run dev`. Visit http://localhost:4000/health.

## Scripts

| Script                   | Description                                  |
| ------------------------ | -------------------------------------------- |
| `npm run dev`            | Start the API in watch mode.                 |
| `npm run build`          | Compile TypeScript.                          |
| `npm run start`          | Start the compiled API.                      |
| `npm run lint`           | Run ESLint.                                  |
| `npm run format`         | Format files with Prettier.                  |
| `npm run format:check`   | Check formatting with Prettier.              |
| `npm run typecheck`      | Check TypeScript types.                      |
| `npm run check`          | Run lint, format check, typecheck and build. |
| `npm run openapi:export` | Export the OpenAPI contract.                 |

## Environment variables

| Name                   | Required | Default       | Description                        |
| ---------------------- | -------- | ------------- | ---------------------------------- |
| `NODE_ENV`             | No       | `development` | Runtime environment.               |
| `HOST`                 | No       | `0.0.0.0`     | Listening address.                 |
| `PORT`                 | No       | `4000`        | Listening port.                    |
| `LOG_LEVEL`            | No       | `info`        | Minimum log level.                 |
| `CORS_ORIGINS`         | Yes      | —             | Comma-separated allowed origins.   |
| `TRUST_PROXY_HOPS`     | No       | `0`           | Number of trusted proxy hops.      |
| `RATE_LIMIT_MAX`       | No       | `300`         | Maximum requests per window.       |
| `RATE_LIMIT_WINDOW_MS` | No       | `60000`       | Rate limit window in milliseconds. |

## API contract

`GET /openapi.json` is available outside production. Run `npm run openapi:export` to write `openapi.json` for frontend type generation.

## Deploy on Railway

Create a new service from [TODOOAPP-BACKEND](https://github.com/l1teeee/TODOOAPP-BACKEND). Railway uses the Railpack builder configured in `railway.json`. Set the environment variables, including `TRUST_PROXY_HOPS=1`, generate a public domain, and use `/health` as the healthcheck.

## Error format

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [] } }
```

`details` is optional.
