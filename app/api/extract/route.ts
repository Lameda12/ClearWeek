import { authorize, failure, privateMode } from "@/lib/private-server";
import { readLimitedBody } from "@/lib/http";
import { extractionLimits, extractionMode } from "@/lib/extraction/config";
import { createLocalProvider, sampleProvider } from "@/lib/extraction/providers";
import { describeGaps, ExtractionError, normalizeInput, parseModelOutputDetailed, requestSchema } from "@/lib/extraction/schema";

export const maxDuration = 30;

// One extraction at a time per server process: the local model is a single small machine.
let inFlight = false;

/**
 * Extracts candidate mentions from pasted text. Read-only: it never writes a task, event or database row,
 * never calls Gemini or any hosted provider, and takes no address from the request.
 */
export async function POST(request: Request) {
  try {
    const mode = extractionMode();
    if (mode === "off") throw new ExtractionError("disabled", "Schedule text import is not enabled.", 404);
    if (privateMode()) await authorize(request);

    const limits = extractionLimits();
    let body: unknown;
    try { body = JSON.parse(await readLimitedBody(request, 4096)); }
    catch { throw new ExtractionError("invalid_input", "Send a JSON body with a text field.", 400); }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) throw new ExtractionError("invalid_input", "Send a JSON body with only a text field.", 400);
    const text = normalizeInput(parsed.data.text, limits.maxChars);

    const provider = mode === "sample" ? sampleProvider : createLocalProvider({ url: limits.url, timeoutMs: limits.timeoutMs });
    if (inFlight) throw new ExtractionError("busy", "Another extraction is running. Try again in a moment.", 429);
    inFlight = true;
    let output;
    try { output = await provider.extract({ text, signal: request.signal }); }
    finally { inFlight = false; }

    const mentions = parseModelOutputDetailed(output.raw, text);
    return Response.json({ source: provider.id, model: output.model ?? null, text, mentions, rawOutput: output.raw, gaps: describeGaps(mentions) },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ExtractionError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    return failure(error);
  }
}
