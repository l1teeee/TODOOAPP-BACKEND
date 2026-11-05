import exec from "k6/execution";
import { envNumber, envRates, SLO, tokenForVu } from "../lib/config.js";
import { createHandleSummary, endpointReport, endpointThresholds } from "../lib/summary.js";
import { runWeightedAction } from "../scenarios/index.js";

const RATES = envRates("BREAKPOINT_RATES", [10, 20, 40, 80, 160, 320, 640, 1280]);
if (new Set(RATES).size !== RATES.length)
  throw new Error("BREAKPOINT_RATES must not contain duplicate values");
const STEP_SECONDS = envNumber("STEP_SECONDS", 60);
const RAMP_SECONDS = 15;
const WARMUP_SECONDS = __ENV.WARMUP_SECONDS === "0" ? 0 : envNumber("WARMUP_SECONDS", 60);
const stages = [];
if (WARMUP_SECONDS > 0) stages.push({ duration: `${WARMUP_SECONDS}s`, target: RATES[0] });
const thresholds = endpointThresholds();
for (const rate of RATES) {
  stages.push(
    { duration: `${RAMP_SECONDS}s`, target: rate },
    { duration: `${STEP_SECONDS}s`, target: rate },
  );
  thresholds[`http_req_duration{step:${rate}}`] = [
    { threshold: `p(95)<${SLO.p95Ms}`, abortOnFail: true, delayAbortEval: "20s" },
  ];
  thresholds[`http_req_failed{step:${rate}}`] = [
    { threshold: `rate<${SLO.maxErrorRate}`, abortOnFail: true, delayAbortEval: "20s" },
  ];
  // This threshold only creates the per-step request count.
  thresholds[`http_reqs{step:${rate}}`] = ["count>=0"];
}
export const options = {
  cloud: { name: "TODO API breakpoint" },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
  scenarios: {
    breakpoint: {
      executor: "ramping-arrival-rate",
      startRate: WARMUP_SECONDS > 0 ? 10 : RATES[0],
      stages,
      timeUnit: "1s",
      preAllocatedVUs: 20,
      maxVUs: envNumber("MAX_VUS", 100),
    },
  },
  thresholds,
};
function currentStepRate() {
  const elapsedSeconds = (Date.now() - exec.scenario.startTime) / 1000;
  if (elapsedSeconds < WARMUP_SECONDS) return "warmup";
  return RATES[
    Math.min(
      RATES.length - 1,
      Math.floor((elapsedSeconds - WARMUP_SECONDS) / (RAMP_SECONDS + STEP_SECONDS)),
    )
  ];
}
export const handleSummary = createHandleSummary("breakpoint", (data) => {
  const steps = [];
  for (const rate of RATES) {
    const requests = data.metrics[`http_reqs{step:${rate}}`]?.values.count;
    if (!requests) continue;
    const p95Ms = data.metrics[`http_req_duration{step:${rate}}`].values["p(95)"];
    const errorRate = data.metrics[`http_req_failed{step:${rate}}`].values.rate;
    steps.push({
      rate,
      requests,
      p95Ms,
      errorRate,
      passed: p95Ms < SLO.p95Ms && errorRate < SLO.maxErrorRate,
    });
  }
  const failingIndex = steps.findIndex((step) => !step.passed);
  const firstFailingRate = failingIndex < 0 ? null : steps[failingIndex].rate;
  const lastPassingRate =
    (failingIndex < 0 ? steps : steps.slice(0, failingIndex)).filter((step) => step.passed).at(-1)
      ?.rate ?? null;
  const droppedIterations = data.metrics.dropped_iterations?.values.count || 0;
  let text = "\n";
  for (const rate of RATES) {
    const step = steps.find((item) => item.rate === rate);
    if (!step) text += `step ${rate} it/s: not reached\n`;
    else
      text += `step ${step.rate} it/s: ${step.requests} req, p95 ${step.p95Ms.toFixed(2)} ms, errors ${(step.errorRate * 100).toFixed(2)}%, ${step.passed ? "PASS" : "FAIL"}\n`;
  }
  text += `Last passing rate: ${lastPassingRate ?? "none"} it/s; first failing rate: ${firstFailingRate ?? "none"} it/s\n`;
  if (droppedIterations > 0)
    text += `Dropped iterations: ${droppedIterations} (MAX_VUS too low or the API too slow)\n`;
  const endpoints = endpointReport(data);
  return {
    text: text + endpoints.text,
    extra: {
      steps,
      lastPassingRate,
      firstFailingRate,
      droppedIterations,
      endpoints: endpoints.endpoints,
    },
  };
});
export default function () {
  exec.vu.metrics.tags.step = String(currentStepRate());
  runWeightedAction(tokenForVu());
}
