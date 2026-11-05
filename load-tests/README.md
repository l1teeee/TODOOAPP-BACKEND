# Load tests

The smoke test calls each load-tested endpoint once. The load test measures a constant arrival rate, the spike test measures recovery from a sudden peak, and the breakpoint test steps up until latency or errors exceed the SLO.

## Prerequisites

Install k6 v2.3 or newer. Build the API and start it with `npm start` with `RATE_LIMIT_MAX=1000000`, `LOG_LEVEL=warn`, `EMAIL_PROVIDER=log`, `OTEL_TRACES_SAMPLER_ARG=0.1`, and an empty `SENTRY_DSN`. Otherwise the per-IP limit produces 429s and a real email provider mails every new test profile. Sentry's free plan has 5,000 errors per month, and Grafana's free plan caps traces and logs. Never point `BASE_URL` at production.

Copy `.env.example` to `load-tests/.env`; `SUPABASE_URL` and `SUPABASE_SECRET_KEY` come from the backend `.env`.

Set `LOADTEST_SUPABASE_PROJECT_REF` to the first DNS label of the dedicated Supabase test project's host. For a non-local test API, set `LOADTEST_ALLOWED_BASE_URL` to the exact `BASE_URL`. Subtask load scenarios keep one parent activity per VU in the test database.

Start every run with an empty test database; the brain's cycle script truncates the feature tables. Per-user targets are 60 activities, 8 lists, 8 tags and 20 subtasks, divided among VUs sharing each token. Each VU retains at least one of each, and subtask parent activities are additional, so actual counts can exceed the targets.

Supabase allows 150 password sign-ins per five minutes per IP with bursts of 30. `LOADTEST_SIGNIN_DELAY_MS` defaults to 2100 milliseconds between sign-ins.

## Commands

- `npm run load:users` prepares users and tokens. Tokens last one hour; rerun before each session.
- `npm run load -- smoke` verifies the endpoints.
- `npm run load -- breakpoint` finds the breaking point.
- `npm run load:users -- delete` removes the test users.

## Reading the breakpoint

The last passing rate is capacity in requests per second; one iteration is one request in most actions. Estimated concurrent active users = capacity x 10, assuming each active user sends one request every 10 seconds. Run again with `BREAKPOINT_RATES` between the last passing and first failing rates to refine the estimate.

The breakpoint test warms up for `WARMUP_SECONDS` (60 by default); set it to 0 to disable warm-up. Warm-up requests are excluded from the step table.

## Grafana Cloud k6

Run `k6 cloud login --token <personal token> --stack <your-stack-slug>` once. Find the token in Grafana Cloud under Testing & synthetics > Performance > Settings > Access > Personal token. Add `--cloud` to a load command to stream results. VUh = max VUs x minutes / 60, with 25% less for local execution. The free tier has 500 VUh per month and 100 VUs per test.

## Adding a module

Create `scenarios/<module>.js` exporting `<module>Action(token)` and `<module>Smoke(token)`, add an entry to `MODULE_SCENARIOS`, and rebalance weights. Name tags `METHOD /path/:param` and keep created data bounded per VU. Modules calling paid or rate-limited third parties stay out: auth-gateway (Turnstile, Supabase admin API, Brevo) and ai-assistant (paid DeepInfra calls).
