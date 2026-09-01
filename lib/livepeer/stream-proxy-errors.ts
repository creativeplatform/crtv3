export type StreamProxyErrorCode =
  | "BOTID_DENIED"
  | "RATE_LIMITED"
  | "MISSING_API_KEY"
  | "LIVEPEER_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export class StreamProxyError extends Error {
  readonly code: StreamProxyErrorCode;
  readonly status: number;

  constructor(message: string, code: StreamProxyErrorCode, status: number) {
    super(message);
    this.name = "StreamProxyError";
    this.code = code;
    this.status = status;
  }
}

const USER_MESSAGES: Record<StreamProxyErrorCode, string> = {
  BOTID_DENIED:
    "Security check blocked this request. Refresh the page and try again, or contact support.",
  RATE_LIMITED: "Too many attempts. Wait a minute and try again.",
  MISSING_API_KEY:
    "Streaming service is temporarily unavailable. Please try again later.",
  LIVEPEER_ERROR: "Could not create stream. Please try again.",
  INVALID_RESPONSE: "Stream key not found in response.",
  UNKNOWN: "Failed to create stream. Please try again.",
};

export function userMessageForStreamProxyError(error: unknown): string {
  if (error instanceof StreamProxyError) {
    if (error.code === "LIVEPEER_ERROR" && error.message) {
      return error.message;
    }
    return USER_MESSAGES[error.code] ?? USER_MESSAGES.UNKNOWN;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return USER_MESSAGES.UNKNOWN;
}

export async function parseStreamProxyFailure(
  res: Response,
): Promise<StreamProxyError> {
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // ignore non-JSON bodies
  }

  const code = typeof body.code === "string" ? body.code : undefined;
  const errorText =
    typeof body.error === "string"
      ? body.error
      : typeof body.message === "string"
        ? body.message
        : undefined;

  if (res.status === 403 && code === "BOTID_DENIED") {
    return new StreamProxyError(
      USER_MESSAGES.BOTID_DENIED,
      "BOTID_DENIED",
      res.status,
    );
  }

  if (res.status === 429 || code === "RATE_LIMITED") {
    return new StreamProxyError(
      USER_MESSAGES.RATE_LIMITED,
      "RATE_LIMITED",
      res.status,
    );
  }

  if (res.status === 500 && code === "MISSING_API_KEY") {
    return new StreamProxyError(
      USER_MESSAGES.MISSING_API_KEY,
      "MISSING_API_KEY",
      res.status,
    );
  }

  if (code === "LIVEPEER_ERROR" && errorText) {
    return new StreamProxyError(errorText, "LIVEPEER_ERROR", res.status);
  }

  if (errorText) {
    return new StreamProxyError(errorText, "LIVEPEER_ERROR", res.status);
  }

  return new StreamProxyError(
    USER_MESSAGES.UNKNOWN,
    "UNKNOWN",
    res.status,
  );
}
