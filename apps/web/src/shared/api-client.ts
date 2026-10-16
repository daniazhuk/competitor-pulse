import { apiErrorSchema } from '@competitor-pulse/contract';
import type { z } from 'zod';

const HTTP_NO_CONTENT = 204;

export class ApiError extends Error {
  override name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('accept', 'application/json');
  const response = await fetch(path, { ...init, headers });
  if (response.ok) return response;

  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  if (parsed.success) {
    throw new ApiError(response.status, parsed.data.error.code, parsed.data.error.message);
  }
  throw new ApiError(response.status, 'UNKNOWN', `Request failed with status ${response.status}`);
}

/** Fetches JSON and validates it against the shared contract schema. */
export async function requestJson<T extends z.ZodType>(
  path: string,
  schema: T,
  init?: RequestInit,
): Promise<z.output<T>> {
  const response = await send(path, init);
  return schema.parse(await response.json());
}

export async function requestNoContent(path: string, init?: RequestInit): Promise<void> {
  const response = await send(path, init);
  if (response.status !== HTTP_NO_CONTENT) await response.body?.cancel();
}

export const jsonBody = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json' },
});
