import { describe, it, expect, beforeEach } from 'vitest';
import {
  BrowserActionStorageAdapter,
  ActionStorageError,
  resolveDefaultBrowserStorage,
} from './storage-adapter';
import { PersistentActionRepository } from './action-repository';
import type { PersistedVehicleAction } from './types';
import type { StorageLike } from './storage-adapter';

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

class FaultyStorage implements StorageLike {
  getItem(_key: string): string | null {
    throw new Error('Disk I/O error');
  }
  setItem(_key: string, _value: string): void {
    throw new Error('Disk full');
  }
  removeItem(_key: string): void {}
}

describe('Action Persistence Seam (ACT-001, ACT-007, Seam 6)', () => {
  let sharedStorage: MemoryStorage;
  const storageKey = 'test:vehicle-actions';

  beforeEach(() => {
    sharedStorage = new MemoryStorage();
  });

  it('persists actions and survives creation of a fresh repository instance over the same storage', async () => {
    const adapter1 = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });
    const repo1 = new PersistentActionRepository(adapter1);

    const action1: PersistedVehicleAction = {
      id: 'act_001',
      vehicleId: 'veh_001',
      statusId: 'status_price_reduction',
      note: 'First action',
      createdAt: '2026-06-01T10:00:00Z',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };

    await repo1.appendAction(action1);

    const vehicle1Actions = await repo1.getActionsForVehicle('veh_001');
    expect(vehicle1Actions).toHaveLength(1);
    expect(vehicle1Actions[0].id).toBe('act_001');

    // Simulate browser reload / fresh module graph over the same storage
    const adapter2 = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });
    const repo2 = new PersistentActionRepository(adapter2);

    const reloadedActions = await repo2.getActionsForVehicle('veh_001');
    expect(reloadedActions).toHaveLength(1);
    expect(reloadedActions[0]).toEqual(action1);

    // Append second action via repo2
    const action2: PersistedVehicleAction = {
      id: 'act_002',
      vehicleId: 'veh_001',
      statusId: 'status_wholesale_auction',
      note: 'Second action',
      createdAt: '2026-06-01T11:00:00Z',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };
    await repo2.appendAction(action2);

    // Verify append-only history (both exist)
    const allVeh1Actions = await repo2.getActionsForVehicle('veh_001');
    expect(allVeh1Actions).toHaveLength(2);
    expect(allVeh1Actions.map((a) => a.id)).toEqual(['act_001', 'act_002']);
  });

  it('preserves actions independently when inventory projections are replaced or absent', async () => {
    const adapter = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });
    const repo = new PersistentActionRepository(adapter);

    const action: PersistedVehicleAction = {
      id: 'act_pres_001',
      vehicleId: 'veh_absent',
      statusId: 'status_price_reduction',
      note: 'Preserved regardless of projection',
      createdAt: '2026-06-01T10:00:00Z',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };

    await repo.appendAction(action);

    const actions = await repo.getActionsForVehicle('veh_absent');
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('act_pres_001');
  });

  it('seeds initial actions only when storage is missing', () => {
    const seedAction: PersistedVehicleAction = {
      id: 'seed_1',
      vehicleId: 'veh_seed',
      statusId: 'status_price_reduction',
      note: 'Seed note',
      createdAt: '2026-06-01T00:00:00Z',
      createdByActorId: 'actor_seed',
      createdByDisplayName: 'Seed Actor',
      createdByType: 'SYSTEM',
    };

    const adapter = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [seedAction],
    });

    const actions = adapter.getAll();
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('seed_1');
    // Storage now contains the seeded record
    expect(sharedStorage.getItem(storageKey)).toContain('seed_1');
  });

  it('throws ActionStorageError on corrupt JSON', () => {
    sharedStorage.setItem(storageKey, '{ corrupt json invalid');

    const adapter = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });

    expect(() => adapter.getAll()).toThrow(ActionStorageError);
  });

  it('throws ActionStorageError on non-array persisted data or invalid action shapes', () => {
    // Non-array
    sharedStorage.setItem(storageKey, JSON.stringify({ not: 'an array' }));
    const adapter1 = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });
    expect(() => adapter1.getAll()).toThrow(ActionStorageError);

    // Array with invalid item shape (missing createdAt and createdByType)
    sharedStorage.setItem(
      storageKey,
      JSON.stringify([{ id: 'act_x', vehicleId: 'veh_1', statusId: 's1' }]),
    );
    const adapter2 = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });
    expect(() => adapter2.getAll()).toThrow(ActionStorageError);
  });

  it('throws ActionStorageError on storage read exception', () => {
    const faultyStorage = new FaultyStorage();
    const adapter = new BrowserActionStorageAdapter({
      storage: faultyStorage,
      storageKey,
      initialSeed: [],
    });

    expect(() => adapter.getAll()).toThrow(ActionStorageError);
  });

  it('performs ZERO writes when append is attempted after a failed read', () => {
    const corruptContent = '{ corrupt json payload';
    sharedStorage.setItem(storageKey, corruptContent);

    const adapter = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });

    const validAction: PersistedVehicleAction = {
      id: 'act_valid',
      vehicleId: 'veh_001',
      statusId: 'status_price_reduction',
      note: 'Should not write',
      createdAt: '2026-06-01T12:00:00Z',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex',
      createdByType: 'USER',
    };

    expect(() => adapter.append(validAction)).toThrow(ActionStorageError);

    // Assert ZERO writes: the storage value is completely unchanged!
    expect(sharedStorage.getItem(storageKey)).toBe(corruptContent);
  });

  it('throws ActionStorageError on full-shaped record with invalid createdAt timestamp', () => {
    const fullShapedWithInvalidDate = {
      id: 'act_invalid_date_1',
      vehicleId: 'veh_001',
      statusId: 'status_price_reduction',
      note: 'Proper note',
      createdAt: 'not-a-valid-timestamp-value',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };
    sharedStorage.setItem(storageKey, JSON.stringify([fullShapedWithInvalidDate]));

    const adapter = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });

    expect(() => adapter.getAll()).toThrow(ActionStorageError);
  });

  it('performs zero writes and preserves original bytes when appending after reading a record with invalid createdAt', () => {
    const fullShapedWithInvalidDate = {
      id: 'act_invalid_date_2',
      vehicleId: 'veh_001',
      statusId: 'status_price_reduction',
      note: 'Proper note',
      createdAt: 'invalid-date-2026-99-99',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };
    const rawOriginalBytes = JSON.stringify([fullShapedWithInvalidDate]);
    sharedStorage.setItem(storageKey, rawOriginalBytes);

    const adapter = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });

    const validNewAction: PersistedVehicleAction = {
      id: 'act_valid_append',
      vehicleId: 'veh_001',
      statusId: 'status_wholesale_auction',
      note: 'Should not be written',
      createdAt: '2026-06-01T12:00:00Z',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };

    expect(() => adapter.append(validNewAction)).toThrow(ActionStorageError);

    // Verify zero writes: raw original bytes in storage are preserved exactly
    expect(sharedStorage.getItem(storageKey)).toBe(rawOriginalBytes);
  });

  it('surfaces throwing localStorage getter as ActionStorageError through protected resolver without raw platform exception', () => {
    const throwingScope = {
      get localStorage(): StorageLike {
        throw new Error('SecurityError: The operation is insecure');
      },
    };

    expect(() => resolveDefaultBrowserStorage(throwingScope)).toThrow(ActionStorageError);

    try {
      resolveDefaultBrowserStorage(throwingScope);
      expect.unreachable('Should have thrown ActionStorageError');
    } catch (err) {
      expect(err).toBeInstanceOf(ActionStorageError);
      expect((err as ActionStorageError).message).toContain('Failed to access browser storage');
    }
  });

  it('rejects non-existent calendar date 2026-02-30T12:00:00Z with ActionStorageError and preserves exact bytes on append', () => {
    const invalidCalendarRecord = {
      id: 'act_feb_30',
      vehicleId: 'veh_001',
      statusId: 'status_price_reduction',
      note: 'Feb 30 does not exist',
      createdAt: '2026-02-30T12:00:00Z',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };
    const exactBytes = JSON.stringify([invalidCalendarRecord]);
    sharedStorage.setItem(storageKey, exactBytes);

    const adapter = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });

    expect(() => adapter.getAll()).toThrow(ActionStorageError);

    const attemptAction: PersistedVehicleAction = {
      id: 'act_attempt',
      vehicleId: 'veh_001',
      statusId: 'status_wholesale_auction',
      note: 'Should not write',
      createdAt: '2026-06-01T12:00:00Z',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };

    expect(() => adapter.append(attemptAction)).toThrow(ActionStorageError);
    expect(sharedStorage.getItem(storageKey)).toBe(exactBytes);
  });

  it('rejects non-ISO date 06/01/2026 with ActionStorageError and preserves exact bytes on append', () => {
    const nonIsoRecord = {
      id: 'act_non_iso',
      vehicleId: 'veh_001',
      statusId: 'status_price_reduction',
      note: 'Slash format is invalid',
      createdAt: '06/01/2026',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };
    const exactBytes = JSON.stringify([nonIsoRecord]);
    sharedStorage.setItem(storageKey, exactBytes);

    const adapter = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });

    expect(() => adapter.getAll()).toThrow(ActionStorageError);

    const attemptAction: PersistedVehicleAction = {
      id: 'act_attempt_2',
      vehicleId: 'veh_001',
      statusId: 'status_wholesale_auction',
      note: 'Should not write',
      createdAt: '2026-06-01T12:00:00Z',
      createdByActorId: 'actor_1',
      createdByDisplayName: 'Alex Manager',
      createdByType: 'USER',
    };

    expect(() => adapter.append(attemptAction)).toThrow(ActionStorageError);
    expect(sharedStorage.getItem(storageKey)).toBe(exactBytes);
  });

  it('accepts valid UTC ISO instants with either seconds Z or millisecond Z', () => {
    const validRecords: PersistedVehicleAction[] = [
      {
        id: 'act_sec',
        vehicleId: 'veh_001',
        statusId: 'status_price_reduction',
        note: 'Seconds Z',
        createdAt: '2026-06-01T10:00:00Z',
        createdByActorId: 'actor_1',
        createdByDisplayName: 'Alex Manager',
        createdByType: 'USER',
      },
      {
        id: 'act_ms',
        vehicleId: 'veh_001',
        statusId: 'status_wholesale_auction',
        note: 'Milliseconds Z',
        createdAt: '2026-06-01T10:00:00.123Z',
        createdByActorId: 'actor_1',
        createdByDisplayName: 'Alex Manager',
        createdByType: 'USER',
      },
    ];
    sharedStorage.setItem(storageKey, JSON.stringify(validRecords));

    const adapter = new BrowserActionStorageAdapter({
      storage: sharedStorage,
      storageKey,
      initialSeed: [],
    });

    const loaded = adapter.getAll();
    expect(loaded).toHaveLength(2);
    expect(loaded[0].id).toBe('act_sec');
    expect(loaded[1].id).toBe('act_ms');
  });
});
