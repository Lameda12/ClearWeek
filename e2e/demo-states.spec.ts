import { test, expect } from "@playwright/test";

test("each demo state link shows its screen, and Start clears a draft", async ({ page }) => {
  await page.goto("/?state=draft");
  await expect(page.getByRole("textbox", { name: "Draft message" })).toBeVisible();
  await expect(page.getByText("Open demo draft, no AI used")).toBeVisible();

  await page.getByRole("link", { name: "Template draft" }).click();
  await expect(page.getByText("Template draft. The AI suggestion was not available, so this is a standard message.")).toBeVisible();
  await expect(page.getByText("Template draft, no AI used")).toBeVisible();

  await page.getByRole("link", { name: "Error" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("The task was not created. Your draft is still here.");
  await expect(page.getByRole("button", { name: "Approve & create task" })).toBeEnabled();

  await page.getByRole("link", { name: "Loading" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Loading the saved workspace…" })).toBeAttached();

  await page.getByRole("link", { name: "No conflict" }).click();
  await expect(page.getByRole("heading", { name: "No conflicts on Friday" })).toBeVisible();

  await page.getByRole("link", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "Prepare draft" })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Draft message" })).toHaveCount(0);
});

test("a demo state link starts the demo over, even after a task was saved", async ({ page }) => {
  await page.goto("/?state=draft");
  await page.getByRole("button", { name: "Review draft" }).click();
  await page.getByRole("button", { name: "Approve & create task" }).click();
  await expect(page.getByText("Task created", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Error" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("The task was not created.");
  await expect(page.getByText("No follow-up tasks yet.")).toBeVisible();
});

test("an unknown state shows the normal page", async ({ page }) => {
  await page.goto("/?state=nope");
  await expect(page.getByRole("button", { name: "Prepare draft" })).toBeEnabled();
});
