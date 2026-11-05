import { request } from "../lib/http.js";
import { pickWeighted, randomInt } from "../lib/random.js";

export const ENDPOINTS = [
  "GET /health",
  "GET /health/ready",
  "GET /v1/meta",
  "GET /v1/me",
  "PATCH /v1/me",
];

export function platformSmoke(token) {
  request("GET", "/health", { name: "GET /health", expected: 200 });
  request("GET", "/health/ready", { name: "GET /health/ready", expected: 200 });
  request("GET", "/v1/meta", { name: "GET /v1/meta", expected: 200 });
  request("GET", "/v1/me", { token, name: "GET /v1/me", expected: 200 });
  request("PATCH", "/v1/me", {
    token,
    body: { displayName: "Load Test" },
    name: "PATCH /v1/me",
    expected: 200,
  });
}

export function platformAction(token) {
  const { action } = pickWeighted([
    {
      weight: 70,
      action: () => request("GET", "/v1/me", { token, name: "GET /v1/me", expected: 200 }),
    },
    {
      weight: 10,
      action: () =>
        request("PATCH", "/v1/me", {
          token,
          body: { displayName: `Load Test ${randomInt(1, 9)}` },
          name: "PATCH /v1/me",
          expected: 200,
        }),
    },
    {
      weight: 10,
      action: () => request("GET", "/v1/meta", { name: "GET /v1/meta", expected: 200 }),
    },
    {
      weight: 10,
      action: () => request("GET", "/health/ready", { name: "GET /health/ready", expected: 200 }),
    },
  ]);
  action();
}
