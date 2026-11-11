import { z } from "zod";
import type { Suggestion } from "./suggestion";

/** Raised when a different follow-up or resolution is already saved. Mirrors the private API's HTTP 409. */
export class ConflictError extends Error {
  status = 409;
  constructor(message = "A different follow-up is already saved. Nothing was changed.") {
    super(message);
    this.name = "ConflictError";
  }
}

const message = z.string().trim().min(1).max(1600);
const source = z.enum(["demo", "gemini"]);
const proof = z.string().regex(/^[0-9a-f]{64}$/);
const base = z.strictObject({ version: z.uuid(), message, proof: proof.optional() });

/**
 * A draft as held by the browser and posted for approval.
 * `source` is where the text originally came from; `edited` is whether the user changed it since.
 * `proof` is a server-issued HMAC over an unedited Gemini draft; `base` carries the original draft of an edited one.
 * Neither field is trusted on its own: the private server re-verifies the proof before saving.
 */
export const proposalSchema = z.strictObject({
  version: z.uuid(), message, source, edited: z.boolean(), proof: proof.optional(), base: base.optional(),
}).superRefine((p, ctx) => {
  const issue = (text: string) => ctx.addIssue({ code: "custom", message: text });
  if (!p.edited) {
    if (p.base) issue("An unedited draft has no base.");
    if (p.source === "gemini" && !p.proof) issue("A Gemini draft needs its server proof.");
    if (p.source === "demo" && p.proof) issue("An offline draft has no proof.");
  } else {
    if (!p.base) return issue("An edited draft needs its original draft.");
    if (p.proof) issue("An edited draft carries proof on its base only.");
    if (p.base.version === p.version || p.base.message === p.message) issue("An edited draft must differ from its base.");
    if (p.source === "gemini" && !p.base.proof) issue("The original Gemini draft needs its server proof.");
    if (p.source === "demo" && p.base.proof) issue("An offline draft has no proof.");
  }
});
export type Proposal = z.infer<typeof proposalSchema>;
/** A saved proposal. `legacy` marks rows saved before provenance checks existed; their origin is unverified. */
export type StoredProposal = Proposal & { legacy?: true };

const legacyProposalSchema = z.strictObject({ version: z.uuid(), message, origin: source })
  .transform((p): StoredProposal => ({ version: p.version, message: p.message, source: p.origin, edited: false, legacy: true }));
// A legacy proposal after normalization, as the private API returns it to the browser.
const normalizedLegacySchema = z.strictObject({ version: z.uuid(), message, source, edited: z.literal(false), legacy: z.literal(true) });
const storedProposalSchema = z.union([proposalSchema, legacyProposalSchema, normalizedLegacySchema]);

const resolveSchema = z.strictObject({ type: z.literal("resolve"), evidence: z.string().trim().min(8).max(1000) });
export const reviewSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("approve"), proposal: proposalSchema, reviewed: proposalSchema }),
  resolveSchema,
]);
export type Action = z.infer<typeof reviewSchema>;
type StoredAction = { type: "approve"; proposal: StoredProposal; reviewed: StoredProposal } | z.infer<typeof resolveSchema>;
const storedActionSchema = z.union([
  z.strictObject({ type: z.literal("approve"), proposal: storedProposalSchema, reviewed: storedProposalSchema }),
  resolveSchema,
]);

