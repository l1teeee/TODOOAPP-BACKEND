import { textSummary } from "https://jslib.k6.io/k6-summary/0.1.0/index.js";
import { ENDPOINT_NAMES } from "../scenarios/index.js";

export function endpointThresholds() {
  const thresholds = {};
  for (const name of ENDPOINT_NAMES) {
    thresholds[`http_req_duration{name:${name}}`] = ["p(95)>=0"];
    thresholds[`http_reqs{name:${name}}`] = ["count>=0"];
  }
  return thresholds;
}

export function endpointReport(data) {
  const endpoints = [];
  for (const name of ENDPOINT_NAMES) {
    const duration = data.metrics[`http_req_duration{name:${name}}`]?.values;
    const requests = data.metrics[`http_reqs{name:${name}}`]?.values.count;
    if (!duration || requests === undefined) continue;
    endpoints.push({ name, count: requests, avgMs: duration.avg, p95Ms: duration["p(95)"] });
  }
  endpoints.sort((a, b) => b.p95Ms - a.p95Ms);
  let text = "\n";
  for (const endpoint of endpoints)
    text += `${endpoint.name}: ${endpoint.count} req, avg ${endpoint.avgMs.toFixed(2)} ms, p95 ${endpoint.p95Ms.toFixed(2)} ms\n`;
  return { text, endpoints };
}

export function createHandleSummary(testName, extraReport) {
  return (data) => {
    const { text, extra } = extraReport ? extraReport(data) : { text: "", extra: null };
    const output = { stdout: textSummary(data, { indent: " ", enableColors: false }) + text };
    if (__ENV.SUMMARY_FILE)
      output[__ENV.SUMMARY_FILE] = JSON.stringify({ testName, extra, data }, null, 2);
    return output;
  };
}
