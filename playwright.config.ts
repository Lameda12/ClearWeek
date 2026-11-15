import { randomUUID } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

// The signed-in flow runs against e2e/support/stub-backend.mjs: no network, no real keys, no real data.
// Every value below is a throwaway test value. They are set explicitly so a developer's .env.local is never used.
const stubPort = 3190;
const stub = `http://127.0.0.1:${stubPort}`;
process.env.E2E_STUB_PASSWORD ??= randomUUID();
export const e2e = {
  stub, privateUrl: "http://127.0.0.1:3189",
  secretKey: "e2e-secret-key-must-never-reach-the-browser",
  geminiKey: "e2e-gemini-key-must-never-reach-the-browser",
  publishableKey: "e2e-publishable-key",
  owner: "00000000-0000-4000-8000-0000000000e2",
};

export default defineConfig({
  testDir: "./e2e",
  use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", baseURL: "http://127.0.0.1:3187" },
  webServer: [
    { command: "npm run start -- --hostname 127.0.0.1 --port 3187", url: "http://127.0.0.1:3187", env: { CLEARWEEK_MODE: "demo" } },
    { command: "node e2e/support/stub-backend.mjs", url: stub, env: { E2E_STUB_PORT: String(stubPort), E2E_STUB_PASSWORD: process.env.E2E_STUB_PASSWORD } },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3189", url: e2e.privateUrl,
      env: {
        CLEARWEEK_MODE: "private", SUPABASE_URL: stub, SUPABASE_PUBLISHABLE_KEY: e2e.publishableKey, SUPABASE_SECRET_KEY: e2e.secretKey,
        CLEARWEEK_OWNER_ID: e2e.owner, GEMINI_API_KEY: e2e.geminiKey, GEMINI_MODEL: "gemini-3.1-flash-lite", GEMINI_MODE: "free",
        GEMINI_PAID_CAP_VERIFIED: "false", CLEARWEEK_SMOKE_SINGLE_ATTEMPT: "false",
        // The Gemini SDK reads this and sends its requests to the stub instead of Google.
        GOOGLE_GEMINI_BASE_URL: stub,
      },
    },
  ],
});