const workspaceSchema = z.strictObject({
  tasks: z.array(z.strictObject({ proposal: storedProposalSchema, createdAt: z.string(), verified: z.boolean().default(false) })).max(1),
  resolution: z.strictObject({ evidence: z.string(), createdAt: z.string() }).nullable(),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export const emptyState: Workspace = { tasks: [], resolution: null };

/** Parses a saved or returned workspace, accepting rows saved before provenance fields existed. */
export const normalizeWorkspace = (raw: unknown): Workspace => workspaceSchema.parse(raw ?? emptyState);

export function draft(source: Proposal["source"], suggestion: Suggestion): Proposal {
  const opening = "Hi Dana, my team bus on October 23 overlaps with my 4–10 PM shift.";
  const details = suggestion.details.map(detail => ({
    swap: "My swap request was declined.",
    availability: "I also need to update my availability for upcoming meets.",
  })[detail]);
  const ask = suggestion.framing === "coverage"
    ? "Could we check whether there is an approved coverage option?"
    : "Could you let me know what steps I should take to handle the overlap?";
  return { version: crypto.randomUUID(), source, edited: false, message: [opening, ...details, ask, "Thanks, Chloe"].join(" ") };
}

/**
 * Applies a user's text change. Any change gets a new version, so the user must review again.
 * Restoring the original text restores the original draft, including its server proof.
 */
export function editProposal(current: Proposal, text: string): Proposal {
  const original = current.base ?? { version: current.version, message: current.message, proof: current.proof };
  if (text.trim() === original.message) {
    return { version: original.version, message: original.message, source: current.source, edited: false, ...(original.proof ? { proof: original.proof } : {}) };
  }
  return { version: crypto.randomUUID(), message: text, source: current.source, edited: true, base: original };
}

export function provenanceLabel(p: StoredProposal, verified: boolean) {
  const origin = p.source === "gemini" ? "Gemini-assisted" : "open demo";
  if (p.legacy) return `Saved before draft checks existed · recorded as ${origin}${p.source === "gemini" ? ", could not be checked" : ""}`;
  if (p.edited) {
    if (p.source === "demo") return "Edited by you · based on the open demo draft";
    return verified ? "Edited by you · based on an AI suggestion checked by the server" : "Edited by you · AI suggestion could not be checked";
  }
  if (p.source === "demo") return "Open demo draft";
  return verified ? "Gemini-assisted draft · checked by the server" : "Recorded as Gemini-assisted draft · could not be checked";
}

const same = (a: Proposal, b: Proposal) =>
  a.version === b.version && a.message === b.message && a.source === b.source && a.edited === b.edited &&
  (a.proof ?? "") === (b.proof ?? "") && a.base?.version === b.base?.version &&
  a.base?.message === b.base?.message && (a.base?.proof ?? "") === (b.base?.proof ?? "");

export function validateAction(raw: unknown): Action {
  const action = reviewSchema.parse(raw);
  if (action.type === "approve" && !same(action.proposal, action.reviewed)) {
    throw new Error("Review the current draft before approving.");
  }
  return action;
}

/** Parses a saved payload, including approvals saved before provenance fields existed. */
export function parseStoredAction(raw: unknown): StoredAction {
  const action = storedActionSchema.parse(raw);
  if (action.type === "approve" && !same(action.proposal, action.reviewed)) throw new Error("Stored approval does not match its reviewed draft.");
  return action;
}

/** An approval replays when version and text match; a resolution when its evidence matches. */
export function sameAction(existing: StoredAction, incoming: Action) {
  if (existing.type !== incoming.type) return false;
  if (existing.type === "approve" && incoming.type === "approve") {
    return existing.proposal.version === incoming.proposal.version && existing.proposal.message === incoming.proposal.message;
  }
  return existing.type === "resolve" && incoming.type === "resolve" && existing.evidence === incoming.evidence;
}

/** Offline-mode equivalent of the private API: exact replay is idempotent, anything else conflicts. */
export function applyAction(state: Workspace, raw: unknown): Workspace {
  const action = validateAction(raw);
  const createdAt = new Date().toISOString();
  if (action.type === "resolve") {
    if (state.resolution) {
      if (state.resolution.evidence === action.evidence) return state;
      throw new ConflictError("A different resolution is already recorded. Nothing was changed.");
    }
    return { ...state, resolution: { evidence: action.evidence, createdAt } };
  }
  const [existing] = state.tasks;
  if (existing) {
    if (existing.proposal.version === action.proposal.version && existing.proposal.message === action.proposal.message) return state;
    throw new ConflictError();
  }
  return { ...state, tasks: [{ proposal: action.proposal, createdAt, verified: false }] };
}
