import { test, expect } from "@playwright/test";

test("a draft in progress survives a reload, edits and review included", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Prepare draft" }).click();
  await page.getByRole("textbox", { name: "Draft message" }).fill("Hi Dana, keep this text.");
  await page.getByRole("button", { name: "Review draft" }).click();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Draft message" })).toHaveValue("Hi Dana, keep this text.");
  await expect(page.getByRole("button", { name: "Review draft" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve & create task" })).toBeEnabled();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Prepare draft" })).toBeVisible();
});

test("Skip to schedule is hidden until focused, then sits in the page flow above the header", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to schedule" });
  await expect(skip).toBeFocused();
  const box = await skip.boundingBox();
  expect(box).toMatchObject({ x: 0, y: 0, height: 44 });
  expect(await skip.evaluate(el => getComputedStyle(el).position)).not.toBe("fixed");
  expect(await page.getByRole("banner").evaluate(el => el.getBoundingClientRect().top)).toBe(44);
  await page.keyboard.press("Enter");
  await expect(page.locator("#schedule")).toBeFocused();
});

test("controls are at least 44px, text at least 14px, and focus is visible", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Prepare draft" }).click();
  for (const control of await page.locator("button:visible, a:visible:not(.sr-only), summary:visible").all()) {
    const box = await control.boundingBox();
    expect(box!.height, await control.innerText()).toBeGreaterThanOrEqual(44);
  }
  const small = await page.evaluate(() => [...document.querySelectorAll("main *, header *")]
    .filter(el => el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()) && (el as HTMLElement).offsetParent !== null)
    .filter(el => parseFloat(getComputedStyle(el).fontSize) < 14).map(el => el.textContent?.trim()));
  expect(small).toEqual([]);
  await page.getByRole("button", { name: "Review draft" }).focus();
  await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
  const ring = await page.getByRole("button", { name: "Review draft" }).evaluate(el => { const s = getComputedStyle(el); return [s.outlineWidth, s.outlineStyle, s.outlineOffset, s.outlineColor]; });
  expect(ring).toEqual(["2px", "solid", "2px", "rgb(15, 100, 119)"]);
});

test("the chart has a text alternative that states the overlap", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("figcaption")).toContainText("overlap from 4 to 6 PM");
});
