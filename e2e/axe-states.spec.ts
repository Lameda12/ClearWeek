import axe from "axe-core";
import { test, expect, type Page } from "@playwright/test";

// Each ?state= value, and something that is on screen once that state has settled.
const states = {
  default: (page: Page) => page.getByRole("button", { name: "Prepare draft" }),
  draft: (page: Page) => page.getByRole("textbox", { name: "Draft message" }),
  template: (page: Page) => page.getByText("Template draft, no AI used"),
  error: (page: Page) => page.locator("p[role=alert]"),
  loading: (page: Page) => page.getByRole("status").filter({ hasText: "Loading the saved workspace…" }),
  empty: (page: Page) => page.getByRole("heading", { name: "No conflicts on Friday" }),
} as const;

for (const width of [390, 1440]) {
  for (const [state, ready] of Object.entries(states)) {
    test(`axe finds no violations on ?state=${state} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?state=${state}`);
      await expect(ready(page)).toBeVisible();
      // Let the 200 ms fade-in finish so contrast is measured on settled colours.
      await page.waitForTimeout(400);
      await page.evaluate(axe.source);
      const results = await page.evaluate(() => (window as unknown as { axe: typeof axe }).axe.run());
      expect(results.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(" ")).join(", ")}`)).toEqual([]);
    });
  }
}
