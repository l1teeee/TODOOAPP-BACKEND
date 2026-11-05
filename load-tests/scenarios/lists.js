import { check } from "k6";
import exec from "k6/execution";
import { capPerVu, RUN_ID } from "../lib/config.js";
import { readJson, request } from "../lib/http.js";
import { pickWeighted, randomInt } from "../lib/random.js";

export const ENDPOINTS = [
  "GET /v1/lists",
  "POST /v1/lists",
  "PATCH /v1/lists/:id",
  "DELETE /v1/lists/:id",
];

// Target number of lists per user.
const LISTS_PER_USER = 8;
const listIds = [];
let counter = 0;
function name() {
  return `lt-${RUN_ID}-${exec.vu.idInTest}-${++counter}`;
}
function remove(token, id) {
  request("DELETE", `/v1/lists/${id}`, { token, name: "DELETE /v1/lists/:id", expected: 204 });
}
function create(token) {
  const res = request("POST", "/v1/lists", {
    token,
    body: { name: name(), icon: "list" },
    name: "POST /v1/lists",
    expected: 201,
  });
  const id = readJson(res)?.id;
  if (!id) return null;
  listIds.push(id);
  if (listIds.length > capPerVu(LISTS_PER_USER)) remove(token, listIds.shift());
  return id;
}
function list(token) {
  return request("GET", "/v1/lists", { token, name: "GET /v1/lists", expected: 200 });
}
function patch(token, id) {
  request("PATCH", `/v1/lists/${id}`, {
    token,
    body: { name: name() },
    name: "PATCH /v1/lists/:id",
    expected: 200,
  });
}
export function listsAction(token) {
  pickWeighted([
    { weight: 75, action: () => list(token) },
    {
      weight: 15,
      action: () => {
        if (!listIds.length) create(token);
        if (!listIds.length) return;
        patch(token, listIds[randomInt(0, listIds.length - 1)]);
      },
    },
    { weight: 10, action: () => create(token) },
  ]).action();
}
export function listsSmoke(token) {
  const id = create(token);
  if (!id) return;
  check(list(token), {
    "list is listed": (r) => Boolean(readJson(r)?.items?.some((item) => item.id === id)),
  });
  patch(token, id);
  remove(token, id);
  listIds.splice(listIds.indexOf(id), 1);
}
