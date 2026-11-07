import { createClient } from "@supabase/supabase-js";
import { emptyState, validateAction, type Workspace } from "./workflow";

export const privateMode = () => process.env.CLEARWEEK_MODE === "private";
export const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

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

export async function readWorkspace({ db, owner }: Awaited<ReturnType<typeof authorize>>): Promise<Workspace> {
  const { data, error } = await db.from("clearweek_actions").select("kind,payload,created_at").eq("owner", owner);
  if (error) throw error;
  return data.reduce<Workspace>((state, row) => {
    const action = validateAction(row.payload);
    return action.type === "approve"
      ? { ...state, tasks: [{ proposal: action.proposal, createdAt: row.created_at }] }
      : { ...state, resolution: { evidence: action.evidence, createdAt: row.created_at } };
  }, emptyState);
}

export function failure(error: unknown) {
  const status = Number((error as { status?: unknown })?.status);
  const messages: Record<number, string> = {
    400: "Check your entry and try again.",
    401: "Sign in to use the private workspace.",
    403: "This account cannot access the workspace.",
    429: "Draft limit reached. Try again later.",
    503: "The service is unavailable right now.",
  };
  return Response.json({ error: messages[status] ?? "Something went wrong. Please try again." }, { status: messages[status] ? status : 500 });
}
