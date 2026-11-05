import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const command = process.argv[2] ?? "create";
if ((command !== "create" && command !== "delete") || process.argv.length > 3) {
  process.stderr.write("Usage: npm run load:users -- [create|delete]\n");
  process.exit(1);
}
const schema = z
  .object({
    SUPABASE_URL: z.url().refine((value) => {
      const url = new URL(value);
      return url.protocol === "https:" && url.origin === value;
    }),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    LOADTEST_SUPABASE_PROJECT_REF: z.string().min(1),
    LOADTEST_USER_COUNT: z.coerce.number().int().min(1).max(100).default(20),
    LOADTEST_SIGNIN_DELAY_MS: z.coerce.number().int().nonnegative().default(2100),
    LOADTEST_USER_PASSWORD: z.string().min(12),
    LOADTEST_EMAIL_DOMAIN: z
      .string()
      .regex(
        /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
      )
      .default("example.com"),
  })
  .refine(
    (values) =>
      values.LOADTEST_SUPABASE_PROJECT_REF === new URL(values.SUPABASE_URL).hostname.split(".")[0],
    { path: ["LOADTEST_SUPABASE_PROJECT_REF"] },
  );
const result = schema.safeParse(process.env);
if (!result.success) {
  process.stderr.write(
    `Invalid environment keys: ${[...new Set(result.error.issues.map((issue) => issue.path[0]))].join(", ")}\n`,
  );
  process.exit(1);
}
const env = result.data;
const auth = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth });
const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, { auth });
const tokensFile = new URL("../../load-tests/.auth/tokens.json", import.meta.url);

interface Token {
  email: string;
  userId: string;
  accessToken: string;
  expiresAt: number;
}

async function provisionUser(i: number): Promise<Token> {
  const email = `loadtest-${String(i).padStart(3, "0")}@${env.LOADTEST_EMAIL_DOMAIN}`;
  const { error } = await admin.auth.admin.createUser({
    email,
    password: env.LOADTEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Load Test ${String(i)}`, load_test: true },
  });
  if (error && error.code !== "email_exists" && error.code !== "user_already_exists")
    throw new Error(`Supabase create user failed: ${String(error.code)} ${String(error.status)}`);
  if (i > 1) await new Promise((resolve) => setTimeout(resolve, env.LOADTEST_SIGNIN_DELAY_MS));
  const signed = await client.auth.signInWithPassword({
    email,
    password: env.LOADTEST_USER_PASSWORD,
  });
  if (signed.error?.code === "over_request_rate_limit" || signed.error?.status === 429)
    throw new Error("Supabase sign-in rate limit reached; wait 5 minutes");
  if (signed.error?.code === "invalid_credentials")
    throw new Error(
      `Sign-in failed for ${email}; run npm run load:users -- delete, then create again`,
    );
  if (signed.error)
    throw new Error(
      `Supabase sign-in failed: ${String(signed.error.code)} ${String(signed.error.status)}`,
    );
  const session = signed.data.session;
  if (!session.expires_at) throw new Error("Supabase session has no expiry");
  return {
    email,
    userId: signed.data.user.id,
    accessToken: session.access_token,
    expiresAt: session.expires_at,
  };
}
async function writeTokens(tokens: Token[]) {
  await mkdir(new URL("../../load-tests/.auth/", import.meta.url), {
    recursive: true,
    mode: 0o700,
  });
  await writeFile(tokensFile, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  await chmod(tokensFile, 0o600);
}
async function createUsers() {
  const tokens: Token[] = [];
  for (let i = 1; i <= env.LOADTEST_USER_COUNT; i++) {
    tokens.push(await provisionUser(i));
    if (i % 10 === 0)
      process.stdout.write(`Signed in ${String(i)}/${String(env.LOADTEST_USER_COUNT)}\n`);
  }
  await writeTokens(tokens);
  const earliest = Math.min(...tokens.map((token) => token.expiresAt));
  process.stdout.write(
    `Prepared ${String(tokens.length)} load-test users; tokens expire at ${new Date(earliest * 1000).toISOString()}\n`,
  );
}
async function deleteUsers() {
  const domain = env.LOADTEST_EMAIL_DOMAIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^loadtest-\\d{3}@${domain}$`);
  const ids: string[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error)
      throw new Error(`Supabase list users failed: ${String(error.code)} ${String(error.status)}`);
    for (const user of data.users)
      if (user.email && pattern.test(user.email) && user.user_metadata.load_test === true)
        ids.push(user.id);
    if (data.users.length < 1000) break;
  }
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error)
      throw new Error(`Supabase delete user failed: ${String(error.code)} ${String(error.status)}`);
  }
  await rm(tokensFile, { force: true });
  process.stdout.write(`Deleted ${String(ids.length)} load-test users\n`);
}
async function main() {
  if (command === "create") await createUsers();
  else await deleteUsers();
}
await main();
