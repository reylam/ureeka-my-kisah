import { env } from './env';
import { supabase } from './supabase';

/**
 * The single HTTP client for the PARUPINTAS backend.
 *
 * - Attaches the current Supabase access token to every request.
 * - Unwraps the `{ success, data, meta }` envelope and turns failures into
 *   `ApiError`, so callers deal with one error type.
 * - Tells the session layer when the server says the session is gone (401),
 *   so the app signs out instead of showing a page of failed requests.
 */

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string[]>;

  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** First message for a field from a 422 response. */
  fieldError(field: string): string | undefined {
    return this.details?.[field]?.[0];
  }
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface ApiResult<T> {
  data: T;
  meta?: PageMeta;
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

let onUnauthorized: (() => void) | null = null;

/** Registered once by the auth store. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${env.apiBaseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await accessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form; // the browser sets the multipart boundary
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError(0, 'NETWORK_ERROR', 'Server tidak bisa dijangkau. Cek koneksi kamu lalu coba lagi.');
  }

  if (response.status === 204) return { data: undefined as T };

  let payload: {
    success?: boolean;
    data?: T;
    meta?: PageMeta;
    error?: { code?: string; message?: string; details?: Record<string, string[]> };
  } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.success === false) {
    const error = payload?.error;
    if (response.status === 401) onUnauthorized?.();
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? 'Server tidak bisa menyelesaikan permintaan itu.',
      error?.details,
    );
  }

  return { data: payload.data as T, meta: payload.meta };
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    request<T>('GET', path, { query, signal }).then((result) => result.data),
  getPage: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    request<T[]>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) =>
    request<T>('POST', path, { body: body ?? {} }).then((result) => result.data),
  patch: <T>(path: string, body: unknown) =>
    request<T>('PATCH', path, { body }).then((result) => result.data),
  put: <T>(path: string, body?: unknown) =>
    request<T>('PUT', path, { body: body ?? {} }).then((result) => result.data),
  delete: <T = void>(path: string) => request<T>('DELETE', path).then((result) => result.data),
  upload: <T>(path: string, form: FormData) =>
    request<T>('POST', path, { form }).then((result) => result.data),
};

/** Load every page of a list endpoint. */
export async function fetchAllPages<T>(path: string, query: Query = {}, pageSize = 100): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; page <= 200; page += 1) {
    const result = await api.getPage<T>(path, { ...query, page, pageSize });
    items.push(...result.data);
    if (!result.meta || page >= result.meta.pageCount) break;
  }
  return items;
}

/** Message for UI: the error's own text if there is one, otherwise a fallback. */
export function errorMessage(error: unknown, fallback = 'Terjadi kesalahan. Coba lagi ya.'): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
