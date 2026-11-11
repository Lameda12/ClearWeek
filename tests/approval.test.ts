import { describe, expect, it } from "vitest";
import { formatTime } from "../lib/scenario";
import {
  ConflictError, applyAction, draft, editProposal, emptyState, normalizeWorkspace, parseStoredAction,
  proposalSchema, provenanceLabel, reviewSchema, validateAction,
} from "../lib/workflow";

const approve = (proposal: ReturnType<typeof draft>) => ({ type: "approve" as const, proposal, reviewed: proposal });
const first = draft("demo", { framing: "coverage", details: ["swap"] });
const second = draft("demo", { framing: "guidance", details: [] });

describe("offline approval conflicts", () => {
  it("treats an exact replay as idempotent and returns the existing task", () => {
    const saved = applyAction(emptyState, approve(first));
    expect(applyAction(saved, approve(first))).toBe(saved);
  });
  it("rejects a different draft, text, or version with a conflict and leaves the task unchanged", () => {
    const saved = applyAction(emptyState, approve(first));
    const edited = editProposal(first, "Hi Dana, a different message.");
    const sameTextNewVersion = { ...first, version: crypto.randomUUID() };
    for (const other of [second, edited, sameTextNewVersion]) {
      expect(() => applyAction(saved, approve(other))).toThrowError(ConflictError);
      try { applyAction(saved, approve(other)); } catch (error) { expect((error as ConflictError).status).toBe(409); }
    }
    expect(saved.tasks).toHaveLength(1);
    expect(saved.tasks[0].proposal.message).toBe(first.message);
  });
  it("conflicts when two different approvals race through the same stored state", () => {
    let stored = emptyState;
    const results = [approve(first), approve(second)].map(action => {
      try { stored = applyAction(stored, action); return "ok"; } catch (error) { return error instanceof ConflictError ? "conflict" : "error"; }
    });
    expect(results).toEqual(["ok", "conflict"]);
    expect(stored.tasks[0].proposal.version).toBe(first.version);
  });
  it("handles resolutions the same way", () => {
    const saved = applyAction(emptyState, { type: "resolve", evidence: "Dana confirmed coverage." });
    expect(applyAction(saved, { type: "resolve", evidence: "Dana confirmed coverage." })).toBe(saved);
    expect(() => applyAction(saved, { type: "resolve", evidence: "Someone else said no." })).toThrowError(ConflictError);
  });
});

describe("draft edits and provenance", () => {
  it("keeps the original source, marks the edit, and forces a new version", () => {
    const edited = editProposal(first, "Hi Dana, can we review coverage options?");
    expect(edited).toMatchObject({ source: "demo", edited: true, base: { version: first.version, message: first.message } });
    expect(edited.version).not.toBe(first.version);
    expect(provenanceLabel(edited, false)).toBe("Edited by you · based on the open demo draft");
    expect(proposalSchema.safeParse(edited).success).toBe(true);
  });
  it("restores the original draft when the text is changed back", () => {
    const edited = editProposal(first, "Something else entirely.");
    expect(editProposal(edited, `${first.message}  `)).toEqual(first);
  });
  it("requires review of the exact edited version", () => {
    const edited = editProposal(first, "Edited text for Dana.");
    expect(() => validateAction({ type: "approve", proposal: edited, reviewed: first })).toThrow();
    expect(validateAction(approve(edited)).type).toBe("approve");
  });
  it("rejects client-supplied origin fields and inconsistent provenance", () => {
    const legacy = { version: first.version, message: first.message, origin: "gemini" };
    expect(reviewSchema.safeParse({ type: "approve", proposal: legacy, reviewed: legacy }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...first, origin: "gemini" }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...first, source: "gemini" }).success).toBe(false); // Gemini draft without proof
    expect(proposalSchema.safeParse({ ...first, edited: true }).success).toBe(false); // edited without base
    const proof = "a".repeat(64);
    expect(proposalSchema.safeParse({ ...first, proof }).success).toBe(false); // offline draft with proof
    expect(proposalSchema.safeParse({ ...first, source: "gemini", proof }).success).toBe(true);
  });
  it("loads rows saved before provenance fields and never treats them as verified", () => {
    const legacy = { version: first.version, message: first.message, origin: "gemini" };
    const stored = parseStoredAction({ type: "approve", proposal: legacy, reviewed: legacy });
    expect(stored.type === "approve" && stored.proposal).toMatchObject({ source: "gemini", edited: false, legacy: true });
    const state = normalizeWorkspace({ tasks: [{ proposal: legacy, createdAt: "2026-11-07T20:00:00Z" }], resolution: null });
    expect(state.tasks[0].verified).toBe(false);
    expect(provenanceLabel(state.tasks[0].proposal, state.tasks[0].verified)).toContain("could not be checked");
    expect(normalizeWorkspace(null)).toEqual(emptyState);
  });
});

describe("rendered time format", () => {
  it("renders deterministic 12-hour Halifax times", () => {
    expect(formatTime("2026-10-23T05:30")).toBe("5:30 AM");
    expect(formatTime("2026-10-23T14:00")).toBe("2:00 PM");
    expect(formatTime("2026-10-23T16:00")).toBe("4:00 PM");
    expect(formatTime("2026-10-23T22:00")).toBe("10:00 PM");
    expect(formatTime("2026-10-23T00:00")).toBe("12:00 AM");
    expect(formatTime("2026-10-23T12:05")).toBe("12:05 PM");
    expect(formatTime(Date.parse("2026-10-23T19:00:00Z"))).toBe("4:00 PM");
  });
});
