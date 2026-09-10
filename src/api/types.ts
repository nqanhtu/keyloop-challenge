export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

export interface ApiClientConfig {
  baseUrl?: string;
  defaultHeaders?: Record<string, string>;
}
