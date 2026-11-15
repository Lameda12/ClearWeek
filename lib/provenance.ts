import { createHmac, timingSafeEqual } from "node:crypto";
import { httpError } from "./http";
import type { Proposal, StoredProposal } from "./workflow";

type Issued = Exclude<Proposal["source"], "demo">;
type Draft = { version: string; message: string };

// Server-issued proof that an unedited draft came from this server's draft route, and which kind it was:
// "gemini" when Gemini chose the wording, "fallback" when the server used its fixed wording instead.
// The source is part of the signed text, so a fallback draft can never be relabelled as Gemini-assisted.
// The key is derived from the server-only Supabase secret, so no new secret is introduced.
// Rotating that secret makes earlier proofs unverifiable; saved tasks then show as "not verified".
const keyFor = (secret: string) => createHmac("sha256", secret).update("clearweek-proposal-proof-v1").digest();
const macFor = (draft: Draft, source: Issued) => {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw httpError(503, "Private workspace setup is incomplete.");
  return createHmac("sha256", keyFor(secret)).update(`${draft.version}\n${source}\n${draft.message}`).digest();
};

export const sign = (draft: Draft & { source?: Proposal["source"] }) =>
  macFor(draft, draft.source === "fallback" ? "fallback" : "gemini").toString("hex");

export function verify(draft: Draft, proof: string | undefined, source: Issued = "gemini") {
  if (!proof || !/^[0-9a-f]{64}$/.test(proof)) return false;
  return timingSafeEqual(macFor(draft, source), Buffer.from(proof, "hex"));
}

/** True only for a server draft (or the original of an edited one) whose proof checks out for its stated source. */
export function isServerIssued(p: StoredProposal) {
  if (p.legacy || p.source === "demo") return false;
  return p.edited ? Boolean(p.base) && verify(p.base!, p.base!.proof, p.source) : verify(p, p.proof, p.source);
}

/** Private mode accepts only drafts this server issued, edited or not. */
export function assertIssued(p: Proposal) {
  if (!isServerIssued(p)) throw httpError(400, "This draft was not issued by this workspace. Prepare a new draft.");
}
