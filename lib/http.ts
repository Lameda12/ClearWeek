/** Machine-readable reason carried by every API error response. */
export type ErrorCode = "invalid_request" | "unauthorized" | "forbidden" | "conflict" | "rate_limited" | "unavailable" | "internal";
/** The only shape an API route returns on failure. It never carries a stack trace or an upstream message. */
export type ApiError = { error: string; code: ErrorCode };

const codes: Record<number, ErrorCode> = {
  400: "invalid_request", 401: "unauthorized", 403: "forbidden", 409: "conflict", 429: "rate_limited", 503: "unavailable",
};

/** An error this application raised on purpose. Only these may choose the HTTP status of a response. */
export class HttpError extends Error {
  readonly code: ErrorCode;
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.code = codes[status] ?? "internal";
  }
}

export const httpError = (status: number, message: string) => new HttpError(status, message);
