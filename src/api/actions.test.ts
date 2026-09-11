import { describe, it, expect, beforeEach } from 'vitest';
import {
  getVehicleActionStatuses,
  getVehicleActions,
  createVehicleAction,
} from './actions';
import { getVehicleById, getVehicles, getInventorySummary } from './inventory';
import { ApiError } from './errors';
import { apiClient } from './client';
import { createMockBackend } from '../mocks/composition';
import { server } from '../mocks/server';
import { DefaultTrustedActorProvider } from '../mocks/actions/action-service';
import { FixtureVehicleProjectionReader } from '../mocks/inventory/projection-reader';
import type { StorageLike } from '../mocks/actions/storage-adapter';
import type { TrustedActor } from '../mocks/actions/types';
import type { VehicleProjection } from '../mocks/inventory/types';

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('Actions API & HTTP Handlers', () => {
  beforeEach(() => {
    const isolatedBackend = createMockBackend({
      storage: new MemoryStorage(),
    });
    server.use(...isolatedBackend.handlers);
  });

  describe('GET /vehicle-action-statuses (STAT-001, STAT-002)', () => {
    it('returns only active statuses in deterministic sortOrder order', async () => {
      const statuses = await getVehicleActionStatuses();

      expect(statuses.length).toBeGreaterThan(0);
      expect(statuses.every((s) => s.isActive)).toBe(true);

      for (let i = 1; i < statuses.length; i++) {
        expect(statuses[i].sortOrder).toBeGreaterThanOrEqual(statuses[i - 1].sortOrder);
      }

      // Inactive status must not be in active response
      expect(statuses.some((s) => s.id === 'status_legacy_hold')).toBe(false);
    });
  });

  describe('POST /vehicles/:vehicleId/actions & HTTP Rejections (ACT-001, ACT-003 - ACT-006, Seams 3-5)', () => {
    it('creates an action with trusted actor snapshot, generated id and timestamp, and appends to history', async () => {
      // veh_001 is aging (91 days) and AVAILABLE
      const created = await createVehicleAction('veh_001', {
        statusId: 'status_price_reduction',
        note: 'Price markdown for aging inventory',
      });

      expect(created.id).toBeDefined();
      expect(created.vehicleId).toBe('veh_001');
      expect(created.statusId).toBe('status_price_reduction');
      expect(created.status).toEqual({
        id: 'status_price_reduction',
        code: 'PRICE_REDUCTION',
        label: 'Price Reduction',
      });
      expect(created.note).toBe('Price markdown for aging inventory');
      expect(created.createdAt).toBeDefined();
      expect(created.createdByActorId).toBe('actor_manager_1');
      expect(created.createdByDisplayName).toBe('Alex Manager');
      expect(created.createdByType).toBe('USER');

      // Verify history contains the action
      const history = await getVehicleActions('veh_001');
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(created);
    });

    it('accepts omitted, null, empty string, or any string notes without arbitrary business restriction', async () => {
      // Omitted note
      const a1 = await createVehicleAction('veh_001', {
        statusId: 'status_price_reduction',
      });
      expect(a1.note).toBeNull();

      // null note
      const a2 = await createVehicleAction('veh_001', {
        statusId: 'status_price_reduction',
        note: null,
      });
      expect(a2.note).toBeNull();

      // empty string note
      const a3 = await createVehicleAction('veh_001', {
        statusId: 'status_price_reduction',
        note: '',
      });
      expect(a3.note).toBe('');

      // text note
      const a4 = await createVehicleAction('veh_001', {
        statusId: 'status_price_reduction',
        note: 'Manager override note',
      });
      expect(a4.note).toBe('Manager override note');
    });

    it('rejects unexpected body fields attempting to override id, createdAt, or actor ownership', async () => {
      try {
        await apiClient.post('/vehicles/veh_001/actions', {
          statusId: 'status_price_reduction',
          id: 'injected_action_id',
        });
        expect.fail('Should have rejected body injection');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe('INVALID_REQUEST_BODY');
        expect(apiError.requestId).toBeDefined();
      }

      try {
        await apiClient.post('/vehicles/veh_001/actions', {
          statusId: 'status_price_reduction',
          createdAt: '2020-01-01T00:00:00Z',
        });
        expect.fail('Should have rejected body injection');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe('INVALID_REQUEST_BODY');
      }

      try {
        await apiClient.post('/vehicles/veh_001/actions', {
          statusId: 'status_price_reduction',
          createdByActorId: 'hacked_actor',
        });
        expect.fail('Should have rejected body injection');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe('INVALID_REQUEST_BODY');
      }
    });

    it('rejects unexpected extra keys in POST body with INVALID_REQUEST_BODY', async () => {
      try {
        await apiClient.post('/vehicles/veh_001/actions', {
          statusId: 'status_price_reduction',
          note: 'Valid note',
          unrelatedExtraKey: 'unexpected_value',
        });
        expect.fail('Should have rejected body with extra key');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe('INVALID_REQUEST_BODY');
        expect(apiError.message).toContain('unrelatedExtraKey');
      }
    });

    it('rejects with VEHICLE_NOT_FOUND when vehicle does not exist', async () => {
      try {
        await createVehicleAction('veh_non_existent', {
          statusId: 'status_price_reduction',
        });
        expect.fail('Should have rejected missing vehicle');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(404);
        expect(apiError.code).toBe('VEHICLE_NOT_FOUND');
        expect(apiError.requestId).toBeDefined();
      }
    });

    it('rejects with VEHICLE_NOT_PRESENT when vehicle is absent from latest snapshot', async () => {
      try {
        await createVehicleAction('veh_absent', {
          statusId: 'status_price_reduction',
        });
        expect.fail('Should have rejected absent vehicle');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe('VEHICLE_NOT_PRESENT');
        expect(apiError.requestId).toBeDefined();
      }
    });

    it('rejects with VEHICLE_NOT_AGING when vehicle is present but not aging (<= 90 days)', async () => {
      try {
        await createVehicleAction('veh_002', {
          statusId: 'status_price_reduction',
        });
        expect.fail('Should have rejected non-aging vehicle');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe('VEHICLE_NOT_AGING');
        expect(apiError.requestId).toBeDefined();
      }
    });

    it('rejects with STATUS_NOT_FOUND when statusId does not exist', async () => {
      try {
        await createVehicleAction('veh_001', {
          statusId: 'non_existent_status',
        });
        expect.fail('Should have rejected non-existent status');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(404);
        expect(apiError.code).toBe('STATUS_NOT_FOUND');
        expect(apiError.requestId).toBeDefined();
      }
    });

    it('rejects with STATUS_INACTIVE when status exists but is inactive', async () => {
      try {
        await createVehicleAction('veh_001', {
          statusId: 'status_legacy_hold',
        });
        expect.fail('Should have rejected inactive status');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.code).toBe('STATUS_INACTIVE');
        expect(apiError.requestId).toBeDefined();
      }
    });

    it('rejects with UNAUTHORIZED when trusted actor context is unauthorized (injected into backend graph)', async () => {
      const unauthorizedActor: TrustedActor = {
        id: 'actor_unauth',
        displayName: 'Unauthorized Actor',
        type: 'USER',
        isAuthorized: false,
      };
      const unauthBackend = createMockBackend({
        actorProvider: new DefaultTrustedActorProvider(unauthorizedActor),
        storage: new MemoryStorage(),
      });
      server.use(...unauthBackend.handlers);

      try {
        await createVehicleAction('veh_001', {
          statusId: 'status_price_reduction',
        });
        expect.fail('Should have rejected unauthorized actor');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(403);
        expect(apiError.code).toBe('UNAUTHORIZED');
        expect(apiError.requestId).toBeDefined();
      }
    });

    it.each([
      'AVAILABLE',
      'RESERVED',
      'SOLD',
      'UNAVAILABLE',
    ] as const)(
      'allows creation on aging vehicles with upstreamStatus %s (lifecycle neutrality)',
      async (status) => {
        const vehicleId = `veh_http_aging_${status.toLowerCase()}`;
        const customProjections: VehicleProjection[] = [
          {
            vehicleId,
            vin: `VIN_HTTP_${status}`,
            make: 'TestMake',
            model: 'TestModel',
            stockedAt: '2026-02-01T12:00:00Z', // 120 days ago (aging)
            upstreamStatus: status,
            isPresentInLatestSnapshot: true,
            lastSeenAt: '2026-06-01T12:00:00Z',
          },
        ];
        const lifecycleBackend = createMockBackend({
          projectionReader: new FixtureVehicleProjectionReader(customProjections),
          storage: new MemoryStorage(),
        });
        server.use(...lifecycleBackend.handlers);

        const action = await createVehicleAction(vehicleId, {
          statusId: 'status_inspection_required',
        });
        expect(action).toBeDefined();
        expect(action.vehicleId).toBe(vehicleId);
        expect(action.statusId).toBe('status_inspection_required');
      },
    );
  });

  describe('GET /vehicles/:vehicleId/actions (ACT-002, Seam 2)', () => {
    it('returns empty array when vehicle has no actions', async () => {
      const actions = await getVehicleActions('veh_001');
      expect(actions).toEqual([]);
    });

    it('returns complete history newest-first with status identity and label', async () => {
      await createVehicleAction('veh_001', {
        statusId: 'status_price_reduction',
        note: 'Action 1',
      });
      await createVehicleAction('veh_001', {
        statusId: 'status_wholesale_auction',
        note: 'Action 2',
      });

      const history = await getVehicleActions('veh_001');
      expect(history).toHaveLength(2);
      expect(history[0].note).toBe('Action 2');
      expect(history[1].note).toBe('Action 1');
      expect(history[0].status.label).toBe('Wholesale / Auction');
      expect(history[1].status.label).toBe('Price Reduction');
    });

    it('rejects with VEHICLE_NOT_FOUND when querying history for non-existent vehicle', async () => {
      try {
        await getVehicleActions('veh_non_existent');
        expect.fail('Should have rejected missing vehicle');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.status).toBe(404);
        expect(apiError.code).toBe('VEHICLE_NOT_FOUND');
      }
    });
  });

  describe('ACT-007 HTTP/MSW Multi-Graph Persistence Seam', () => {
    it('persists through HTTP across fresh graph B over same storage and retains action in graph C with different projection snapshot', async () => {
      const persistentStorage = new MemoryStorage();
      const storageKey = 'act007:multi-graph';

      // Graph A: POSTs action
      const backendA = createMockBackend({
        storage: persistentStorage,
        storageKey,
      });
      server.use(...backendA.handlers);

      const createdAction = await createVehicleAction('veh_001', {
        statusId: 'status_price_reduction',
        note: 'Persisted across graphs',
      });
      expect(createdAction.id).toBeDefined();

      // Graph B: fresh backend over the exact same StorageLike
      const backendB = createMockBackend({
        storage: persistentStorage,
        storageKey,
      });
      server.use(...backendB.handlers);

      // Graph B observes history
      const historyB = await getVehicleActions('veh_001');
      expect(historyB).toHaveLength(1);
      expect(historyB[0].id).toBe(createdAction.id);
      expect(historyB[0].note).toBe('Persisted across graphs');

      // Graph B observes current action via detail
      const detailB = await getVehicleById('veh_001');
      expect(detailB.currentAction).not.toBeNull();
      expect(detailB.currentAction?.id).toBe(createdAction.id);

      // Graph B observes current action via list filter
      const listB = await getVehicles({ actionStatusId: 'status_price_reduction' });
      expect(listB.data.some((v) => v.vehicleId === 'veh_001')).toBe(true);

      // Graph C: genuinely different projection snapshot (different vehicles, different sync date)
      const modifiedProjections: VehicleProjection[] = [
        {
          vehicleId: 'veh_001', // stable vehicle retained
          vin: '1HGCR2F83HA000001',
          make: 'BMW',
          model: 'X5',
          stockedAt: '2026-03-02T12:00:00Z',
          upstreamStatus: 'AVAILABLE',
          isPresentInLatestSnapshot: true,
          lastSeenAt: '2026-07-01T00:00:00Z',
        },
        {
          vehicleId: 'veh_completely_new',
          vin: '1HGCR2F83HA777777',
          make: 'Volvo',
          model: 'XC90',
          stockedAt: '2026-06-15T00:00:00Z',
          upstreamStatus: 'AVAILABLE',
          isPresentInLatestSnapshot: true,
          lastSeenAt: '2026-07-01T00:00:00Z',
        },
      ];
      const backendC = createMockBackend({
        storage: persistentStorage,
        storageKey,
        projectionReader: new FixtureVehicleProjectionReader(
          modifiedProjections,
          '2026-07-01T00:00:00Z',
        ),
      });
      server.use(...backendC.handlers);

      // Graph C still retains the stable-vehicle action
      const historyC = await getVehicleActions('veh_001');
      expect(historyC).toHaveLength(1);
      expect(historyC[0].id).toBe(createdAction.id);

      const detailC = await getVehicleById('veh_001');
      expect(detailC.currentAction?.id).toBe(createdAction.id);

      // Graph C summary reflects different total inventory (2 present) and 1 aging with action
      const summaryC = await getInventorySummary();
      expect(summaryC.totalInventory).toBe(2);
      expect(summaryC.agingWithAction).toBe(1);
      expect(summaryC.lastSuccessfulSyncAt).toBe('2026-07-01T00:00:00Z');
    });
  });
});
