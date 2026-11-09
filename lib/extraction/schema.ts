import { z } from "zod";

/**
 * Slots and response shape come from the training notebook (ClearWeek_Calendar_Extraction_Colab_fixed.ipynb),
 * which uses the six Calendar_1 slots of Google's Schema-Guided Dialogue schema at revision e852981a.
 */
export const slots = ["event_date", "event_time", "event_location", "event_name", "available_start_time", "available_end_time"] as const;
export type Slot = (typeof slots)[number];

export const slotInfo: Record<Slot, { label: string; note: string }> = {
  event_date: { label: "Event date", note: "A date phrase as written. Not resolved to a calendar date." },
  event_time: { label: "Event start time", note: "The start of an event, as written." },
  event_location: { label: "Location", note: "A place phrase as written." },
  event_name: { label: "Event name", note: "A title phrase as written." },
  available_start_time: { label: "Availability start", note: "The start of a free window." },
  available_end_time: { label: "Availability end", note: "The end of a free window. It is not the end time of an event." },
};

export const maxMentions = 24;
export const maxMentionChars = 200;
const mention = z.strictObject({ slot: z.enum(slots), text: z.string().min(1).max(maxMentionChars) });
export const extractionSchema = z.strictObject({ mentions: z.array(mention).max(maxMentions) });
export type Mention = z.infer<typeof mention>;

export type ExtractionErrorCode =
  | "disabled" | "invalid_input" | "unavailable" | "timeout" | "malformed"
  | "invalid_schema" | "ungrounded" | "ambiguous_grounding" | "busy" | "unsupported_sample" | "misconfigured";

export class ExtractionError extends Error {
  constructor(public code: ExtractionErrorCode, message: string, public status: number) {
    super(message);
    this.name = "ExtractionError";
  }
}

export const requestSchema = z.strictObject({ text: z.string() });

/** Validates and trims pasted text. The trimmed string is the single source of truth for grounding. */
export function normalizeInput(raw: string, maxChars: number): string {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(raw)) {
    throw new ExtractionError("invalid_input", "The text contains characters that cannot be processed.", 400);
  }
  const text = raw.trim();
  if (!text) throw new ExtractionError("invalid_input", "Paste some schedule text first.", 400);
  if (text.length > maxChars) throw new ExtractionError("invalid_input", `Keep the text under ${maxChars} characters.`, 400);
  return text;
}

// The notebook's evaluation also tolerated a Markdown fence around the JSON.
const unfence = (raw: string) => {
  let value = raw.trim();
  if (value.startsWith("```json")) value = value.slice(7);
  else if (value.startsWith("```")) value = value.slice(3);
  if (value.endsWith("```")) value = value.slice(0, -3);
  return value.trim();
};

export type Grounding =
  | { status: "exact"; text: string }
  | { status: "recovered"; text: string; from: string }
  | { status: "ambiguous" }
  | { status: "absent" };

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Grounds one phrase in the source, as conservatively as possible.
 * 1. Exact substring: accepted as is.
 * 2. Otherwise, a case-insensitive match is accepted only if it finds exactly ONE span (overlapping spans count),
 *    and the source's own spelling is returned. The phrase is escaped, so it is matched literally.
 * Nothing else is tried: no fuzzy matching, no punctuation stripping, no word substitution, no Unicode normalization
 * (so "e" never matches "é", and a decomposed accent never matches a composed one). The "i" flag is used without
 * "u" or case folding, so a match never changes length and offsets stay valid.
 * This repairs copying errors only. It cannot fix a wrong slot or a phrase attached to the wrong event.
 */
export function groundPhrase(source: string, phrase: string): Grounding {
  if (phrase && source.includes(phrase)) return { status: "exact", text: phrase };
  if (!phrase) return { status: "absent" };
  const pattern = new RegExp(escapeRegExp(phrase), "gi");
  const spans: { start: number; end: number }[] = [];
  for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
    spans.push({ start: match.index, end: match.index + match[0].length });
    pattern.lastIndex = match.index + 1; // overlapping matches count toward ambiguity
  }
  if (spans.length === 0) return { status: "absent" };
  if (spans.length > 1) return { status: "ambiguous" };
  return { status: "recovered", text: source.slice(spans[0].start, spans[0].end), from: phrase };
}

export type GroundedMention = Mention & { recoveredFrom?: string };

/**
 * Validates raw model output against the schema and the source text. All-or-nothing: malformed JSON, an unknown slot,
 * an extra field, a phrase that is absent from the source, or a phrase that only matches ambiguously rejects the whole
 * response. A case-only copying error is repaired when `groundPhrase` allows it, and the repair is recorded.
 * Grounding is not correctness: a real phrase under the wrong slot passes. The caller keeps the raw output.
 */
export function parseModelOutputDetailed(raw: unknown, source: string): GroundedMention[] {
  if (typeof raw !== "string") throw new ExtractionError("malformed", "The extractor returned something that is not text.", 502);
  let json: unknown;
  try { json = JSON.parse(unfence(raw)); }
  catch { throw new ExtractionError("malformed", "The extractor did not return valid JSON.", 502); }
  const parsed = extractionSchema.safeParse(json);
  if (!parsed.success) throw new ExtractionError("invalid_schema", "The extractor returned an unexpected structure or slot.", 502);
  const seen = new Set<string>();
  const result: GroundedMention[] = [];
  for (const item of parsed.data.mentions) {
    const grounded = groundPhrase(source, item.text);
    if (grounded.status === "absent") throw new ExtractionError("ungrounded", "The extractor returned text that is not in your message.", 502);
    if (grounded.status === "ambiguous") throw new ExtractionError("ambiguous_grounding", "The extractor returned text that matches your message in more than one place only by capitalization.", 502);
    const key = JSON.stringify([item.slot, grounded.text]);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(grounded.status === "recovered"
      ? { slot: item.slot, text: grounded.text, recoveredFrom: grounded.from }
      : { slot: item.slot, text: grounded.text });
  }
  return result;
}

/** Same as `parseModelOutputDetailed` without the recovery record. */
export const parseModelOutput = (raw: unknown, source: string): Mention[] =>
  parseModelOutputDetailed(raw, source).map(({ slot, text }) => ({ slot, text }));

/** What is still unknown. Mentions are a flat list; nothing here resolves dates or builds events. */
export function describeGaps(mentions: readonly Mention[]): string[] {
  const has = (slot: Slot) => mentions.some(m => m.slot === slot);
  const gaps: string[] = [];
  if (mentions.length) gaps.push("Which event each mention belongs to is not established.");
  if (has("event_date") || has("event_time") || has("available_start_time") || has("available_end_time")) {
    gaps.push("Dates and times are kept as written. A reference date and timezone are needed before they mean anything.");
  }
  gaps.push("No event end time or duration is extracted.");
  if (has("available_end_time")) gaps.push("An availability end is the end of a free window, not the end of an event.");
  const dates = mentions.filter(m => m.slot === "event_date").length;
  if (dates > 1) gaps.push("More than one date phrase appears. Which one applies is unresolved.");
  return gaps;
}
