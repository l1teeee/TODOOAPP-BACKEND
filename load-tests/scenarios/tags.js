import { check } from "k6";
import exec from "k6/execution";
import { capPerVu, RUN_ID } from "../lib/config.js";
import { readJson, request } from "../lib/http.js";
import { pickWeighted, randomInt } from "../lib/random.js";

export const ENDPOINTS = [
  "GET /v1/tags",
  "POST /v1/tags",
  "PATCH /v1/tags/:id",
  "DELETE /v1/tags/:id",
];

// Target number of tags per user.
const TAGS_PER_USER = 8;
const tagIds = [];
let counter = 0;
function name() {
  return `lt-${RUN_ID}-${exec.vu.idInTest}-${++counter}`;
}
function remove(token, id) {
  request("DELETE", `/v1/tags/${id}`, { token, name: "DELETE /v1/tags/:id", expected: 204 });
}
function create(token) {
  const res = request("POST", "/v1/tags", {
    token,
    body: { name: name(), color: "blue" },
    name: "POST /v1/tags",
    expected: 201,
  });
  const id = readJson(res)?.id;
  if (!id) return null;
  tagIds.push(id);
  if (tagIds.length > capPerVu(TAGS_PER_USER)) remove(token, tagIds.shift());
  return id;
}
function list(token) {
  return request("GET", "/v1/tags", { token, name: "GET /v1/tags", expected: 200 });
}
function patch(token, id) {
  request("PATCH", `/v1/tags/${id}`, {
    token,
    body: { name: name() },
    name: "PATCH /v1/tags/:id",
    expected: 200,
  });
}
export function tagsAction(token) {
  pickWeighted([
    { weight: 75, action: () => list(token) },
    {
      weight: 15,
      action: () => {
        if (!tagIds.length) create(token);
        if (!tagIds.length) return;
        patch(token, tagIds[randomInt(0, tagIds.length - 1)]);
      },
    },
    { weight: 10, action: () => create(token) },
  ]).action();
}
export function tagsSmoke(token) {
  const id = create(token);
  if (!id) return;
  check(list(token), {
    "tag is listed": (r) => Boolean(readJson(r)?.items?.some((item) => item.id === id)),
  });
  patch(token, id);
  remove(token, id);
  tagIds.splice(tagIds.indexOf(id), 1);
}
