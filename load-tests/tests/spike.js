import { envNumber, SLO, tokenForVu } from "../lib/config.js";
import { createHandleSummary, endpointReport, endpointThresholds } from "../lib/summary.js";
import { runWeightedAction } from "../scenarios/index.js";

const base = envNumber("BASE_RATE", 10);
const spike = envNumber("SPIKE_RATE", 500);
export const options = {
  cloud: { name: "TODO API spike" },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
  scenarios: {
    spike: {
      executor: "ramping-arrival-rate",
      startRate: base,
      stages: [
        { duration: "30s", target: spike },
        { duration: "1m", target: spike },
        { duration: "30s", target: base },
        { duration: "1m", target: base },
      ],
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
export const handleSummary = createHandleSummary("spike", (data) => {
  const { text, endpoints } = endpointReport(data);
  return { text, extra: { endpoints } };
});
export default function () {
  runWeightedAction(tokenForVu());
}
