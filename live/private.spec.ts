import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("verifies one fresh Gemini response and hosted approval persistence", async ({ page, request }) => {
  const owner = process.env.CLEARWEEK_OWNER_ID!;
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  expect((await request.post("/api/proposal")).status()).toBe(401);
  expect((await request.get("/api/workspace")).status()).toBe(401);

  const actions = () => db.from("clearweek_actions").select("proposal_version,created_at")
    .eq("owner", owner).eq("conflict_id", "bus:shift");
  const usage = () => db.from("clearweek_ai_requests").select("id,suggestion,input_tokens,output_tokens")
    .eq("owner", owner);
  const beforeActions = await actions();
  expect(beforeActions.error, "Apply the hosted migration before running the smoke test").toBeNull();
  expect(beforeActions.data, "Use a fresh owner workspace without a task or resolution").toEqual([]);
  const beforeUsage = await usage();
  expect(beforeUsage.error).toBeNull();
  expect(beforeUsage.data, "Use an owner with an empty request ledger to verify a fresh call").toEqual([]);

  await page.goto("/");
  await expect(page.getByText("Private workspace", { exact: true })).toBeVisible();
  await page.getByLabel("Email").fill(process.env.CLEARWEEK_SMOKE_EMAIL!);
  await page.getByLabel("Password").evaluate((field, password) => {
    (field as HTMLInputElement).value = password;
  }, process.env.CLEARWEEK_SMOKE_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();

  const prepare = page.getByRole("button", { name: "Prepare draft" });
  await expect(prepare).toBeEnabled({ timeout: 15_000 });
  const [draftResponse] = await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === "/api/proposal"),
    prepare.click(),
  ]);
  expect(draftResponse.ok()).toBe(true);
  const issued = await draftResponse.json();
  expect(issued.source).toBe("gemini");
  expect(issued.edited).toBe(false);
  expect(issued.proof).toMatch(/^[0-9a-f]{64}$/);
  await expect(page.getByText("Gemini-assisted draft")).toBeVisible();

  const afterUsage = await usage();
  expect(afterUsage.error).toBeNull();
  expect(afterUsage.data).toHaveLength(1);
  expect(afterUsage.data![0].suggestion).toBeTruthy();
  expect(afterUsage.data![0].input_tokens).toBeGreaterThan(0);
  expect(afterUsage.data![0].output_tokens).toBeGreaterThan(0);
  expect((await actions()).data).toEqual([]);

  await page.getByRole("button", { name: "Review draft" }).click();
  const [approval] = await Promise.all([
    page.waitForRequest(req => new URL(req.url()).pathname === "/api/workspace" && req.method() === "POST"),
    page.getByRole("button", { name: "Approve & create task" }).click(),
  ]);
  await expect(page.getByText("Task created", { exact: true })).toBeVisible();
  const payload = approval.postDataJSON();
  const stored = await actions();
  expect(stored.error).toBeNull();
  expect(stored.data).toHaveLength(1);
  expect(stored.data![0].proposal_version).toBe(payload.proposal.version);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Ask Dana about shift coverage" })).toBeVisible();
  await expect(page.getByText("Conflict open", { exact: true })).toBeVisible();

  const authorization = await approval.headerValue("authorization");
  const replay = await request.post("/api/workspace", {
    headers: { Authorization: authorization ?? "" }, data: payload,
  });
  expect(replay.ok()).toBe(true);
  expect((await replay.json()).tasks).toHaveLength(1);
  const afterReplay = await actions();
  expect(afterReplay.error).toBeNull();
  expect(afterReplay.data).toEqual(stored.data);
  expect((await request.get("/api/workspace")).status()).toBe(401);

  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const denied = await anon.from("clearweek_actions").select("proposal_version").eq("owner", owner);
  if (denied.error) {
    expect(denied.error.code).toBe("42501");
  } else {
    expect(denied.data).toEqual([]);
  }
});
