// Local stand-in for Supabase (auth + REST) and the Gemini API, used only by e2e/private.spec.ts.
// It lets the signed-in flow run end to end with no network, no real keys and no real data.
// Every value here is a test value that exists only on this machine.
import { createServer } from "node:http";

export const OWNER = "00000000-0000-4000-8000-0000000000e2";
export const EMAIL = "chloe.e2e@clearweek.test";
const PASSWORD = process.env.E2E_STUB_PASSWORD ?? "";
const TOKEN = "e2e.stub.token";
const port = Number(process.env.E2E_STUB_PORT ?? 3190);

let state;
const reset = () => { state = { actions: new Map(), gemini: "up", reserve: "allowed", geminiCalls: 0, reservations: 0, ledgerUpdates: 0, releases: 0 }; };
reset();

const user = { id: OWNER, aud: "authenticated", role: "authenticated", email: EMAIL, app_metadata: {}, user_metadata: {}, created_at: "2026-11-01T00:00:00Z" };
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS" };
const send = (res, status, body) => {
  res.writeHead(status, { ...cors, "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const read = req => new Promise(resolve => { let text = ""; req.on("data", chunk => { text += chunk; }); req.on("end", () => { try { resolve(JSON.parse(text || "null")); } catch { resolve(null); } }); });
const eq = (url, column) => url.searchParams.get(column)?.replace(/^eq\./, "");

createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const path = url.pathname;
  if (req.method === "OPTIONS") return send(res, 204);
  if (path === "/") return send(res, 200, { ok: true });

  // Test controls.
  if (path === "/__control") { const body = await read(req); if (body?.reset) reset(); Object.assign(state, body?.set ?? {}); return send(res, 200, { ok: true }); }
  if (path === "/__state") return send(res, 200, { ...state, actions: [...state.actions.values()] });

  // Supabase auth.
  if (path === "/auth/v1/token") {
    const body = await read(req);
    if (body?.email !== EMAIL || !PASSWORD || body?.password !== PASSWORD) return send(res, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
    return send(res, 200, { access_token: TOKEN, token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: "e2e-refresh", user });
  }
  if (path === "/auth/v1/user") return req.headers.authorization === `Bearer ${TOKEN}` ? send(res, 200, user) : send(res, 401, { code: 401, msg: "invalid token" });
  if (path === "/auth/v1/logout") return send(res, 204);

  // Supabase REST: the one actions table, with its (owner, conflict_id, kind) primary key.
  if (path === "/rest/v1/clearweek_actions") {
    if (req.method === "POST") {
      const row = await read(req);
      const key = `${row.owner}|${row.conflict_id}|${row.kind}`;
      if (state.actions.has(key)) return send(res, 409, { code: "23505", message: "duplicate key value violates unique constraint" });
      state.actions.set(key, { ...row, created_at: new Date().toISOString() });
      return send(res, 201);
    }
    const rows = [...state.actions.values()].filter(row => ["owner", "conflict_id", "kind"].every(column => !eq(url, column) || row[column] === eq(url, column)));
    if (req.headers.accept?.includes("vnd.pgrst.object")) return rows.length === 1 ? send(res, 200, rows[0]) : send(res, 406, { code: "PGRST116", message: "not a single row" });
    return send(res, 200, rows);
  }
  if (path === "/rest/v1/rpc/clearweek_reserve") { state.reservations++; return send(res, 200, { allowed: state.reserve === "allowed" }); }
  if (path === "/rest/v1/rpc/clearweek_release") { state.releases++; return send(res, 200, true); }
  if (path === "/rest/v1/clearweek_ai_requests") { state.ledgerUpdates++; return send(res, 204); }

  // Gemini.
  if (path.includes(":generateContent")) {
    state.geminiCalls++;
    if (state.gemini === "down") return send(res, 503, { error: { code: 503, message: "The model is overloaded.", status: "UNAVAILABLE" } });
    if (state.gemini === "limited") return send(res, 429, { error: { code: 429, message: "Quota exceeded.", status: "RESOURCE_EXHAUSTED" } });
    return send(res, 200, {
      candidates: [{ content: { role: "model", parts: [{ text: '{"framing":"guidance","details":["swap"]}' }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 12, totalTokenCount: 132 },
    });
  }
  send(res, 404, { message: `stub has no route for ${req.method} ${path}` });
}).listen(port, "127.0.0.1");
