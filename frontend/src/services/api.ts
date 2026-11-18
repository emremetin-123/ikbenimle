import { API_BASE } from '../config';
import type { ApiErrorBody, PaginatedResponse } from '../types';

type JsonBody = Record<string, unknown> | unknown[];

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  requestId?: string;

  constructor(status: number, body: ApiErrorBody & { details?: unknown; request_id?: string }) {
    super(body.message || body.error || `HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.error || 'API_ERROR';
    this.details = body.details;
    this.requestId = body.request_id;
  }
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    if (!res.ok) throw new ApiError(res.status, { error: 'INVALID_API_RESPONSE' });
    throw new Error('Sunucudan gecersiz JSON cevabi alindi.');
  }
  if (!res.ok) {
    throw new ApiError(res.status, data as ApiErrorBody);
  }
  return data as T;
}

type RequestOptions = {
  signal?: AbortSignal;
  headers?: HeadersInit;
};

const LIST_ALL_CONCURRENCY = 6;

export const api = {
  get<T>(path: string, options: RequestOptions = {}) {
    return fetch(`${API_BASE}${path}`, options).then(readJson<T>);
  },

  async list<T>(path: string, options: RequestOptions = {}) {
    return fetch(`${API_BASE}${path}`, options).then(readJson<PaginatedResponse<T>>);
  },

  async listAll<T>(path: string, options: RequestOptions = {}) {
    const separator = path.includes('?') ? '&' : '?';
    const first = await fetch(`${API_BASE}${path}${separator}page=1&pageSize=100`, options)
      .then(readJson<PaginatedResponse<T>>);
    const items = [...first.items];
    const remainingPages = Array.from(
      { length: Math.max(0, first.pagination.totalPages - 1) },
      (_, index) => index + 2,
    );
    for (let offset = 0; offset < remainingPages.length; offset += LIST_ALL_CONCURRENCY) {
      const batch = remainingPages.slice(offset, offset + LIST_ALL_CONCURRENCY);
      const responses = await Promise.all(
        batch.map((page) => fetch(
          `${API_BASE}${path}${separator}page=${page}&pageSize=100`,
          options,
        ).then(readJson<PaginatedResponse<T>>)),
      );
      responses.forEach((response) => items.push(...response.items));
    }
    return items;
  },

  post<T>(path: string, body?: JsonBody, options: RequestOptions = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(readJson<T>);
  },

  put<T>(path: string, body?: JsonBody, options: RequestOptions = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(readJson<T>);
  },

  delete<T>(path: string, options: RequestOptions = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      method: 'DELETE',
    }).then(readJson<T>);
  },

  upload<T>(path: string, body: FormData, options: RequestOptions = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      method: 'POST',
      body,
    }).then(readJson<T>);
  },

  async download(path: string, options: RequestOptions = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);
    if (!response.ok) {
      const text = await response.text();
      let body: ApiErrorBody = { error: `HTTP ${response.status}` };
      try {
        body = text ? JSON.parse(text) : body;
      } catch {
        // Keep the status-based error for non-JSON download failures.
      }
      throw new ApiError(response.status, body);
    }
    return response.blob();
  },
};
