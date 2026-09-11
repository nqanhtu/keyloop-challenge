import { isApiError } from '../../api';

/**
 * System Design 5.8 / 8.6: frontend behavior branches on the stable
 * `ApiError.code` value, never on message text.
 *
 * Expected business rejections (for example `VEHICLE_NOT_AGING`) are contained
 * regional outcomes, not infrastructure incidents, so they must not be
 * escalated as client-error telemetry. Anything else is unexpected.
 */
export const EXPECTED_BUSINESS_ERROR_CODES: ReadonlySet<string> = new Set([
  'VEHICLE_NOT_AGING',
  'VEHICLE_NOT_PRESENT',
  'VEHICLE_NOT_FOUND',
  'STATUS_INACTIVE',
  'STATUS_NOT_FOUND',
  'UNAUTHORIZED',
  'INVALID_REQUEST_BODY',
]);

const FALLBACK_CLIENT_ERROR_MESSAGE = 'Unable to record the action.';

export function apiErrorCode(error: unknown): string | undefined {
  return isApiError(error) ? error.code : undefined;
}

export function isExpectedBusinessError(error: unknown): boolean {
  const code = apiErrorCode(error);
  return code !== undefined && EXPECTED_BUSINESS_ERROR_CODES.has(code);
}

/** True only for failures that are not classified expected business rejections. */
export function isUnexpectedClientError(error: unknown): boolean {
  return !isExpectedBusinessError(error);
}

/**
 * Presentation text for a client error. Contract errors keep their server
 * message; anything else gets a stable, non-leaking fallback. This function is
 * presentation only and never decides behavior.
 */
export function clientErrorMessage(
  error: unknown,
  fallback: string = FALLBACK_CLIENT_ERROR_MESSAGE,
): string {
  return isApiError(error) ? error.message : fallback;
}
