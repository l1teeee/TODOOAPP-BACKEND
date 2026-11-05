import { SharedArray } from "k6/data";
import exec from "k6/execution";

export const BASE_URL = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/+$/, "");
export const RUN_ID = __ENV.RUN_ID || Date.now().toString(36);
// These two limits define "broken" for every test.
export const SLO = { p95Ms: 500, maxErrorRate: 0.01 };

export function envNumber(name, fallback) {
  const value = __ENV[name];
  if (value === undefined || value === "") return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${name} must be a positive number`);
  return number;
}

export function envRates(name, fallback) {
  const value = __ENV[name];
  if (value === undefined || value === "") return fallback;
  return value.split(",").map((part) => {
    const number = Number(part.trim());
    if (!part.trim() || !Number.isFinite(number) || number <= 0) {
      throw new Error(`${name} must be a positive number`);
    }
    return number;
  });
}

export const TOKENS = new SharedArray("tokens", () => {
  if (!__ENV.TOKENS_FILE) throw new Error("TOKENS_FILE is not set; start tests with npm run load");
  const tokens = JSON.parse(open(__ENV.TOKENS_FILE));
  if (!tokens.length) throw new Error("Token file is empty; run npm run load:users");
  return tokens.map((token) => token.accessToken);
});

export const VUS_PER_USER = Math.ceil(envNumber("MAX_VUS", 100) / TOKENS.length);
export function capPerVu(perUserTarget) {
  return Math.max(1, Math.floor(perUserTarget / VUS_PER_USER));
}

export function tokenForVu() {
  return TOKENS[(exec.vu.idInTest - 1) % TOKENS.length];
}
