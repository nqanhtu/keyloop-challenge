import { describe, it, expect } from 'vitest';
import { InventoryService } from './inventory-service';
import { mockSyncMetadata } from './fixtures';
import { EmptyCurrentActionReader } from './action-reader';
import { FixtureVehicleProjectionReader } from './projection-reader';

describe('Inventory Service Seam (ARCH-DOM-001, INV-004, INV-007, AGE-002)', () => {
  const service = new InventoryService({
    projectionReader: new FixtureVehicleProjectionReader(),
    currentActionReader: new EmptyCurrentActionReader(),
    timeZone: 'UTC',
    referenceInstant: '2026-06-01T12:00:00Z',
  });

  it('retrieves a present vehicle by stable vehicleId with derived aging properties', async () => {
    // veh_001 is stockedAt 2026-03-02T12:00:00Z (91 days before 2026-06-01T12:00:00Z in UTC)
    const vehicle = await service.getVehicleById('veh_001');

    expect(vehicle).not.toBeNull();
    expect(vehicle?.vehicleId).toBe('veh_001');
    expect(vehicle?.vin).toBeDefined();
    expect(vehicle?.inventoryAgeDays).toBe(91);
    expect(vehicle?.isAging).toBe(true);
    // In T02 transitional state, currentAction is null
    expect(vehicle?.currentAction).toBeNull();
  });

  it('returns null when vehicle does not exist', async () => {
    const vehicle = await service.getVehicleById('non_existent_id');
    expect(vehicle).toBeNull();
  });

  it('returns null when vehicle is not present in the latest snapshot', async () => {
    // veh_absent has isPresentInLatestSnapshot: false
    const vehicle = await service.getVehicleById('veh_absent');
    expect(vehicle).toBeNull();
  });

  it('keeps upstreamStatus independent from presence (present SOLD vehicle is retrievable)', async () => {
    // veh_sold is present in latest snapshot but has upstreamStatus: 'SOLD'
    const vehicle = await service.getVehicleById('veh_sold');
    expect(vehicle).not.toBeNull();
    expect(vehicle?.vehicleId).toBe('veh_sold');
    expect(vehicle?.upstreamStatus).toBe('SOLD');
  });

  describe('queryVehicles (INV-001, INV-002, INV-003)', () => {
    it('excludes absent records and returns default oldest-first pagination with metadata', async () => {
      const response = await service.queryVehicles();

      // Only present vehicles are included
      expect(response.meta.total).toBe(55); // 55 present vehicles in fixtures
      expect(response.meta.page).toBe(1);
      expect(response.meta.pageSize).toBe(50);
      expect(response.meta.lastSuccessfulSyncAt).toBe(mockSyncMetadata.lastSuccessfulSyncAt);
      expect(response.data.length).toBe(50);

      // Default sort is inventoryAgeDays descending (oldest first)
      for (let i = 0; i < response.data.length - 1; i++) {
        expect(response.data[i].inventoryAgeDays).toBeGreaterThanOrEqual(
          response.data[i + 1].inventoryAgeDays,
        );
      }

      // Absent vehicle veh_absent must not be included anywhere
      const absentPresent = response.data.some((v) => v.vehicleId === 'veh_absent');
      expect(absentPresent).toBe(false);
    });

    it('paginates to page 2 returning remaining records', async () => {
      const response = await service.queryVehicles({ page: 2, pageSize: 50 });

      expect(response.meta.page).toBe(2);
      expect(response.meta.pageSize).toBe(50);
      expect(response.meta.total).toBe(55);
      expect(response.data.length).toBe(5);
    });

    it('sorts by inventoryAgeDays ascending when requested', async () => {
      const response = await service.queryVehicles({
        sort: 'inventoryAgeDays:asc',
        pageSize: 10,
      });

      expect(response.data.length).toBe(10);
      for (let i = 0; i < response.data.length - 1; i++) {
        expect(response.data[i].inventoryAgeDays).toBeLessThanOrEqual(
          response.data[i + 1].inventoryAgeDays,
        );
      }
    });

    it('filters by make and model', async () => {
      const response = await service.queryVehicles({ make: 'BMW', model: 'X5' });

      expect(response.meta.total).toBeGreaterThan(0);
      for (const vehicle of response.data) {
        expect(vehicle.make).toBe('BMW');
        expect(vehicle.model).toBe('X5');
      }
    });

    it('filters by age range (ageMinDays and ageMaxDays)', async () => {
      const response = await service.queryVehicles({ ageMinDays: 89, ageMaxDays: 91 });

      expect(response.meta.total).toBeGreaterThan(0);
      for (const vehicle of response.data) {
        expect(vehicle.inventoryAgeDays).toBeGreaterThanOrEqual(89);
        expect(vehicle.inventoryAgeDays).toBeLessThanOrEqual(91);
      }
      // Proves 89, 90, 91 days are present in this slice
      const ages = response.data.map((v) => v.inventoryAgeDays);
      expect(ages).toContain(89);
      expect(ages).toContain(90);
      expect(ages).toContain(91);
    });

    it('filters by agingOnly=true (only isAging === true, inventoryAgeDays > 90)', async () => {
      const response = await service.queryVehicles({ agingOnly: true });

      expect(response.meta.total).toBeGreaterThan(0);
      for (const vehicle of response.data) {
        expect(vehicle.isAging).toBe(true);
        expect(vehicle.inventoryAgeDays).toBeGreaterThan(90);
      }
    });

    it('filters by inventoryStatus and includes present SOLD vehicles', async () => {
      const response = await service.queryVehicles({ inventoryStatus: 'SOLD' });

      expect(response.meta.total).toBeGreaterThan(0);
      for (const vehicle of response.data) {
        expect(vehicle.upstreamStatus).toBe('SOLD');
      }
    });

    it('filters by actionStatusId and returns 0 matches in T02 transitional empty state', async () => {
      const response = await service.queryVehicles({ actionStatusId: 'status_review' });

      expect(response.meta.total).toBe(0);
      expect(response.data.length).toBe(0);
    });

    it('calculates total count before pagination when filters are applied', async () => {
      const response = await service.queryVehicles({
        make: 'BMW',
        page: 1,
        pageSize: 2,
      });

      expect(response.meta.pageSize).toBe(2);
      expect(response.data.length).toBe(2);
      expect(response.meta.total).toBeGreaterThan(2);
    });
  });

  describe('getFilterOptions (INV-006)', () => {
    it('returns unique sorted makes and models for all present vehicles', async () => {
      const options = await service.getFilterOptions();

      expect(options.makes.length).toBeGreaterThan(0);
      expect(options.models.length).toBeGreaterThan(0);

      // Unique
      expect(new Set(options.makes).size).toBe(options.makes.length);
      expect(new Set(options.models).size).toBe(options.models.length);

      // Sorted alphabetically
      const sortedMakes = [...options.makes].sort((a, b) => a.localeCompare(b));
      expect(options.makes).toEqual(sortedMakes);

      const sortedModels = [...options.models].sort((a, b) => a.localeCompare(b));
      expect(options.models).toEqual(sortedModels);

      // Absent vehicle make/model (Porsche 911) must not be included
      expect(options.makes).not.toContain('Porsche');
      expect(options.models).not.toContain('911');
    });

    it('narrows model options when make is specified', async () => {
      const options = await service.getFilterOptions('BMW');

      // Makes still contains all available makes
      expect(options.makes).toContain('BMW');
      expect(options.makes).toContain('Audi');

      // Models only contains BMW models (sorted)
      expect(options.models).toContain('3 Series');
      expect(options.models).toContain('M4');
      expect(options.models).toContain('X5');
      expect(options.models).not.toContain('A4');
      expect(options.models).not.toContain('Q7');
    });
  });
});
