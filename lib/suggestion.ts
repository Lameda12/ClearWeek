import { z } from "zod";

export const model = "gemini-3.1-flash-lite";
export const outputTokens = 256;
export const inputBytes = 8192;
export const maxAttempts = 2;
// 8,192 input tokens + 256 output at 0.25/1.50 USD per million, twice, rounded up.
export const reservationMicros = 5_000;
export const lifetimeCapMicros = 4_000_000;
export const lifetimeAttempts = 20;
// Two attempts of 8 s with one 500 ms pause stay well inside the route's 45 s limit.
export const attemptTimeoutMs = 8_000;
export const retryBackoffMs = 500;

export const suggestionSchema = z.strictObject({
  framing: z.enum(["guidance", "coverage"]),
  details: z.array(z.enum(["swap", "availability"])).max(2).refine(items => new Set(items).size === items.length),
});
export type Suggestion = z.infer<typeof suggestionSchema>;
export const suggestionJsonSchema = z.toJSONSchema(suggestionSchema);
export const interpret = (text: string) => suggestionSchema.parse(JSON.parse(text));

/** The fixed choice used when Gemini cannot be asked. It is the same wording the open demo shows. */
export const fallbackSuggestion: Suggestion = { framing: "coverage", details: ["swap", "availability"] };

type Timing = { timeoutMs: number; backoffMs: number };
const transient = [408, 500, 502, 503, 504];

/** Rejects with status 408 if `work` has not settled in time, so a hung provider call cannot hold the request open. */
function withTimeout<T>(work: () => Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error("The draft provider timed out."), { status: 408 })), ms);
    work().then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/**
 * Reserves budget, then asks the provider. Each attempt is time-limited. One retry follows a short pause, and only
 * for a timeout, a network failure (no status) or a 5xx. A rejected request (4xx) or unusable output is not retried.
 */
export async function requestSuggestion(reserve: () => Promise<boolean>, generate: () => Promise<string>, allowRetry = true,
  timing: Timing = { timeoutMs: attemptTimeoutMs, backoffMs: retryBackoffMs }) {
  if (!await reserve()) throw Object.assign(new Error("Draft limit reached. Try again later."), { status: 429 });
  let output: string;
  try {
    output = await withTimeout(generate, timing.timeoutMs);
  } catch (error) {
    const status = (error as { status?: unknown } | null)?.status;
    const retryable = status === undefined || transient.includes(Number(status));
    if (!allowRetry || !retryable) throw error;
    await new Promise(resolve => setTimeout(resolve, timing.backoffMs));
    output = await withTimeout(generate, timing.timeoutMs);
  }
  return interpret(output);
}

export type FallbackReason = "not_configured" | "ledger_unavailable" | "rate_limited" | "provider_failed";
/** `answered` is true when the provider replied with an HTTP error, which is not billed; false for a timeout, a network failure or unusable output, which may have been. */
export type Outcome = { source: "gemini"; suggestion: Suggestion } | { source: "fallback"; suggestion: Suggestion; reason: "provider_failed"; answered: boolean };

/**
 * Never throws: when the provider fails, times out or answers with something unusable,
 * the caller gets the fixed fallback, so a draft can always be prepared.
 */
export async function suggestOrFallback(...args: Parameters<typeof requestSuggestion>): Promise<Outcome> {
  try {
    return { source: "gemini", suggestion: await requestSuggestion(...args) };
  } catch (error) {
    const status = Number((error as { status?: unknown } | null)?.status);
    return { source: "fallback", suggestion: fallbackSuggestion, reason: "provider_failed", answered: status >= 400 && status !== 408 };
  }
}
