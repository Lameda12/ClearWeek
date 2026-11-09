import { beforeEach, describe, expect, it, vi } from "vitest";

const OWNER = "00000000-0000-0000-0000-0000000000a1";
const OTHER = "00000000-0000-0000-0000-0000000000b2";
let tokenUser = OWNER;
const dbTouched = vi.fn();
const geminiBuilt = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: tokenUser } }, error: null }) },
    from: () => { dbTouched(); throw new Error("database must not be touched"); },
    rpc: () => { dbTouched(); throw new Error("database must not be touched"); },
  }),
}));
vi.mock("@google/genai", () => ({
  ThinkingLevel: { MINIMAL: "MINIMAL" },
  GoogleGenAI: class { constructor() { geminiBuilt(); } },
}));

import { GET, POST as workspacePost } from "../app/api/workspace/route";
import { POST as proposalPost } from "../app/api/proposal/route";
import { authorize, failure, readWorkspace, saveAction } from "../lib/private-server";
import { assertIssued, isServerIssued, sign, verify } from "../lib/provenance";
import type { Suggestion } from "../lib/suggestion";
import { draft, editProposal, normalizeWorkspace, type Proposal, type Action } from "../lib/workflow";

beforeEach(() => {
  Object.assign(process.env, {
    CLEARWEEK_MODE: "private", SUPABASE_URL: "https://example.invalid", SUPABASE_SECRET_KEY: "test-secret-key",
    CLEARWEEK_OWNER_ID: OWNER, GEMINI_API_KEY: "test-key", GEMINI_MODEL: "gemini-3.1-flash-lite", GEMINI_MODE: "free",
  });
  tokenUser = OWNER; dbTouched.mockClear(); geminiBuilt.mockClear();
});

const authed = (body?: unknown, method = "POST") =>
  new Request("http://localhost/api", { method, headers: { authorization: "Bearer a.b.c", "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

// Mocked second signed-in account. This tests the application's owner check only; it is NOT a hosted or RLS test.
describe("application authorization with a mocked non-owner token", () => {
  it("returns 403 from both endpoints, makes no provider call and touches no database", async () => {
    tokenUser = OTHER;
    const responses = [await GET(authed(undefined, "GET")), await workspacePost(authed({ type: "resolve", evidence: "Not the owner." })), await proposalPost(authed())];
    expect(responses.map(r => r.status)).toEqual([403, 403, 403]);
    expect(geminiBuilt).not.toHaveBeenCalled();
    expect(dbTouched).not.toHaveBeenCalled();
    await expect(authorize(authed())).rejects.toMatchObject({ status: 403 });
  });
  it("returns 401 without a bearer token, and in demo mode even with one", async () => {
    expect((await GET(new Request("http://localhost/api"))).status).toBe(401);
    process.env.CLEARWEEK_MODE = "demo";
    expect((await proposalPost(authed())).status).toBe(401);
    expect(geminiBuilt).not.toHaveBeenCalled();
  });
});

describe("server-issued proof", () => {
  const issue = (p: Proposal): Proposal => ({ ...p, proof: sign(p) });
  const suggestion: Suggestion = { framing: "coverage", details: ["swap"] };
  it("verifies unedited and edited Gemini drafts and rejects tampering, forgery and demo drafts", () => {
    const issued = issue(draft("gemini", suggestion));
    expect(isServerIssued(issued)).toBe(true);
    expect(isServerIssued(editProposal(issued, "Hi Dana, my own words."))).toBe(true);
    expect(isServerIssued({ ...issued, message: "Tampered text" })).toBe(false);
    expect(isServerIssued({ ...issued, proof: "0".repeat(64) })).toBe(false);
    expect(isServerIssued(draft("demo", suggestion))).toBe(false);
    expect(() => assertIssued({ ...issued, message: "Tampered text" })).toThrow();
    expect(verify(issued, undefined)).toBe(false);
    process.env.SUPABASE_SECRET_KEY = "rotated";
    expect(isServerIssued(issued)).toBe(false);
  });
});

// Minimal in-memory stand-in for the one table, enforcing the (owner, conflict_id, kind) primary key.
function fakeDb() {
  const rows = new Map<string, Record<string, unknown>>();
  const key = (r: Record<string, unknown>) => `${r.owner}|${r.conflict_id}|${r.kind}`;
  return {
    rows,
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        await Promise.resolve();
        if (rows.has(key(row))) return { error: { code: "23505" } };
        rows.set(key(row), { ...row, created_at: "2026-11-09T12:00:00Z" });
        return { error: null };
      },
      select: () => {
        const filters: Record<string, unknown> = {};
        const match = () => [...rows.values()].filter(r => Object.entries(filters).every(([k, v]) => r[k] === v));
        const chain = {
          eq: (column: string, value: unknown) => { filters[column] = value; return chain; },
          single: async () => ({ data: match()[0] ?? null, error: null }),
          then: (resolve: (v: unknown) => unknown) => resolve({ data: match(), error: null }),
        };
        return chain;
      },
    }),
  };
}

