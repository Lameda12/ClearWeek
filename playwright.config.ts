import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  use: { ...devices["iPhone 13"], defaultBrowserType: "chromium", baseURL: "http://127.0.0.1:3187" },
  webServer: [
    { command: "npm run start -- --hostname 127.0.0.1 --port 3187", url: "http://127.0.0.1:3187", env: { CLEARWEEK_MODE: "demo" } },
    // Sample-preview server for the import workflow. No model, network or credentials involved.
    { command: "npm run start -- --hostname 127.0.0.1 --port 3191", url: "http://127.0.0.1:3191", env: { CLEARWEEK_MODE: "demo", CLEARWEEK_EXTRACTION: "sample" } },
  ],
});
