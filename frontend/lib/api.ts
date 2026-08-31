import type { QueryResponse, SchemaResponse } from "./types";

/**
 * Point at the FastAPI backend when NEXT_PUBLIC_API_URL is set; otherwise fall
 * back to the in-repo mock routes so the UI runs with no backend at all.
 */
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/mock";

/** Thrown for transport/HTTP failures. Validator refusals are NOT errors — they
 *  come back as a normal 200 with `refused: true`. */
export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 429) {
      throw new ApiError("Rate limit reached. Give it a minute and try again.", 429);
    }
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

export async function postQuery(
  question: string,
  signal?: AbortSignal,
): Promise<QueryResponse> {
  const res = await fetch(`${BASE}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
    signal,
  });
  return parseOrThrow<QueryResponse>(res);
}

export async function getSchema(signal?: AbortSignal): Promise<SchemaResponse> {
  const res = await fetch(`${BASE}/schema`, { signal });
  return parseOrThrow<SchemaResponse>(res);
}
