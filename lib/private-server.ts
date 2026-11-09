import { createClient } from "@supabase/supabase-js";
import { httpError } from "./http";
import { assertIssued, isServerIssued } from "./provenance";
import { emptyState, parseStoredAction, sameAction, type Action, type Workspace } from "./workflow";

export const privateMode = () => process.env.CLEARWEEK_MODE === "private";
export { httpError };
const conflictId = "bus:shift";

export async function authorize(request: Request) {
  const token = /^Bearer ([\w.-]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!privateMode() || !token) throw httpError(401, "Sign in to use the private workspace.");
  const { SUPABASE_URL, SUPABASE_SECRET_KEY, CLEARWEEK_OWNER_ID } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !CLEARWEEK_OWNER_ID) throw httpError(503, "Private workspace setup is incomplete.");
  const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.auth.getUser(token);
  if (error || data.user?.id !== CLEARWEEK_OWNER_ID) throw httpError(403, "This account cannot access the workspace.");
  return { db, owner: data.user.id };
}

type Session = Awaited<ReturnType<typeof authorize>>;

export async function readWorkspace({ db, owner }: Session): Promise<Workspace> {
  const { data, error } = await db.from("clearweek_actions").select("kind,payload,created_at").eq("owner", owner);
  if (error) throw error;
  return data.reduce<Workspace>((state, row) => {
    const action = parseStoredAction(row.payload);
    return action.type === "approve"
      ? { ...state, tasks: [{ proposal: action.proposal, createdAt: row.created_at, verified: isServerIssued(action.proposal) }] }
      : { ...state, resolution: { evidence: action.evidence, createdAt: row.created_at } };
  }, emptyState);
}

/**
 * Saves an action. The primary key (owner, conflict_id, kind) makes the insert atomic:
 * the first writer wins; an exact replay is idempotent; any different action conflicts (HTTP 409).
 */
export async function saveAction({ db, owner }: Session, action: Action) {
  if (action.type === "approve") assertIssued(action.proposal);
  const { error } = await db.from("clearweek_actions").insert({
    owner, conflict_id: conflictId, kind: action.type,
    proposal_version: action.type === "approve" ? action.proposal.version : null,
    payload: action,
  });
  if (!error) return;
  if (error.code !== "23505") throw error;
  const { data, error: readError } = await db.from("clearweek_actions").select("payload")
    .eq("owner", owner).eq("conflict_id", conflictId).eq("kind", action.type).single();
  if (readError) throw readError;
  if (!sameAction(parseStoredAction(data.payload), action)) {
    throw httpError(409, action.type === "approve"
      ? "A different follow-up is already saved. Nothing was changed."
      : "A different resolution is already recorded. Nothing was changed.");
  }
}

export function failure(error: unknown) {
  const status = Number((error as { status?: unknown })?.status);
  const messages: Record<number, string> = {
    400: "Check your entry and try again.",
    401: "Sign in to use the private workspace.",
    403: "This account cannot access the workspace.",
    409: (error as { message?: string }).message ?? "A different entry is already saved. Nothing was changed.",
    429: "Draft limit reached. Try again later.",
    503: "The service is unavailable right now.",
  };
  return Response.json({ error: messages[status] ?? "Something went wrong. Please try again." }, { status: messages[status] ? status : 500 });
}
