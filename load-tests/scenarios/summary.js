import { request } from "../lib/http.js";

export const ENDPOINTS = ["GET /v1/summary"];

export function summaryAction(token) {
  const today = new Date().toISOString().slice(0, 10);
  request("GET", `/v1/summary?today=${today}`, { token, name: "GET /v1/summary", expected: 200 });
}

export function summarySmoke(token) {
  summaryAction(token);
}
