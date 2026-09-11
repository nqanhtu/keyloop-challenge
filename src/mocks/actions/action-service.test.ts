import { describe, it, expect, beforeEach } from 'vitest';
import { ActionService, ActionServiceError } from './action-service';
import { StatusCatalog } from './status-catalog';
import { mockActionStatuses } from './fixtures';
import { FixtureVehicleProjectionReader } from '../inventory/projection-reader';
import { PersistentActionRepository } from './action-repository';
import { BrowserActionStorageAdapter, type StorageLike } from './storage-adapter';
import type { TrustedActor } from './types';

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

describe('ActionService Unit & Business Rules (ACT-001 - ACT-006)', () => {
  let memoryStorage: MemoryStorage;
  let adapter: BrowserActionStorageAdapter;
  let repository: PersistentActionRepository;
  let statusCatalog: StatusCatalog;
  let projectionReader: FixtureVehicleProjectionReader;
  let service: ActionService;

  const authorizedActor: TrustedActor = {
    id: 'actor_manager_1',
    displayName: 'Alex Manager',
    type: 'USER',
    isAuthorized: true,
  };

  const unauthorizedActor: TrustedActor = {
    id: 'actor_unauth_1',
    displayName: 'Unauthorized Actor',
    type: 'USER',
    isAuthorized: false,
  };

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    adapter = new BrowserActionStorageAdapter({
      storage: memoryStorage,
      storageKey: 'test:actions',
      initialSeed: [],
    });
    repository = new PersistentActionRepository(adapter);
    statusCatalog = new StatusCatalog(mockActionStatuses);
    projectionReader = new FixtureVehicleProjectionReader();

    service = new ActionService({
      actionRepository: repository,
      statusCatalog,
      projectionReader,
      actorProvider: {
        getCurrentActor: () => authorizedActor,
      },
      timeZone: 'UTC',
      referenceInstant: '2026-06-01T12:00:00Z',
    });
  });

  describe('Action Creation (ACT-001, ACT-004)', () => {
    it('creates an action for an eligible aging vehicle with server-generated ID, timestamp, and actor snapshot', async () => {
      // veh_001 is aging (91 days) and AVAILABLE
      const action = await service.createAction(
        'veh_001',
        { statusId: 'status_price_reduction', note: 'Marked for clearance' },
        authorizedActor,
      );

      expect(action.id).toBeDefined();
      expect(action.vehicleId).toBe('veh_001');
      expect(action.statusId).toBe('status_price_reduction');
      expect(action.status).toEqual({
        id: 'status_price_reduction',
        code: 'PRICE_REDUCTION',
        label: 'Price Reduction',
      });
      expect(action.note).toBe('Marked for clearance');
      expect(action.createdAt).toBeDefined();
      expect(action.createdByActorId).toBe('actor_manager_1');
      expect(action.createdByDisplayName).toBe('Alex Manager');
      expect(action.createdByType).toBe('USER');

      // Verify appended to history
      const history = await service.getActionsForVehicle('veh_001');
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe(action.id);
    });

    it('accepts note as omitted, null, empty string, or any text', async () => {
      // 1. Omitted note
      const a1 = await service.createAction(
        'veh_001',
        { statusId: 'status_price_reduction' },
        authorizedActor,
      );
      expect(a1.note).toBeNull();

      // 2. null note
      const a2 = await service.createAction(
        'veh_001',
        { statusId: 'status_price_reduction', note: null },
        authorizedActor,
      );
      expect(a2.note).toBeNull();

      // 3. empty string note
      const a3 = await service.createAction(
        'veh_001',
        { statusId: 'status_price_reduction', note: '' },
        authorizedActor,
      );
      expect(a3.note).toBe('');

      // 4. normal string
      const a4 = await service.createAction(
        'veh_001',
        { statusId: 'status_price_reduction', note: 'Clearance approved' },
        authorizedActor,
      );
      expect(a4.note).toBe('Clearance approved');
    });

    it('rejects unexpected actor, identity, timestamp, or extra fields from body input', async () => {
      await expect(
        service.createAction(
          'veh_001',
          {
            statusId: 'status_price_reduction',
            // @ts-expect-error Testing forbidden body field injection
            id: 'injected_id',
          },
          authorizedActor,
        ),
      ).rejects.toThrow(ActionServiceError);

      await expect(
        service.createAction(
          'veh_001',
          {
            statusId: 'status_price_reduction',
            // @ts-expect-error Testing forbidden body field injection
            createdAt: '2020-01-01T00:00:00Z',
          },
          authorizedActor,
        ),
      ).rejects.toThrow(ActionServiceError);

      await expect(
        service.createAction(
          'veh_001',
          {
            statusId: 'status_price_reduction',
            // @ts-expect-error Testing forbidden body field injection
            createdByActorId: 'injected_actor',
          },
          authorizedActor,
        ),
      ).rejects.toThrow(ActionServiceError);

      // Unrelated extra key
      await expect(
        service.createAction(
          'veh_001',
          {
            statusId: 'status_price_reduction',
            // @ts-expect-error Testing unrelated extra key
            unrelatedExtraKey: 'surprise',
          },
          authorizedActor,
        ),
      ).rejects.toThrow(ActionServiceError);
    });
  });

  describe('Eligibility Rejections & Error Codes (ACT-005, ACT-006)', () => {
    it('rejects with UNAUTHORIZED when trusted actor is unauthorized', async () => {
      try {
        await service.createAction(
          'veh_001',
          { statusId: 'status_price_reduction' },
          unauthorizedActor,
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ActionServiceError);
        expect((err as ActionServiceError).code).toBe('UNAUTHORIZED');
        expect((err as ActionServiceError).status).toBe(403);
      }
    });

    it('rejects with VEHICLE_NOT_FOUND when vehicle does not exist', async () => {
      try {
        await service.createAction(
          'veh_non_existent',
          { statusId: 'status_price_reduction' },
          authorizedActor,
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ActionServiceError);
        expect((err as ActionServiceError).code).toBe('VEHICLE_NOT_FOUND');
        expect((err as ActionServiceError).status).toBe(404);
      }
    });

    it('rejects with VEHICLE_NOT_PRESENT when vehicle is not in latest snapshot', async () => {
      // veh_absent has isPresentInLatestSnapshot: false
      try {
        await service.createAction(
          'veh_absent',
          { statusId: 'status_price_reduction' },
          authorizedActor,
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ActionServiceError);
        expect((err as ActionServiceError).code).toBe('VEHICLE_NOT_PRESENT');
        expect((err as ActionServiceError).status).toBe(400);
      }
    });

    it('rejects with VEHICLE_NOT_AGING when vehicle is present but not aging (<= 90 days)', async () => {
      // veh_002 is 90 days (not aging)
      try {
        await service.createAction(
          'veh_002',
          { statusId: 'status_price_reduction' },
          authorizedActor,
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ActionServiceError);
        expect((err as ActionServiceError).code).toBe('VEHICLE_NOT_AGING');
        expect((err as ActionServiceError).status).toBe(400);
      }
    });

    it('rejects with STATUS_NOT_FOUND when statusId does not exist', async () => {
      try {
        await service.createAction(
          'veh_001',
          { statusId: 'non_existent_status' },
          authorizedActor,
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ActionServiceError);
        expect((err as ActionServiceError).code).toBe('STATUS_NOT_FOUND');
        expect((err as ActionServiceError).status).toBe(404);
      }
    });

    it('rejects with STATUS_INACTIVE when status exists but is inactive', async () => {
      // status_legacy_hold is inactive
      try {
        await service.createAction(
          'veh_001',
          { statusId: 'status_legacy_hold' },
          authorizedActor,
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ActionServiceError);
        expect((err as ActionServiceError).code).toBe('STATUS_INACTIVE');
        expect((err as ActionServiceError).status).toBe(400);
      }
    });

    it.each([
      'AVAILABLE',
      'RESERVED',
      'SOLD',
      'UNAVAILABLE',
    ] as const)(
      'treats aging vehicle with upstreamStatus %s as eligible (lifecycle neutrality)',
      async (status) => {
        const vehicleId = `veh_aging_${status.toLowerCase()}`;
        const singleVehicleReader = new FixtureVehicleProjectionReader([
          {
            vehicleId,
            vin: `VIN_${status}`,
            make: 'TestMake',
            model: 'TestModel',
            stockedAt: '2026-02-01T12:00:00Z', // 120 days ago (aging)
            upstreamStatus: status,
            isPresentInLatestSnapshot: true,
            lastSeenAt: '2026-06-01T12:00:00Z',
          },
        ]);

        const customService = new ActionService({
          actionRepository: repository,
          statusCatalog,
          projectionReader: singleVehicleReader,
          actorProvider: { getCurrentActor: () => authorizedActor },
          timeZone: 'UTC',
          referenceInstant: '2026-06-01T12:00:00Z',
        });

        const action = await customService.createAction(
          vehicleId,
          { statusId: 'status_price_reduction' },
          authorizedActor,
        );

        expect(action).toBeDefined();
        expect(action.vehicleId).toBe(vehicleId);
        expect(action.statusId).toBe('status_price_reduction');
      },
    );
  });

  describe('Action History (ACT-002, STAT-002)', () => {
    it('returns complete immutable history newest-first with tie-breaker', async () => {
      // Create first action
      await service.createAction(
        'veh_001',
        { statusId: 'status_price_reduction', note: 'Action 1' },
        authorizedActor,
      );

      // Create second action
      await service.createAction(
        'veh_001',
        { statusId: 'status_retail_promotion', note: 'Action 2' },
        authorizedActor,
      );

      const history = await service.getActionsForVehicle('veh_001');
      expect(history).toHaveLength(2);
      expect(history[0].note).toBe('Action 2');
      expect(history[1].note).toBe('Action 1');
    });

    it('returns complete immutable history newest-first with deterministic tie-breaker when timestamps are equal', async () => {
      const fixedTimestamp = '2026-06-01T12:00:00.000Z';
      const equalClockService = new ActionService({
        actionRepository: repository,
        statusCatalog,
        projectionReader,
        clock: () => fixedTimestamp,
        actorProvider: { getCurrentActor: () => authorizedActor },
        timeZone: 'UTC',
        referenceInstant: '2026-06-01T12:00:00Z',
      });

      await equalClockService.createAction(
        'veh_001',
        { statusId: 'status_price_reduction', note: 'First action equal time' },
        authorizedActor,
      );

      await equalClockService.createAction(
        'veh_001',
        { statusId: 'status_wholesale_auction', note: 'Second action equal time' },
        authorizedActor,
      );

      const history = await equalClockService.getActionsForVehicle('veh_001');
      expect(history).toHaveLength(2);
      expect(history[0].createdAt).toBe(fixedTimestamp);
      expect(history[1].createdAt).toBe(fixedTimestamp);
      // Newest appended action must be first under deterministic tie-breaker
      expect(history[0].note).toBe('Second action equal time');
      expect(history[1].note).toBe('First action equal time');
    });

    it('expands inactive historical statuses correctly', async () => {
      // Direct repo append of a historical action with inactive status
      await repository.appendAction({
        id: 'act_hist_inactive',
        vehicleId: 'veh_004',
        statusId: 'status_legacy_hold',
        note: 'Historical action with deactivated status',
        createdAt: '2026-05-01T10:00:00Z',
        createdByActorId: 'actor_legacy',
        createdByDisplayName: 'Legacy Manager',
        createdByType: 'USER',
      });

      const history = await service.getActionsForVehicle('veh_004');
      expect(history).toHaveLength(1);
      expect(history[0].status).toEqual({
        id: 'status_legacy_hold',
        code: 'LEGACY_HOLD',
        label: 'Legacy Hold (Discontinued)',
      });
    });
  });
});
