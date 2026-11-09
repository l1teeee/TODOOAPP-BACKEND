import { spawn } from "node:child_process";
import { access, mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const tokensFile = fileURLToPath(new URL("../../load-tests/.auth/tokens.json", import.meta.url));
const results = new URL("../../load-tests/results/", import.meta.url);

async function loadTokens() {
  let content: string;
  try {
    content = await readFile(tokensFile, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    throw new Error("Tokens missing; run npm run load:users", { cause: error });
  }
  if (!content.trim()) throw new Error("Tokens missing; run npm run load:users");
  const tokens = z.array(z.object({ expiresAt: z.number() })).parse(JSON.parse(content) as unknown);
  if (!tokens.length) throw new Error("Tokens missing; run npm run load:users");
  if (Math.min(...tokens.map((token) => token.expiresAt)) * 1000 - Date.now() < 600_000)
    throw new Error("Tokens expire in less than 10 minutes; run npm run load:users");
  return tokens;
}
function formatStamp(date: Date): string {
  const part = (value: number) => String(value).padStart(2, "0");
  return `${String(date.getUTCFullYear())}${part(date.getUTCMonth() + 1)}${part(date.getUTCDate())}-${part(date.getUTCHours())}${part(date.getUTCMinutes())}${part(date.getUTCSeconds())}`;
}
async function main() {
  const [test, ...flags] = process.argv.slice(2);
  if (
    !test ||
    !["smoke", "load", "spike", "breakpoint"].includes(test) ||
    flags.length > 1 ||
    (flags.length === 1 && flags[0] !== "--cloud")
  )
    throw new Error("Usage: npm run load -- <smoke|load|spike|breakpoint> [--cloud]");
  const baseUrl =
    process.env.BASE_URL === ""
      ? "http://localhost:4000"
      : (process.env.BASE_URL ?? "http://localhost:4000");
  const hostname = new URL(baseUrl).hostname;
  if (
    hostname !== "localhost" &&
    hostname !== "127.0.0.1" &&
    process.env.LOADTEST_ALLOWED_BASE_URL !== baseUrl
  )
    throw new Error("Non-local BASE_URL requires LOADTEST_ALLOWED_BASE_URL to match it exactly");
  await loadTokens();
  await mkdir(results, { recursive: true });
  const script = fileURLToPath(new URL(`../../load-tests/tests/${test}.js`, import.meta.url));
  const summary = fileURLToPath(new URL(`${test}-${formatStamp(new Date())}.json`, results));
  const variables: Record<string, string | undefined> = {
    BASE_URL: baseUrl,
    TOKENS_FILE: tokensFile,
    SUMMARY_FILE: summary,
    RUN_ID: Date.now().toString(36),
    RATE: process.env.RATE,
    DURATION: process.env.DURATION,
    BASE_RATE: process.env.BASE_RATE,
    SPIKE_RATE: process.env.SPIKE_RATE,
    BREAKPOINT_RATES: process.env.BREAKPOINT_RATES,
    STEP_SECONDS: process.env.STEP_SECONDS,
    WARMUP_SECONDS: process.env.WARMUP_SECONDS,
    MAX_VUS: process.env.MAX_VUS,
  };
  const envFlags: string[] = [];
  for (const [name, value] of Object.entries(variables))
    if (value !== undefined) envFlags.push("-e", `${name}=${value}`);
  const args = flags.length
    ? ["cloud", "run", "--local-execution", ...envFlags, script]
    : ["run", "--include-system-env-vars=false", ...envFlags, script];
  const child = spawn("k6", args, { stdio: "inherit" });
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT")
        reject(new Error("k6 not found in PATH (install k6 v2.3 or newer)"));
      else reject(error);
    });
    child.on("close", resolve);
  });
  try {
    await access(summary);
    process.stdout.write(`Summary: ${summary}\n`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  process.exitCode = code ?? 1;
}
try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
