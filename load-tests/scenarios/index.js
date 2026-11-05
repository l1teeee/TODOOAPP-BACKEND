import { group } from "k6";
import { pickWeighted } from "../lib/random.js";
import {
  activitiesAction,
  activitiesSmoke,
  ENDPOINTS as activitiesEndpoints,
} from "./activities.js";
import { listsAction, listsSmoke, ENDPOINTS as listsEndpoints } from "./lists.js";
import { platformAction, platformSmoke, ENDPOINTS as platformEndpoints } from "./platform.js";
import { subtasksAction, subtasksSmoke, ENDPOINTS as subtasksEndpoints } from "./subtasks.js";
import { summaryAction, summarySmoke, ENDPOINTS as summaryEndpoints } from "./summary.js";
import { tagsAction, tagsSmoke, ENDPOINTS as tagsEndpoints } from "./tags.js";

export const ENDPOINT_NAMES = [
  ...new Set([
    ...platformEndpoints,
    ...activitiesEndpoints,
    ...listsEndpoints,
    ...tagsEndpoints,
    ...subtasksEndpoints,
    ...summaryEndpoints,
  ]),
];

// Each load-tested module adds one entry; its weight is its expected share of traffic.
// auth-gateway (Turnstile, Supabase admin API, Brevo) and ai-assistant (paid DeepInfra calls) are not load-tested.
export const MODULE_SCENARIOS = [
  { name: "platform", weight: 10, action: platformAction, smoke: platformSmoke },
  { name: "activities", weight: 50, action: activitiesAction, smoke: activitiesSmoke },
  { name: "lists", weight: 10, action: listsAction, smoke: listsSmoke },
  { name: "tags", weight: 10, action: tagsAction, smoke: tagsSmoke },
  { name: "subtasks", weight: 12, action: subtasksAction, smoke: subtasksSmoke },
  { name: "summary", weight: 8, action: summaryAction, smoke: summarySmoke },
];
export function runWeightedAction(token) {
  pickWeighted(MODULE_SCENARIOS).action(token);
}
export function runAllSmokes(token) {
  for (const scenario of MODULE_SCENARIOS) group(scenario.name, () => scenario.smoke(token));
}
