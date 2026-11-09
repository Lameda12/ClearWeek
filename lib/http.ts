export const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

/** Reads a request body up to `limit` bytes, rejecting larger bodies before buffering them all. */
export async function readLimitedBody(request: Request, limit: number): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) throw httpError(400, "Missing body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw httpError(400, "Body is too large."); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
