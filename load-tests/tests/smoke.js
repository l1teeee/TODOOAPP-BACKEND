import { tokenForVu } from "../lib/config.js";
import { createHandleSummary } from "../lib/summary.js";
import { runAllSmokes } from "../scenarios/index.js";

export const options = {
  cloud: { name: "TODO API smoke" },
  vus: 1,
  iterations: 1,
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
  thresholds: { checks: ["rate==1"], http_req_failed: ["rate==0"] },
};
export const handleSummary = createHandleSummary("smoke");
export default function () {
  runAllSmokes(tokenForVu());
}
