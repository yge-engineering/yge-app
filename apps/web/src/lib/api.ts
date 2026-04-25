// Tiny client for the Express API. One place to set the base URL, one place
// to centralize error handling. As the app grows we'll swap this for tRPC or
// React Query, but a hand-rolled fetcher is plenty for Phase 1.

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function jsonRequest<TResponse>(
  method: 'POST' | 'PATCH' | 'PUT' | 'GET',
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<TResponse> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const init: RequestInit = {
    method,
    headers:
      body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  };
  const res = await fetch(url, init);

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const errMessage =
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : null) ?? `Request failed: ${res.status} ${res.statusText}`;
    throw new ApiError(errMessage, res.status, parsed);
  }

  return parsed as TResponse;
}

export function postJson<TResponse>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<TResponse> {
  return jsonRequest<TResponse>('POST', path, body, signal);
}

export function patchJson<TResponse>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<TResponse> {
  return jsonRequest<TResponse>('PATCH', path, body, signal);
}

export function getJson<TResponse>(
  path: string,
  signal?: AbortSignal,
): Promise<TResponse> {
  return jsonRequest<TResponse>('GET', path, undefined, signal);
}
