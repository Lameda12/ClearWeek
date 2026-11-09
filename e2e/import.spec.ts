import { test, expect } from "@playwright/test";

const sample = "http://127.0.0.1:3191";

test("the default demo has no import feature and its endpoint is closed", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Import schedule text" })).toHaveCount(0);
  expect((await request.post("/api/extract", { data: { text: "Friday" } })).status()).toBe(404);
});

test("sample preview: extract, correct, confirm, and nothing is saved", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(sample);
  await expect(page.getByRole("heading", { name: "Import schedule text" })).toBeVisible();
  await expect(page.getByText(/Sample preview\. This shows fixed example output/)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Schedule text" })).toHaveJSProperty("readOnly", true);

  await page.getByRole("button", { name: "Extract mentions" }).click();
  await expect(page.getByText("Suggestions, not facts.")).toBeVisible();
  const phrases = page.locator(".mentions input");
  await expect(phrases).toHaveCount(4);
  await expect(page.getByText("The end of a free window. It is not the end time of an event.")).toBeVisible();
  await expect(page.getByText("A reference date and timezone are needed", { exact: false })).toBeVisible();
  await expect(page.getByText("Which event each mention belongs to is not established.")).toBeVisible();

  // An invented phrase blocks confirmation; restoring it re-enables it.
  const confirm = page.getByRole("button", { name: "Confirm reviewed mentions" });
  await expect(confirm).toBeEnabled();
  await phrases.first().fill("Saturday");
  await expect(page.getByText("This phrase is not in your message.")).toBeVisible();
  await expect(confirm).toBeDisabled();
  await phrases.first().fill("Friday");
  await page.getByRole("button", { name: "Remove" }).last().click();
  await expect(phrases).toHaveCount(3);
  await confirm.click();
  await expect(page.getByText("Reviewed mentions (preview only)")).toBeVisible();
  await expect(page.getByText("No event, task or schedule was created.", { exact: false })).toBeVisible();

  // Nothing leaked into the workspace: no task, and the conflict stays open.
  await expect(page.getByText("No follow-up tasks yet.")).toBeVisible();
  await expect(page.getByText("Conflict open", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator(".mentions")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("sample endpoint refuses other text and extra fields", async ({ request }) => {
  expect((await request.post(`${sample}/api/extract`, { data: { text: "My own private message" } })).status()).toBe(422);
  expect((await request.post(`${sample}/api/extract`, { data: { text: "x", url: "http://example.com" } })).status()).toBe(400);
});
