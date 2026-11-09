import { test, expect } from "@playwright/test";
test("mobile evidence, edit, explicit approval, and reload", async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on("pageerror", error => browserErrors.push(error.message));
  page.on("console", message => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.goto("/");
  await expect(page.getByText("Historical sample", { exact: true })).toBeVisible();
  await expect(page.getByText("2 hours overlap")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare draft" })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true, caret: "initial" });
  await page.getByText("View source evidence").click();
  await expect(page.getByText(/image10.png/)).toBeVisible();
  await page.getByRole("button", { name: "Prepare draft" }).click();
  await expect(page.getByText("No follow-up tasks yet.")).toBeVisible();
  const message = page.getByRole("textbox", { name: "Draft message" });
  await message.fill("Hi Dana, can we talk about coverage?");
  await page.getByRole("button", { name: "Review draft" }).click();
  await message.fill("Hi Dana, can we review coverage options?");
  await expect(page.getByRole("button", { name: "Approve & create task" })).toBeDisabled();
  await page.getByRole("button", { name: "Review draft" }).click();
  await page.getByRole("button", { name: "Approve & create task" }).click();
  await expect(page.getByText("Task created", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Hi Dana, can we review coverage options?")).toBeVisible();
  await expect(page.getByText("Conflict open", { exact: true })).toBeVisible();
  await page.getByText("Record a resolution").click();
  await page.getByRole("textbox", { name: "Resolution evidence" }).fill("Example: Dana confirmed coverage.");
  await page.getByRole("button", { name: "Save resolution" }).click();
  await expect(page.getByText("Conflict resolved")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(browserErrors).toEqual([]);
});

test("dismisses a draft without writing and denies anonymous private calls", async ({ page, request }) => {
  expect((await request.post("/api/proposal")).status()).toBe(401);
  expect((await request.get("/api/workspace")).status()).toBe(401);
  expect((await request.post("/api/workspace", { data: { type: "resolve", evidence: "Untrusted content" } })).status()).toBe(401);
  await page.goto("/");
  await page.getByRole("button", { name: "Prepare draft" }).click();
  await expect(page.getByText("Offline demo draft")).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByText("Draft dismissed")).toBeVisible();
  await expect(page.getByText("No actions recorded yet.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("No follow-up tasks yet.")).toBeVisible();
});

test("renders the desktop workspace in two columns", async ({ browser }, testInfo) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://127.0.0.1:3187/");
  await expect(page.getByRole("button", { name: "Prepare draft" })).toBeEnabled();
  const schedule = await page.getByRole("region", { name: "Day schedule" }).boundingBox();
  const conflict = await page.getByRole("region", { name: "Schedule conflict" }).boundingBox();
  expect(schedule?.y).toBe(conflict?.y);
  expect(conflict!.x).toBeGreaterThan(schedule!.x + schedule!.width);
  await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true, caret: "initial" });
  await page.close();
});

test("shows a separate synthetic example with exactly adjacent commitments", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Try the adjacent example" }).click();
  await expect(page.getByText("Synthetic example", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No time overlap" })).toBeVisible();
  await expect(page.getByText("Travel time is not evaluated.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare draft" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Chloe’s schedule" }).click();
  await expect(page.getByText("2 hours overlap")).toBeVisible();
});
