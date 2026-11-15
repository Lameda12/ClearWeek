import { test, expect } from "@playwright/test";

test("unreadable saved demo data offers a reset and the flow works again", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("clearweek:oct23:v1", "{not json"));
  await page.reload();
  await expect(page.locator("p.error")).toHaveText("The demo data saved in this browser could not be read.");
  await expect(page.getByRole("button", { name: "Prepare draft" })).toBeDisabled();
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page.locator("p.error")).toHaveCount(0);
  await page.getByRole("button", { name: "Prepare draft" }).click();
  await expect(page.getByRole("textbox", { name: "Draft message" })).toBeVisible();
});

test("focus follows each step and the keyboard alone completes the flow", async ({ page }) => {
  await page.goto("/");
  const prepare = page.getByRole("button", { name: "Prepare draft" });
  await expect(prepare).toBeEnabled();
  await prepare.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("textbox", { name: "Draft message" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Review draft" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Approve & create task" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "View saved follow-up" })).toBeFocused();
  await expect(page.getByText("Follow-up saved in ClearWeek")).toBeVisible();
  await expect(page.getByText("Prepare a message for review")).toHaveCount(0);
});

test("dismissing returns focus to Prepare draft, and a resolved conflict leaves no dead end", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Prepare draft" }).click();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByRole("button", { name: "Prepare draft" })).toBeFocused();
  await page.getByText("Record a resolution").click();
  const save = page.getByRole("button", { name: "Save resolution" });
  await expect(save).toBeDisabled();
  await expect(page.getByText("Write at least 8 characters")).toBeVisible();
  await page.getByRole("textbox", { name: "Resolution evidence" }).fill("Example: Dana confirmed coverage.");
  await save.click();
  await expect(page.getByText("This conflict is marked as resolved, so no follow-up is needed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Prepare draft" })).toHaveCount(0);
});

test("the overlap is drawn and marked on both colliding commitments, with no sideways scroll at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await expect(page.getByRole("img", { name: /They overlap from 4:00 PM to 6:00 PM/ })).toBeVisible();
  await expect(page.getByText("Overlaps Harbour Foods shift")).toBeVisible();
  await expect(page.getByText("Overlaps Team bus to Saint John")).toBeVisible();
  await page.getByRole("link", { name: /1 conflict to review/ }).click();
  await expect(page.getByRole("heading", { name: "Schedule conflict" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("an unknown address shows a way back", async ({ page }) => {
  const response = await page.goto("/nope");
  expect(response?.status()).toBe(404);
  await page.getByRole("link", { name: "Go to Chloe’s schedule" }).click();
  await expect(page.getByText("2 hours overlap")).toBeVisible();
});
