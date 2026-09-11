import { describe, it, expect, beforeEach } from 'vitest';
import { getVehicles, getVehicleById, getInventorySummary } from './inventory';
import { createVehicleAction } from './actions';
import { createMockBackend } from '../mocks/composition';
import { server } from '../mocks/server';
import type { StorageLike } from '../mocks/actions/storage-adapter';

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

describe('Inventory Composition & Summary Seams (INV-005, Seams 7, 8)', () => {
  beforeEach(() => {
    const isolatedBackend = createMockBackend({
      storage: new MemoryStorage(),
    });
    server.use(...isolatedBackend.handlers);
  });

  it('GET /inventory/summary derives totalInventory, agingVehicles, agingWithAction, and sync timestamp', async () => {
    const summary = await getInventorySummary();

    expect(summary.totalInventory).toBe(55);
    expect(summary.agingVehicles).toBeGreaterThan(0);
    // Seed action in mockSeedActions is for veh_004 (aging)
    expect(summary.lastSuccessfulSyncAt).toBe('2026-06-01T12:00:00Z');
  });

  it('reflects newest persisted action in list, detail, actionStatusId filter, and summary counts', async () => {
    // 1. Initially veh_001 has no current action
    const initialDetail = await getVehicleById('veh_001');
    expect(initialDetail.currentAction).toBeNull();

    const initialSummary = await getInventorySummary();
    const initialAgingWithAction = initialSummary.agingWithAction;

    // 2. Create first action for aging vehicle veh_001
    const action1 = await createVehicleAction('veh_001', {
      statusId: 'status_price_reduction',
      note: 'First discount applied',
    });

    // 3. Detail reflects current action
    const detailAfterAction1 = await getVehicleById('veh_001');
    expect(detailAfterAction1.currentAction).not.toBeNull();
    expect(detailAfterAction1.currentAction?.id).toBe(action1.id);
    expect(detailAfterAction1.currentAction?.status.id).toBe('status_price_reduction');
    expect(detailAfterAction1.currentAction?.note).toBe('First discount applied');

    // 4. List query filters by actionStatusId
    const filteredList = await getVehicles({ actionStatusId: 'status_price_reduction' });
    expect(filteredList.meta.total).toBe(1);
    expect(filteredList.data[0].vehicleId).toBe('veh_001');

    // 5. Summary reflects updated agingWithAction
    const summaryAfterAction1 = await getInventorySummary();
    expect(summaryAfterAction1.agingWithAction).toBe(initialAgingWithAction + 1);

    // 6. Create second action for veh_001 (newest action becomes currentAction)
    const action2 = await createVehicleAction('veh_001', {
      statusId: 'status_wholesale_auction',
      note: 'Escalated to auction',
    });

    const detailAfterAction2 = await getVehicleById('veh_001');
    expect(detailAfterAction2.currentAction?.id).toBe(action2.id);
    expect(detailAfterAction2.currentAction?.status.id).toBe('status_wholesale_auction');
    expect(detailAfterAction2.currentAction?.note).toBe('Escalated to auction');

    // Filter by old status now returns 0, filter by new status returns 1
    const filterOld = await getVehicles({ actionStatusId: 'status_price_reduction' });
    expect(filterOld.meta.total).toBe(0);

    const filterNew = await getVehicles({ actionStatusId: 'status_wholesale_auction' });
    expect(filterNew.meta.total).toBe(1);
    expect(filterNew.data[0].vehicleId).toBe('veh_001');

    // agingWithAction remains same (1 vehicle with action)
    const summaryAfterAction2 = await getInventorySummary();
    expect(summaryAfterAction2.agingWithAction).toBe(initialAgingWithAction + 1);
  });
});
