import { createHmac, timingSafeEqual } from "node:crypto";
import { httpError } from "./http";
import type { Proposal, StoredProposal } from "./workflow";

// Server-issued proof that an unedited draft came from this server's Gemini route.
// The key is derived from the server-only Supabase secret, so no new secret is introduced.
// Rotating that secret makes earlier proofs unverifiable; saved tasks then show as "not verified".
const keyFor = (secret: string) => createHmac("sha256", secret).update("clearweek-proposal-proof-v1").digest();
const macFor = (draft: { version: string; message: string }) => {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw httpError(503, "Private workspace setup is incomplete.");
  return createHmac("sha256", keyFor(secret)).update(`${draft.version}\ngemini\n${draft.message}`).digest();
};

export const sign = (draft: { version: string; message: string }) => macFor(draft).toString("hex");

export function verify(draft: { version: string; message: string }, proof: string | undefined) {
  if (!proof || !/^[0-9a-f]{64}$/.test(proof)) return false;
  return timingSafeEqual(macFor(draft), Buffer.from(proof, "hex"));
}

/** True only for a Gemini draft (or the original of an edited one) whose server proof checks out. */
export function isServerIssued(p: StoredProposal) {
  if (p.legacy || p.source !== "gemini") return false;
  return p.edited ? Boolean(p.base) && verify(p.base!, p.base!.proof) : verify(p, p.proof);
}

/** Private mode accepts only drafts this server issued, edited or not. */
export function assertIssued(p: Proposal) {
  if (!isServerIssued(p)) throw httpError(400, "This draft was not issued by this workspace. Prepare a new draft.");
}
