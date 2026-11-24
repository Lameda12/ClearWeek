import { z } from "zod";
import { proposalSchema, type Proposal } from "./workflow";

export const draftKey = "clearweek:oct23:draft:v1";

const storedSchema = z.strictObject({
  proposal: proposalSchema,
  /** Whether the person has reviewed this exact text. Any edit clears it, so the draft itself is never stored twice. */
  reviewed: z.boolean(),
});

export type StoredDraft = { proposal: Proposal; reviewed: boolean };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const browserStore = (): Store | null => { try { return globalThis.sessionStorage ?? null; } catch { return null; } };

/** The draft saved for this tab, or null. Anything unreadable or no longer valid is dropped, never shown. */
export function readDraft(store: Store | null = browserStore()): StoredDraft | null {
  if (!store) return null;
  try {
    const raw = store.getItem(draftKey);
    if (raw === null) return null;
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return parsed.data as StoredDraft;
    store.removeItem(draftKey);
  } catch { /* storage or JSON unreadable: start without a draft */ }
  return null;
}

/** Saves the in-progress draft for this tab, or clears it when there is none. Failure is silent: the page still works. */
export function writeDraft(draft: StoredDraft | null, store: Store | null = browserStore()) {
  if (!store) return;
  try {
    if (draft) store.setItem(draftKey, JSON.stringify(draft)); else store.removeItem(draftKey);
  } catch { /* storage full or blocked */ }
}
