import { check } from "k6";
import http from "k6/http";
import { BASE_URL } from "./config.js";

const callbacks = new Map();

export function request(method, path, { token, body, name, expected }) {
  if (!callbacks.has(expected)) callbacks.set(expected, http.expectedStatuses(expected));
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = http.request(
    method,
    BASE_URL + path,
    body === undefined ? null : JSON.stringify(body),
    {
      headers,
      tags: { name },
      responseCallback: callbacks.get(expected),
    },
  );
  check(res, { [`${name} returns ${expected}`]: (r) => r.status === expected });
  return res;
}

export function readJson(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}
