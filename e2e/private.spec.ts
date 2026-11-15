import { test, expect, type Page } from "@playwright/test";
import { e2e } from "../playwright.config";

// Signed-in mode, end to end, against the local stub backend. One worker at a time: the stub holds shared state.
test.describe.configure({ mode: "serial" });
const email = "chloe.e2e@clearweek.test";
const fixedDraft = "Hi Dana, my team bus on October 23 overlaps with my 4–10 PM shift. My swap request was declined. I also need to update my availability for upcoming meets. Could we check whether there is an approved coverage option? Thanks, Chloe";

const control = (request: Page["request"], set: Record<string, string>, reset = true) => request.post(`${e2e.stub}/__control`, { data: { reset, set } });
const stubState = async (request: Page["request"]) => (await request.get(`${e2e.stub}/__state`)).json();

async function signIn(page: Page) {
  await page.goto(e2e.privateUrl);
  await expect(page.getByText("Signed-in workspace", { exact: true })).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_STUB_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Prepare draft" })).toBeEnabled();
}

async function prepare(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(r => new URL(r.url()).pathname === "/api/proposal"),
    page.getByRole("button", { name: "Prepare draft" }).click(),
  ]);
  return response;
}

async function approveAndReload(page: Page, label: string) {
  await page.getByRole("button", { name: "Review draft" }).click();
  await page.getByRole("button", { name: "Approve & create task" }).click();
  await expect(page.getByText("Task created", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Ask Dana about shift coverage" })).toBeVisible();
  await expect(page.locator(".saved-task")).toContainText(label);
  await expect(page.getByText("Conflict open", { exact: true })).toBeVisible();
}

test("Gemini down: the full flow still works with a labelled, signed fallback draft", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await control(page.request, { gemini: "down" });
  await signIn(page);

  const response = await prepare(page);
  expect(response.status()).toBe(200);
  expect(response.headers()["x-clearweek-draft-source"]).toBe("fallback; reason=provider_failed");
  const issued = await response.json();
  expect(issued).toMatchObject({ source: "fallback", edited: false, message: fixedDraft });
  expect(issued.proof).toMatch(/^[0-9a-f]{64}$/);
  await expect(page.getByRole("textbox", { name: "Draft message" })).toHaveValue(fixedDraft);
  await expect(page.getByText("Prepared draft · Gemini was unavailable, so this is not written by AI")).toBeVisible();
  await expect(page.locator("p.error")).toHaveCount(0);
  // One try, one retry, no usage recorded for a call that never succeeded, and the reservation given back.
  expect(await stubState(page.request)).toMatchObject({ geminiCalls: 2, reservations: 1, ledgerUpdates: 0, releases: 1 });

  await approveAndReload(page, "Prepared draft · Gemini was unavailable");
  const saved = await stubState(page.request);
  expect(saved.actions).toHaveLength(1);
  expect(saved.actions[0]).toMatchObject({ owner: e2e.owner, kind: "approve", payload: { proposal: { source: "fallback" } } });
  expect(errors).toEqual([]);
});

test("Gemini rate-limited, by the ledger or by Google: a fallback draft with no error shown", async ({ page }) => {
  await control(page.request, { reserve: "denied" });
  await signIn(page);
  expect((await prepare(page)).headers()["x-clearweek-draft-source"]).toBe("fallback; reason=rate_limited");
  await expect(page.getByRole("textbox", { name: "Draft message" })).toHaveValue(fixedDraft);
  expect((await stubState(page.request)).geminiCalls).toBe(0);

  await page.getByRole("button", { name: "Dismiss" }).click();
  await control(page.request, { reserve: "allowed", gemini: "limited" }, false);
  expect((await prepare(page)).headers()["x-clearweek-draft-source"]).toBe("fallback; reason=provider_failed");
  await expect(page.getByRole("textbox", { name: "Draft message" })).toHaveValue(fixedDraft);
  expect((await stubState(page.request)).geminiCalls).toBe(1);
});

test("Gemini up: an edited Gemini draft is approved, saved and still there after reload", async ({ page }) => {
  await control(page.request, { gemini: "up" });
  await signIn(page);
  const response = await prepare(page);
  expect(response.headers()["x-clearweek-draft-source"]).toBe("gemini");
  await expect(page.getByText("Gemini-assisted draft · checked by the server")).toBeVisible();
  expect(await stubState(page.request)).toMatchObject({ geminiCalls: 1, ledgerUpdates: 1 });

  await page.getByRole("textbox", { name: "Draft message" }).fill("Hi Dana, could we talk about Friday?");
  await expect(page.getByText("Edited by you · based on an AI suggestion checked by the server")).toBeVisible();
  await approveAndReload(page, "Edited by you · based on an AI suggestion checked by the server");
});

test("wrong password, a forged draft and a stranger's token are all refused", async ({ page }) => {
  await control(page.request, {});
  await page.goto(e2e.privateUrl);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("p.error")).toHaveText("Sign-in failed. Check your email and password.");

  const headers = { Authorization: "Bearer e2e.stub.token" };
  const forged = { version: crypto.randomUUID(), message: "Hi Dana, forged.", source: "fallback", edited: false, proof: "0".repeat(64) };
  const refused = await page.request.post(`${e2e.privateUrl}/api/workspace`, { headers, data: { type: "approve", proposal: forged, reviewed: forged } });
  expect(refused.status()).toBe(400);
  expect(await refused.json()).toEqual({ error: "Check your entry and try again.", code: "invalid_request" });
  const stranger = await page.request.get(`${e2e.privateUrl}/api/workspace`, { headers: { Authorization: "Bearer someone.else.token" } });
  expect(stranger.status()).toBe(403);
  expect((await stranger.json()).code).toBe("forbidden");
  expect((await stubState(page.request)).actions).toEqual([]);
});

test("no server secret reaches the browser in signed-in mode", async ({ page }) => {
  const bodies: Promise<string>[] = [];
  page.on("response", response => { if (response.url().startsWith(e2e.privateUrl)) bodies.push(response.text().catch(() => "")); });
  await control(page.request, { gemini: "down" });
  await signIn(page);
  await prepare(page);
  await page.goto(`${e2e.privateUrl}/adjacent`);
  const scripts = await page.evaluate(() => [...document.querySelectorAll("script[src]")].map(node => (node as HTMLScriptElement).src));
  for (const src of scripts) bodies.push((await page.request.get(src)).text());
  const everything = (await Promise.all(bodies)).join("\n");
  expect(everything.length).toBeGreaterThan(50_000);
  for (const secret of [e2e.secretKey, e2e.geminiKey]) expect(everything).not.toContain(secret);
  // The publishable key is meant for the browser; its presence proves the scan really read the page.
  expect(everything).toContain(e2e.publishableKey);
});
