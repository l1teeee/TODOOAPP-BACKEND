import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL;

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/**/persistence/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  ...(url ? { dbCredentials: { url } } : {}),
});
