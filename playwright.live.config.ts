import { defineConfig } from "@playwright/test";

const required = [
  "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY",
  "CLEARWEEK_OWNER_ID", "GEMINI_API_KEY", "CLEARWEEK_SMOKE_EMAIL", "CLEARWEEK_SMOKE_PASSWORD",
];
const missing = required.filter(key => !process.env[key]?.trim());
if (missing.length) throw new Error(`Live smoke setup is missing: ${missing.join(", ")}`);
if (process.env.GEMINI_MODE !== "free" || process.env.CLEARWEEK_SMOKE_FREE_TIER_CONFIRMED !== "true") {
  throw new Error("Confirm in Google AI Studio that billing is unlinked, then set GEMINI_MODE=free and CLEARWEEK_SMOKE_FREE_TIER_CONFIRMED=true.");
}
const supabase = new URL(process.env.SUPABASE_URL!);
if (supabase.protocol !== "https:" || !supabase.hostname.endsWith(".supabase.co")) {
  throw new Error("Use the HTTPS project URL from hosted Supabase for this check.");
}

export default defineConfig({
  testDir: "./live",
  workers: 1,
  retries: 0,
  timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3188", trace: "off", screenshot: "off", video: "off" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3188",
    url: "http://127.0.0.1:3188",
    env: { CLEARWEEK_MODE: "private", CLEARWEEK_SMOKE_SINGLE_ATTEMPT: "true" },
  },
});
