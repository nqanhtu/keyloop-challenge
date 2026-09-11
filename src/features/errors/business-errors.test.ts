import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api';
import {
  apiErrorCode,
  clientErrorMessage,
  isExpectedBusinessError,
  isUnexpectedClientError,
} from './business-errors';

function apiError(code: string, message = 'message text is not authority'): ApiError {
  return new ApiError(400, { code, message, requestId: 'req_business_1' });
}

describe('T06 — Stable error-code classification seam (ERR-002)', () => {
  it('classifies expected business rejections by code', () => {
    expect(isExpectedBusinessError(apiError('VEHICLE_NOT_AGING'))).toBe(true);
    expect(isExpectedBusinessError(apiError('STATUS_INACTIVE'))).toBe(true);
    expect(isUnexpectedClientError(apiError('VEHICLE_NOT_AGING'))).toBe(false);
  });

  it('classifies infrastructure failures by code regardless of the message text', () => {
    // Identical message text, different code: the classification follows code.
    const sharedMessage = 'Request could not be completed';
    expect(isExpectedBusinessError(apiError('VEHICLE_NOT_AGING', sharedMessage))).toBe(true);
    expect(isUnexpectedClientError(apiError('INTERNAL_ERROR', sharedMessage))).toBe(true);
  });

  it('treats a non-contract failure as an unexpected client error', () => {
    expect(apiErrorCode(new Error('boom'))).toBeUndefined();
    expect(isExpectedBusinessError(new Error('VEHICLE_NOT_AGING'))).toBe(false);
    expect(isUnexpectedClientError(new Error('boom'))).toBe(true);
  });

  it('surfaces the server message for contract errors and a generic fallback otherwise', () => {
    expect(clientErrorMessage(apiError('VEHICLE_NOT_AGING', 'Vehicle is not aging'))).toBe(
      'Vehicle is not aging',
    );
    expect(clientErrorMessage(new Error('render blew up'))).toBe(
      'Unable to record the action.',
    );
  });
});
