import { z } from "zod";

export const model = "gemini-3.1-flash-lite";
export const outputTokens = 256;
export const inputBytes = 8192;
export const maxAttempts = 2;
// 8,192 input tokens + 256 output at 0.25/1.50 USD per million, twice, rounded up.
export const reservationMicros = 5_000;
export const lifetimeCapMicros = 4_000_000;
export const lifetimeAttempts = 20;

const schema = z.strictObject({
  framing: z.enum(["guidance", "coverage"]),
  details: z.array(z.enum(["swap", "availability"])).max(2).refine(items => new Set(items).size === items.length),
});
export type Suggestion = z.infer<typeof schema>;
export const suggestionJsonSchema = z.toJSONSchema(schema);
export const interpret = (text: string) => schema.parse(JSON.parse(text));

export async function requestSuggestion(reserve: () => Promise<boolean>, generate: () => Promise<string>) {
  if (!await reserve()) throw Object.assign(new Error("Draft limit reached. Try again later."), { status: 429 });
  let output: string;
  try {
    output = await generate();
  } catch (error) {
    const status = Number((error as { status?: unknown })?.status);
    if (![408, 500, 502, 503, 504].includes(status)) throw error;
    output = await generate();
  }
  return interpret(output);
}
