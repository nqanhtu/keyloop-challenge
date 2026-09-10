import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { apiClient } from './client';
import { ApiError, isApiError } from './errors';

describe('HTTP Client Seam & ApiError Contract', () => {
  it('successfully issues an HTTP request intercepted by MSW through the shared client', async () => {
    // MSW interceptor returns valid health payload
    server.use(
      http.get('/api/test-resource', () => {
        return HttpResponse.json({
          status: 'ok',
          service: 'inventory-command-center',
          timestamp: '2026-09-10T12:00:00Z',
        });
      }),
    );

    const response = await apiClient.get<{ status: string; service: string; timestamp: string }>(
      '/api/test-resource',
    );

    expect(response).toEqual({
      status: 'ok',
      service: 'inventory-command-center',
      timestamp: '2026-09-10T12:00:00Z',
    });
  });

  it('preserves stable ApiError code, message, requestId, and optional details without message parsing', async () => {
    server.use(
      http.get('/api/test-error', () => {
        return HttpResponse.json(
          {
            code: 'ACTION_NOT_ELIGIBLE',
            message: 'Vehicle is not currently eligible for an action',
            requestId: 'req-err-456',
            details: {
              reason: 'VEHICLE_NOT_AGING',
              inventoryAgeDays: 45,
            },
          },
          { status: 400 },
        );
      }),
    );

    let caughtError: unknown;
    try {
      await apiClient.get('/api/test-error');
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(isApiError(caughtError)).toBe(true);

    if (isApiError(caughtError)) {
      // Contract fields preserved
      expect(caughtError.status).toBe(400);
      expect(caughtError.code).toBe('ACTION_NOT_ELIGIBLE');
      expect(caughtError.message).toBe('Vehicle is not currently eligible for an action');
      expect(caughtError.requestId).toBe('req-err-456');
      expect(caughtError.details).toEqual({
        reason: 'VEHICLE_NOT_AGING',
        inventoryAgeDays: 45,
      });

      // Proof that error branching is purely code-driven, requiring no message parsing
      const errorCategory = caughtError.code === 'ACTION_NOT_ELIGIBLE' ? 'BUSINESS_REJECTION' : 'UNKNOWN';
      expect(errorCategory).toBe('BUSINESS_REJECTION');
    }
  });

  it('synthesizes stable ApiError for non-JSON or malformed error responses', async () => {
    server.use(
      http.get('/api/server-crash', () => {
        return new HttpResponse('Internal Server Error HTML', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: {
            'x-request-id': 'req-fallback-789',
          },
        });
      }),
    );

    await expect(apiClient.get('/api/server-crash')).rejects.toThrow(ApiError);

    try {
      await apiClient.get('/api/server-crash');
    } catch (err) {
      if (isApiError(err)) {
        expect(err.status).toBe(500);
        expect(err.code).toBe('HTTP_500');
        expect(err.requestId).toBe('req-fallback-789');
      }
    }
  });
});
