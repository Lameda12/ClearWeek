import { z } from "zod";
import type { Suggestion } from "./suggestion";

const message = z.string().trim().min(1).max(1600);
const origin = z.enum(["demo", "gemini"]);
export const proposalSchema = z.strictObject({ version: z.uuid(), message, origin });
export const reviewSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("approve"), proposal: proposalSchema, reviewed: proposalSchema }),
  z.strictObject({ type: z.literal("resolve"), evidence: z.string().trim().min(8).max(1000) }),
]);
export type Proposal = z.infer<typeof proposalSchema>;
export type Action = z.infer<typeof reviewSchema>;
export type Workspace = { tasks: { proposal: Proposal; createdAt: string }[]; resolution: { evidence: string; createdAt: string } | null };
export const emptyState: Workspace = { tasks: [], resolution: null };

export function draft(source: Proposal["origin"], suggestion: Suggestion): Proposal {
  const opening = "Hi Dana, my team bus on October 23 overlaps with my 4–10 PM shift.";
  const details = suggestion.details.map(detail => ({
    swap: "My swap request was declined.",
    availability: "I also need to update my availability for upcoming meets.",
  })[detail]);
  const ask = suggestion.framing === "coverage"
    ? "Could we check whether there is an approved coverage option?"
    : "Could you let me know what steps I should take to handle the overlap?";
  return { version: crypto.randomUUID(), origin: source, message: [opening, ...details, ask, "Thanks, Chloe"].join(" ") };
}

export function validateAction(raw: unknown): Action {
  const action = reviewSchema.parse(raw);
  if (action.type === "approve") {
    const { proposal, reviewed } = action;
    if (reviewed.version !== proposal.version || reviewed.message !== proposal.message || reviewed.origin !== proposal.origin) {
      throw new Error("Review the current draft before approving.");
    }
  }
  return action;
}

export function applyAction(state: Workspace, raw: unknown): Workspace {
  const action = validateAction(raw);
  const createdAt = new Date().toISOString();
  if (action.type === "resolve") {
    return state.resolution ? state : { ...state, resolution: { evidence: action.evidence, createdAt } };
  }
  if (state.tasks.length) return state;
  return { ...state, tasks: [{ proposal: action.proposal, createdAt }] };
}
