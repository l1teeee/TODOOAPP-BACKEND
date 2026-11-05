import { envNumber, SLO, tokenForVu } from "../lib/config.js";
import { createHandleSummary, endpointReport, endpointThresholds } from "../lib/summary.js";
import { runWeightedAction } from "../scenarios/index.js";

export const options = {
  cloud: { name: "TODO API load" },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
  scenarios: {
    load: {
      executor: "constant-arrival-rate",
      rate: envNumber("RATE", 50),
      duration: __ENV.DURATION || "10m",
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: envNumber("MAX_VUS", 100),
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${SLO.p95Ms}`],
    http_req_failed: [`rate<${SLO.maxErrorRate}`],
    ...endpointThresholds(),
  },
};
export const handleSummary = createHandleSummary("load", (data) => {
  const { text, endpoints } = endpointReport(data);
  return { text, extra: { endpoints } };
});
export default function () {
  runWeightedAction(tokenForVu());
}
