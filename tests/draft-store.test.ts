import { describe, expect, it } from "vitest";
import { draftKey, readDraft, writeDraft } from "@/lib/draft-store";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k), data };
};
const proposal = { version: crypto.randomUUID(), source: "demo" as const, edited: false as const, message: "Hi Dana" };

describe("draft store", () => {
  it("round-trips a draft and clears it", () => {
    const store = memory();
    writeDraft({ proposal, reviewed: true }, store);
    expect(readDraft(store)).toEqual({ proposal, reviewed: true });
    writeDraft(null, store);
    expect(readDraft(store)).toBeNull();
  });
  it("drops unreadable or invalid data instead of showing it", () => {
    const store = memory();
    store.setItem(draftKey, "{not json");
    expect(readDraft(store)).toBeNull();
    store.setItem(draftKey, JSON.stringify({ proposal: { ...proposal, source: "gemini" }, reviewed: false }));
    expect(readDraft(store)).toBeNull();
    expect(store.data.has(draftKey)).toBe(false);
  });
  it("does nothing without storage", () => {
    expect(readDraft(null)).toBeNull();
    expect(() => writeDraft({ proposal, reviewed: false }, null)).not.toThrow();
  });
});
