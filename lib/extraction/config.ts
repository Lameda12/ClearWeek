export type ExtractionMode = "off" | "sample" | "local";
type Env = Record<string, string | undefined>;

/**
 * off (default): the feature does not exist. sample: fixed labelled illustration, no inference, no network.
 * local: a loopback service on this machine. Local is refused on Vercel, and outside private mode it also needs an
 * explicit opt-in because the route is then unauthenticated.
 */
export function extractionMode(env: Env = process.env): ExtractionMode {
  const mode = env.CLEARWEEK_EXTRACTION;
  if (mode === "sample") return "sample";
  if (mode === "local") {
    if (env.VERCEL) return "off";
    if (env.CLEARWEEK_MODE !== "private" && env.CLEARWEEK_EXTRACTION_UNAUTHENTICATED_LOCAL !== "true") return "off";
    return "local";
  }
  return "off";
}

const clamp = (value: string | undefined, fallback: number, min: number, max: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(max, Math.max(min, Math.floor(n))) : fallback;
};
export const extractionLimits = (env: Env = process.env) => ({
  maxChars: clamp(env.CLEARWEEK_EXTRACTION_MAX_CHARS, 600, 1, 1000),
  timeoutMs: clamp(env.CLEARWEEK_EXTRACTOR_TIMEOUT_MS, 20_000, 1000, 60_000),
  url: env.CLEARWEEK_EXTRACTOR_URL?.trim() || "http://127.0.0.1:8765",
});
