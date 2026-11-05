import { describe, it, expect } from "@jest/globals";
import { loadConfig } from "../env.js";

describe("environment configuration", () => {
  const base = {
    NODE_ENV: "development",
    CORS_ORIGINS: "https://a.example.com, http://localhost:3000",
    DATABASE_URL: "postgres://user:secret-password@db.example.com/app",
    SUPABASE_URL: "https://project.supabase.co",
    EMAIL_FROM: "app@example.com",
  };
  const production = {
    ...base,
    NODE_ENV: "production",
    TRUST_PROXY_HOPS: "1",
    DATABASE_SSL: "true",
    EMAIL_PROVIDER: "brevo",
    BREVO_API_KEY: "key",
  };
  it("applies development defaults and derives Supabase URLs", () => {
    expect(loadConfig(base)).toMatchObject({
      logLevel: "info",
      database: { poolMax: 10, ssl: false },
      supabase: {
        jwksUrl: "https://project.supabase.co/auth/v1/.well-known/jwks.json",
        issuer: "https://project.supabase.co/auth/v1",
      },
      email: { provider: "log", fromName: "TODO App" },
      http: {
        host: "0.0.0.0",
        port: 4000,
        corsOrigins: ["https://a.example.com", "http://localhost:3000"],
        trustProxyHops: 0,
        rateLimit: { max: 300, windowMs: 60000 },
      },
    });
  });
  it.each(["https://a.example.com/", "https://a.example.com/path"])(
    "rejects invalid CORS origin %s",
    (origin) => {
      expect(() => {
        loadConfig({ ...base, CORS_ORIGINS: origin });
      }).toThrow("CORS_ORIGINS");
    },
  );
  it("rejects non-Postgres databases without disclosing the password", () => {
    expect(() => {
      loadConfig({ ...base, DATABASE_URL: "mysql://user:secret-password@db/app" });
    }).toThrow("DATABASE_URL");
    try {
      loadConfig({ ...base, DATABASE_URL: "mysql://user:secret-password@db/app" });
    } catch (error) {
      expect(String(error)).not.toContain("secret-password");
    }
  });
  it.each(["http://project.supabase.co", "https://project.supabase.co/"])(
    "rejects invalid Supabase URL %s",
    (url) => {
      expect(() => {
        loadConfig({ ...base, SUPABASE_URL: url });
      }).toThrow("SUPABASE_URL");
    },
  );
  it("requires production proxy, non-log email and public database TLS", () => {
    expect(() => {
      loadConfig({ ...production, TRUST_PROXY_HOPS: undefined });
    }).toThrow("TRUST_PROXY_HOPS");
    expect(() => {
      loadConfig({ ...production, EMAIL_PROVIDER: "log" });
    }).toThrow("EMAIL_PROVIDER");
    expect(() => {
      loadConfig({ ...production, DATABASE_SSL: "false" });
    }).toThrow("DATABASE_SSL");
    expect(
      loadConfig({
        ...production,
        DATABASE_URL: "postgres://user:password@postgres.railway.internal/app",
        DATABASE_SSL: "false",
      }).database.ssl,
    ).toBe(false);
  });
  it("requires the selected email provider key", () => {
    expect(() => {
      loadConfig({ ...base, EMAIL_PROVIDER: "brevo" });
    }).toThrow("BREVO_API_KEY");
    expect(() => {
      loadConfig({ ...base, EMAIL_PROVIDER: "resend" });
    }).toThrow("RESEND_API_KEY");
  });
});
