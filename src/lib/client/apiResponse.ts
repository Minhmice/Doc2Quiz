type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
};

export async function parseApiError(
  response: Response,
  fallback: string,
): Promise<Error> {
  const body = await response.text();
  let message: string | undefined;

  if (body) {
    try {
      const payload = JSON.parse(body) as ApiErrorPayload;
      message =
        typeof payload.message === "string"
          ? payload.message
          : typeof payload.error === "string"
            ? payload.error
            : undefined;
    } catch {
      message = body.replace(/\s+/g, " ").slice(0, 300);
    }
  }

  const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
  return new Error(message ? `${status}: ${message}` : `${status}: ${fallback}`);
}
