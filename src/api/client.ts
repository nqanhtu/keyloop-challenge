import { ApiError, type ApiErrorPayload } from './errors';
import type { ApiClientConfig, RequestOptions } from './types';

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? '';
    this.defaultHeaders = {
      Accept: 'application/json',
      ...config.defaultHeaders,
    };
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, body, ...rest } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        url += (url.includes('?') ? '&' : '?') + queryString;
      }
    }

    const mergedHeaders: Record<string, string> = {
      ...this.defaultHeaders,
      ...(headers as Record<string, string>),
    };

    let serializedBody: BodyInit | undefined;
    if (body !== undefined && body !== null) {
      if (typeof body === 'string' || body instanceof FormData || body instanceof Blob) {
        serializedBody = body as BodyInit;
      } else {
        mergedHeaders['Content-Type'] = 'application/json';
        serializedBody = JSON.stringify(body);
      }
    }

    const response = await fetch(url, {
      ...rest,
      headers: mergedHeaders,
      body: serializedBody,
    });

    if (!response.ok) {
      const fallbackPayload: ApiErrorPayload = {
        code: `HTTP_${response.status}`,
        message: response.statusText || `Request failed with status ${response.status}`,
        requestId: response.headers.get('x-request-id') ?? 'unknown',
      };

      let payload: ApiErrorPayload;
      try {
        const rawJson = await response.json();
        if (
          rawJson &&
          typeof rawJson === 'object' &&
          typeof rawJson.code === 'string' &&
          typeof rawJson.message === 'string'
        ) {
          payload = {
            code: rawJson.code,
            message: rawJson.message,
            requestId:
              typeof rawJson.requestId === 'string'
                ? rawJson.requestId
                : fallbackPayload.requestId,
            details:
              rawJson.details && typeof rawJson.details === 'object'
                ? (rawJson.details as Record<string, unknown>)
                : undefined,
          };
        } else {
          payload = fallbackPayload;
        }
      } catch {
        payload = fallbackPayload;
      }

      throw new ApiError(response.status, payload);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  get<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }
}

export const apiClient = new ApiClient();
