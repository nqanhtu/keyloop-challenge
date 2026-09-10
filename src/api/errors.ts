/**
 * System Design section 5.8: Error contract
 *
 * type ApiError = {
 *   code: string;
 *   message: string;
 *   requestId: string;
 *   details?: Record<string, unknown>;
 * };
 *
 * Frontend behavior is based on stable code values rather than parsing messages.
 */

export interface ApiErrorPayload {
  code: string;
  message: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export class ApiError extends Error implements ApiErrorPayload {
  readonly code: string;
  readonly requestId: string;
  readonly details?: Record<string, unknown>;
  readonly status: number;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code;
    this.requestId = payload.requestId;
    this.details = payload.details;

    // Restore prototype chain for instanceof checks across compilation targets
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
