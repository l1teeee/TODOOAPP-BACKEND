import { check } from "k6";
import { capPerVu } from "../lib/config.js";
import { readJson, request } from "../lib/http.js";
import { pickWeighted, randomInt } from "../lib/random.js";

export const ENDPOINTS = [
  "GET /v1/activities",
  "POST /v1/activities",
  "GET /v1/activities/:id",
  "PATCH /v1/activities/:id",
  "GET /v1/activities/completed",
  "GET /v1/activities/trash",
  "POST /v1/activities/:id/trash",
  "POST /v1/activities/:id/restore",
  "DELETE /v1/activities/:id",
];

// Target number of scenario activities per user.
const ACTIVITIES_PER_USER = 60;
const createdIds = [];
let completed = false;

function dateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function trash(token, id) {
  request("POST", `/v1/activities/${id}/trash`, {
    token,
    name: "POST /v1/activities/:id/trash",
    expected: 200,
  });
}

function remove(token, id) {
  request("DELETE", `/v1/activities/${id}`, {
    token,
    name: "DELETE /v1/activities/:id",
    expected: 204,
  });
}

function createTask(token) {
  const res = request("POST", "/v1/activities", {
    token,
    body: { kind: "task", title: "Load test task", scheduledDate: dateOffset(randomInt(0, 6)) },
    name: "POST /v1/activities",
    expected: 201,
  });
  const id = readJson(res)?.id;
  if (!id) return null;
  createdIds.push(id);
  if (createdIds.length > capPerVu(ACTIVITIES_PER_USER)) {
    const oldest = createdIds.shift();
    trash(token, oldest);
    remove(token, oldest);
  }
  return id;
}

function activityId(token) {
  if (!createdIds.length) createTask(token);
  return createdIds[randomInt(0, createdIds.length - 1)];
}

function week(token) {
  return request("GET", `/v1/activities?from=${dateOffset(0)}&to=${dateOffset(6)}`, {
    token,
    name: "GET /v1/activities",
    expected: 200,
  });
}

function get(token, id) {
  request("GET", `/v1/activities/${id}`, { token, name: "GET /v1/activities/:id", expected: 200 });
}

function patch(token, id, status) {
  request("PATCH", `/v1/activities/${id}`, {
    token,
    body: { status },
    name: "PATCH /v1/activities/:id",
    expected: 200,
  });
}

function completedList(token) {
  request("GET", "/v1/activities/completed?limit=50", {
    token,
    name: "GET /v1/activities/completed",
    expected: 200,
  });
}

function trashList(token) {
  request("GET", "/v1/activities/trash?limit=50", {
    token,
    name: "GET /v1/activities/trash",
    expected: 200,
  });
}

export function activitiesAction(token) {
  const { action } = pickWeighted([
    { weight: 45, action: () => week(token) },
    { weight: 15, action: () => createTask(token) },
    {
      weight: 15,
      action: () => {
        completed = !completed;
        const id = activityId(token);
        if (id) patch(token, id, completed ? "completed" : "in_progress");
      },
    },
    {
      weight: 10,
      action: () => {
        const id = activityId(token);
        if (id) get(token, id);
      },
    },
    { weight: 10, action: () => completedList(token) },
    { weight: 5, action: () => trashList(token) },
  ]);
  action();
}

export function activitiesSmoke(token) {
  const id = createTask(token);
  if (!id) return;
  get(token, id);
  patch(token, id, "completed");
  const res = week(token);
  check(res, {
    "activity is listed": (r) => Boolean(readJson(r)?.items?.some((item) => item.id === id)),
  });
  completedList(token);
  trash(token, id);
  trashList(token);
  request("POST", `/v1/activities/${id}/restore`, {
    token,
    name: "POST /v1/activities/:id/restore",
    expected: 200,
  });
  trash(token, id);
  remove(token, id);
  const index = createdIds.indexOf(id);
  if (index >= 0) createdIds.splice(index, 1);
}