describe("saveAction against the primary-key contract", () => {
  const suggestion: Suggestion = { framing: "coverage", details: ["swap", "availability"] };
  const issue = (p: Proposal): Proposal => ({ ...p, proof: sign(p) });
  const approval = (p: Proposal): Action => ({ type: "approve", proposal: p, reviewed: p });
  const session = () => { const db = fakeDb(); return { db, owner: OWNER, session: { db: db as never, owner: OWNER } }; };

  it("is idempotent for an exact replay and returns the existing task", async () => {
    const { db, session: s } = session();
    const a = approval(issue(draft("gemini", suggestion)));
    await saveAction(s, a);
    await saveAction(s, a);
    expect(db.rows.size).toBe(1);
    const state = await readWorkspace(s);
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].verified).toBe(true);
  });
  it("returns 409 for a different version or edited text and leaves the saved task unchanged", async () => {
    const { db, session: s } = session();
    const original = issue(draft("gemini", suggestion));
    await saveAction(s, approval(original));
    const before = JSON.stringify([...db.rows.values()]);
    const anotherDraft = issue(draft("gemini", { framing: "guidance", details: [] }));
    const edited = editProposal(original, "Hi Dana, I rewrote this.");
    for (const other of [anotherDraft, edited]) {
      await expect(saveAction(s, approval(other))).rejects.toMatchObject({ status: 409 });
    }
    expect(JSON.stringify([...db.rows.values()])).toBe(before);
  });
  it("lets exactly one of two concurrent conflicting approvals win", async () => {
    const { db, session: s } = session();
    const a = approval(issue(draft("gemini", suggestion)));
    const b = approval(issue(draft("gemini", { framing: "guidance", details: [] })));
    const results = await Promise.allSettled([saveAction(s, a), saveAction(s, b)]);
    expect(results.map(r => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find(r => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
    expect(db.rows.size).toBe(1);
    const winner = results[0].status === "fulfilled" ? a : b;
    expect((await readWorkspace(s)).tasks[0].proposal.version).toBe((winner as { proposal: Proposal }).proposal.version);
  });
  it("rejects drafts this server did not issue before writing anything", async () => {
    const { db, session: s } = session();
    await expect(saveAction(s, approval(draft("demo", suggestion)))).rejects.toMatchObject({ status: 400 });
    await expect(saveAction(s, approval({ ...issue(draft("gemini", suggestion)), message: "Forged text" }))).rejects.toMatchObject({ status: 400 });
    expect(db.rows.size).toBe(0);
  });
  it("loads a task saved before provenance fields and marks it unverified", async () => {
    const { db, session: s } = session();
    const legacy = { version: crypto.randomUUID(), message: "Hi Dana, legacy message.", origin: "gemini" };
    db.rows.set(`${OWNER}|bus:shift|approve`, { owner: OWNER, conflict_id: "bus:shift", kind: "approve", payload: { type: "approve", proposal: legacy, reviewed: legacy }, created_at: "2026-11-07T20:00:00Z" });
    const state = await readWorkspace(s);
    expect(state.tasks[0]).toMatchObject({ verified: false, proposal: { legacy: true, source: "gemini", message: legacy.message } });
    // The browser re-parses the JSON the API returns; the normalized legacy shape must survive that round trip.
    expect(normalizeWorkspace(JSON.parse(JSON.stringify(state))).tasks[0].proposal).toMatchObject({ legacy: true });
    // A different approval still conflicts with the legacy task.
    await expect(saveAction(s, approval(issue(draft("gemini", suggestion))))).rejects.toMatchObject({ status: 409 });
  });
  it("maps conflicts to a 409 response without a generic message", async () => {
    const response = failure(Object.assign(new Error("A different follow-up is already saved. Nothing was changed."), { status: 409 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "A different follow-up is already saved. Nothing was changed." });
  });
});
