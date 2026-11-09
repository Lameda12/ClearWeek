import { authorize, failure, httpError, readWorkspace, saveAction } from "@/lib/private-server";
import { validateAction } from "@/lib/workflow";

export async function GET(request: Request) {
  try {
    return Response.json(await readWorkspace(await authorize(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const session = await authorize(request);
    const reader = request.body?.getReader();
    if (!reader) throw httpError(400, "Missing action.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) {
        await reader.cancel();
        throw httpError(400, "Action is too large.");
      }
      chunks.push(value);
    }
    let action;
    try { action = validateAction(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
    catch { throw httpError(400, "Invalid approval or resolution."); }
    await saveAction(session, action);
    return Response.json(await readWorkspace(session));
  } catch (error) { return failure(error); }
}
