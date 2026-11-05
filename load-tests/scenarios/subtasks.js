import { check } from "k6";
import { capPerVu } from "../lib/config.js";
import { readJson, request } from "../lib/http.js";
import { pickWeighted, randomInt } from "../lib/random.js";

export const ENDPOINTS = [
  "GET /v1/activities/:activityId/subtasks",
  "POST /v1/activities/:activityId/subtasks",
  "POST /v1/activities/:activityId/subtasks/batch",
  "PATCH /v1/subtasks/:id",
  "DELETE /v1/subtasks/:id",
  "POST /v1/activities",
  "POST /v1/activities/:id/trash",
  "DELETE /v1/activities/:id",
];

// Target number of subtasks per user.
const SUBTASKS_PER_USER = 20;
const subtaskIds = [];
let parentId;
function createParent(token) {
  const res = request("POST", "/v1/activities", {
    token,
    body: {
      kind: "task",
      title: "Load test subtask parent",
      scheduledDate: new Date().toISOString().slice(0, 10),
    },
    name: "POST /v1/activities",
    expected: 201,
  });
  return readJson(res)?.id;
}
function remove(token, id) {
  request("DELETE", `/v1/subtasks/${id}`, {
    token,
    name: "DELETE /v1/subtasks/:id",
    expected: 204,
  });
}
function remember(token, id) {
  if (!id) return;
  subtaskIds.push(id);
  if (subtaskIds.length > capPerVu(SUBTASKS_PER_USER)) remove(token, subtaskIds.shift());
}
function create(token, activityId, track = true) {
  const res = request("POST", `/v1/activities/${activityId}/subtasks`, {
    token,
    body: { title: "Load test subtask" },
    name: "POST /v1/activities/:activityId/subtasks",
    expected: 201,
  });
  const id = readJson(res)?.id;
  if (track) remember(token, id);
  return id;
}
function batch(token, activityId, track = true) {
  const res = request("POST", `/v1/activities/${activityId}/subtasks/batch`, {
    token,
    body: { titles: ["Load test subtask 1", "Load test subtask 2"] },
    name: "POST /v1/activities/:activityId/subtasks/batch",
    expected: 201,
  });
  const ids = (readJson(res)?.items || []).map((item) => item.id);
  if (track) for (const id of ids) remember(token, id);
  return ids;
}
function list(token, activityId) {
  return request("GET", `/v1/activities/${activityId}/subtasks`, {
    token,
    name: "GET /v1/activities/:activityId/subtasks",
    expected: 200,
  });
}
function patch(token, id) {
  request("PATCH", `/v1/subtasks/${id}`, {
    token,
    body: { isDone: true },
    name: "PATCH /v1/subtasks/:id",
    expected: 200,
  });
}
export function subtasksAction(token) {
  if (!parentId) parentId = createParent(token);
  if (!parentId) return;
  const activityId = parentId;
  pickWeighted([
    { weight: 50, action: () => list(token, activityId) },
    { weight: 20, action: () => create(token, activityId) },
    {
      weight: 20,
      action: () => {
        if (!subtaskIds.length) create(token, activityId);
        if (!subtaskIds.length) return;
        patch(token, subtaskIds[randomInt(0, subtaskIds.length - 1)]);
      },
    },
    { weight: 10, action: () => batch(token, activityId) },
  ]).action();
}
export function subtasksSmoke(token) {
  const activityId = createParent(token);
  if (!activityId) return;
  const id = create(token, activityId, false);
  if (!id) return;
  check(list(token, activityId), {
    "subtask is listed": (r) => Boolean(readJson(r)?.items?.some((item) => item.id === id)),
  });
  patch(token, id);
  for (const createdId of [id, ...batch(token, activityId, false)]) {
    remove(token, createdId);
    const index = subtaskIds.indexOf(createdId);
    if (index >= 0) subtaskIds.splice(index, 1);
  }
  request("POST", `/v1/activities/${activityId}/trash`, {
    token,
    name: "POST /v1/activities/:id/trash",
    expected: 200,
  });
  request("DELETE", `/v1/activities/${activityId}`, {
    token,
    name: "DELETE /v1/activities/:id",
    expected: 204,
  });
}
