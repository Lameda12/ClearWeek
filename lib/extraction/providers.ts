import { ExtractionError } from "./schema";

export type ExtractionRequest = { text: string; signal: AbortSignal };
export type ExtractionResponse = { raw: string; model?: string };
/** A provider returns the model's raw text. Validation happens in `parseModelOutput`, never inside a provider. */
export interface ExtractionProvider {
  readonly id: "mock" | "sample" | "local";
  extract(request: ExtractionRequest): Promise<ExtractionResponse>;
}

/** Scriptable provider for development and tests. It never loads a model. */
export function createMockProvider(script: (text: string) => string | Promise<string>, id: "mock" | "sample" = "mock"): ExtractionProvider {
  return { id, async extract({ text }) { return { raw: await script(text), model: id }; } };
}

export const sampleText = "Can we talk about my shift on Friday at 2 PM? I'm only free from 1 PM until 5 PM.";
const sampleOutput = JSON.stringify({ mentions: [
  { slot: "event_date", text: "Friday" }, { slot: "event_time", text: "2 PM" },
  { slot: "available_start_time", text: "1 PM" }, { slot: "available_end_time", text: "5 PM" },
] });

/** Fixed, labelled illustration for the public demo. It answers only the built-in sample and sends nothing anywhere. */
export const sampleProvider = createMockProvider(text => {
  if (text !== sampleText) {
    throw new ExtractionError("unsupported_sample", "This sample preview only works on the built-in example. Local extraction is not enabled here.", 422);
  }
  return sampleOutput;
}, "sample");

const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** The address comes from server configuration only. Non-loopback addresses are refused. */
export function loopbackUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new ExtractionError("misconfigured", "The local extractor address is not valid.", 503); }
  if (url.protocol !== "http:" || !loopback.has(url.hostname) || url.username || url.password) {
    throw new ExtractionError("misconfigured", "The local extractor must be an http loopback address.", 503);
  }
  return url;
}

const maxResponseBytes = 16_384;

export function createLocalProvider(config: { url: string; timeoutMs: number }): ExtractionProvider {
  const base = loopbackUrl(config.url);
  return {
    id: "local",
    async extract({ text, signal }) {
      const timeout = AbortSignal.timeout(config.timeoutMs);
      let response: Response;
      try {
        response = await fetch(new URL("/extract", base), {
          method: "POST", cache: "no-store", redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: AbortSignal.any([signal, timeout]),
        });
      } catch (error) {
        if (timeout.aborted || (error as { name?: string }).name === "TimeoutError") {
          throw new ExtractionError("timeout", "The local extractor took too long.", 504);
        }
        throw new ExtractionError("unavailable", "The local extractor is not running.", 503);
      }
      try {
        if (response.status === 422) throw new ExtractionError("invalid_input", "The text is too long for the extractor.", 400);
        if (!response.ok) throw new ExtractionError("unavailable", "The local extractor could not process the request.", 502);
        const body = await readCapped(response, maxResponseBytes);
        let json: { raw?: unknown; model?: unknown };
        try { json = JSON.parse(body); } catch { throw new ExtractionError("malformed", "The extractor reply was not JSON.", 502); }
        if (typeof json.raw !== "string") throw new ExtractionError("malformed", "The extractor reply had no output.", 502);
        return { raw: json.raw, model: typeof json.model === "string" ? json.model.slice(0, 120) : undefined };
      } catch (error) {
        if (error instanceof ExtractionError) throw error;
        if (timeout.aborted) throw new ExtractionError("timeout", "The local extractor took too long.", 504);
        throw new ExtractionError("unavailable", "The local extractor stopped responding.", 502);
      } finally {
        void response.body?.cancel().catch(() => undefined);
      }
    },
  };
}

async function readCapped(response: Response, limit: number) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new ExtractionError("malformed", "The extractor reply was too large.", 502); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
