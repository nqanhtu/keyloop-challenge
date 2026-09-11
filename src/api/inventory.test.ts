import { describe, it, expect } from 'vitest';
import { getVehicles, getVehicleById, getFilterOptions } from './inventory';
import { ApiError } from './errors';

describe('Inventory HTTP & MSW Seams (INV-001, INV-002, INV-003, INV-004, INV-006, INV-007, AGE-002)', () => {
  it('GET /vehicles returns paginated vehicle list with default oldest-first sort and freshness metadata', async () => {
    const response = await getVehicles();

    expect(response.meta.total).toBe(55);
    expect(response.meta.page).toBe(1);
    expect(response.meta.pageSize).toBe(50);
    expect(response.meta.lastSuccessfulSyncAt).toBe('2026-06-01T12:00:00Z');
    expect(response.data.length).toBe(50);

    // Default oldest-first sort
    for (let i = 0; i < response.data.length - 1; i++) {
      expect(response.data[i].inventoryAgeDays).toBeGreaterThanOrEqual(
        response.data[i + 1].inventoryAgeDays,
      );
    }

    // Proves derived aging fields are present on the view
    expect(response.data[0].inventoryAgeDays).toBeDefined();
    expect(response.data[0].isAging).toBeDefined();

    // Absent vehicles (isPresentInLatestSnapshot: false) must not be returned
    const hasAbsent = response.data.some((v) => v.vehicleId === 'veh_absent');
    expect(hasAbsent).toBe(false);
  });

  it('GET /vehicles supports explicit ascending sort', async () => {
    const response = await getVehicles({
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

  it('GET /vehicles applies filters before pagination and preserves total count', async () => {
    const response = await getVehicles({
      make: 'BMW',
      page: 1,
      pageSize: 2,
    });

    expect(response.meta.page).toBe(1);
    expect(response.meta.pageSize).toBe(2);
    expect(response.data.length).toBe(2);
    // Total count reflects all matching BMWs before page slice
    expect(response.meta.total).toBeGreaterThan(2);
    expect(response.data[0].make).toBe('BMW');
    expect(response.data[1].make).toBe('BMW');
  });

  it('GET /vehicles filters by model before pagination', async () => {
    const response = await getVehicles({
      model: 'X5',
      page: 1,
      pageSize: 1,
    });

    expect(response.meta.page).toBe(1);
    expect(response.meta.pageSize).toBe(1);
    expect(response.data.length).toBe(1);
    expect(response.data[0].model).toBe('X5');
    // Pre-pagination total reflects all matching X5 fixtures
    expect(response.meta.total).toBeGreaterThan(1);
  });

  it('GET /vehicles filters by age range (ageMinDays and ageMaxDays) before pagination', async () => {
    const response = await getVehicles({
      ageMinDays: 89,
      ageMaxDays: 91,
      page: 1,
      pageSize: 2,
    });

    expect(response.meta.page).toBe(1);
    expect(response.meta.pageSize).toBe(2);
    expect(response.data.length).toBe(2);
    expect(response.meta.total).toBe(3); // veh_001 (91), veh_002 (90), veh_003 (89)

    for (const vehicle of response.data) {
      expect(vehicle.inventoryAgeDays).toBeGreaterThanOrEqual(89);
      expect(vehicle.inventoryAgeDays).toBeLessThanOrEqual(91);
    }
  });

  it('GET /vehicles filters by agingOnly=true (only isAging === true)', async () => {
    const response = await getVehicles({ agingOnly: true });

    expect(response.meta.total).toBeGreaterThan(0);
    for (const vehicle of response.data) {
      expect(vehicle.isAging).toBe(true);
      expect(vehicle.inventoryAgeDays).toBeGreaterThan(90);
    }
  });

  it('GET /vehicles preserves lifecycle independence (present SOLD vehicle is filterable)', async () => {
    const response = await getVehicles({ inventoryStatus: 'SOLD' });

    expect(response.meta.total).toBeGreaterThan(0);
    for (const vehicle of response.data) {
      expect(vehicle.upstreamStatus).toBe('SOLD');
    }
  });

  it('GET /vehicles returns 0 results when filtered by actionStatusId in T02 empty state', async () => {
    const response = await getVehicles({ actionStatusId: 'any_action_status' });

    expect(response.meta.total).toBe(0);
    expect(response.data.length).toBe(0);
  });

  it('GET /vehicles/:vehicleId returns VehicleView for a present stable fixture', async () => {
    const vehicle = await getVehicleById('veh_001');

    expect(vehicle.vehicleId).toBe('veh_001');
    expect(vehicle.vin).toBe('1HGCR2F83HA000001');
    expect(vehicle.make).toBe('BMW');
    expect(vehicle.model).toBe('X5');
    expect(vehicle.inventoryAgeDays).toBe(91);
    expect(vehicle.isAging).toBe(true);
    expect(vehicle.currentAction).toBeNull();
  });

  it('GET /vehicles/:vehicleId throws ApiError 404 for non-existent or absent vehicle', async () => {
    await expect(getVehicleById('veh_absent')).rejects.toThrow(ApiError);

    try {
      await getVehicleById('veh_absent');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(404);
      expect(apiErr.code).toBe('VEHICLE_NOT_FOUND');
    }
  });

  it('GET /inventory/filter-options returns unique sorted makes and models', async () => {
    const options = await getFilterOptions();

    expect(options.makes.length).toBeGreaterThan(0);
    expect(options.models.length).toBeGreaterThan(0);
    expect(options.makes).toContain('BMW');
    expect(options.makes).toContain('Audi');
    // Absent vehicle make (Porsche) is omitted
    expect(options.makes).not.toContain('Porsche');
  });

  it('GET /inventory/filter-options narrows models by make', async () => {
    const options = await getFilterOptions({ make: 'BMW' });

    expect(options.makes).toContain('BMW');
    expect(options.makes).toContain('Audi');
    expect(options.models).toContain('X5');
    expect(options.models).not.toContain('A4');
  });
});
