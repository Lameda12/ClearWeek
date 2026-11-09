import { test, expect, type Page } from "@playwright/test";

async function reviewDraft(page: Page, text: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Prepare draft" }).click();
  await page.getByRole("textbox", { name: "Draft message" }).fill(text);
  await expect(page.getByText("Edited by you · based on the offline demo draft")).toBeVisible();
  await page.getByRole("button", { name: "Review draft" }).click();
}

test("a second tab's different approval conflicts and leaves the saved task unchanged", async ({ context }) => {
  const a = await context.newPage();
  const b = await context.newPage();
  await reviewDraft(a, "Hi Dana, first tab text.");
  await reviewDraft(b, "Hi Dana, second tab text.");
  await b.getByRole("button", { name: "Approve & create task" }).click();
  await expect(b.getByText("Task created", { exact: true })).toBeVisible();

  await a.getByRole("button", { name: "Approve & create task" }).click();
  await expect(a.locator("p.error")).toHaveText("A different follow-up is already saved. Nothing was changed.");
  await expect(a.getByText("Task created", { exact: true })).toHaveCount(0);
  await expect(a.getByRole("heading", { name: "Follow-up tasks" })).toBeVisible();
  await expect(a.locator(".saved-task")).toContainText("Hi Dana, second tab text.");
  await expect(a.locator(".saved-task")).toContainText("Edited by you · based on the offline demo draft");
  await a.reload();
  await expect(a.locator(".saved-task")).toContainText("Hi Dana, second tab text.");
});
