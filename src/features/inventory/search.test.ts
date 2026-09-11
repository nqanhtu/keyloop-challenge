import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  applyPageSizeChange,
  clearAllFilters,
  parseInventorySearch,
  pruneInventorySearch,
  toVehicleListQuery,
} from './search';

/**
 * Decision 0004 — page size is URL-owned discovery/view state with the allowed
 * values 25, 50, and 100 and a default of 50.
 */
describe('Decision 0004 — URL-owned page size', () => {
  it('exposes the designed options and the documented default', () => {
    expect(PAGE_SIZE_OPTIONS).toEqual([25, 50, 100]);
    expect(DEFAULT_PAGE_SIZE).toBe(50);
  });

  it('parses the supported non-default page sizes from the URL', () => {
    expect(parseInventorySearch({ pageSize: '25' }).pageSize).toBe(25);
    expect(parseInventorySearch({ pageSize: 100 }).pageSize).toBe(100);
  });

  it('drops a page size that is not one of the designed options', () => {
    expect(parseInventorySearch({ pageSize: '30' })).toEqual({});
    expect(parseInventorySearch({ pageSize: '0' })).toEqual({});
    expect(parseInventorySearch({ pageSize: 'lots' })).toEqual({});
  });

  it('omits the default page size from the URL', () => {
    expect(parseInventorySearch({ pageSize: '50' })).toEqual({});
    expect(pruneInventorySearch({ pageSize: DEFAULT_PAGE_SIZE })).toEqual({});
    expect(pruneInventorySearch({ pageSize: 25 })).toEqual({ pageSize: 25 });
  });

  it('resets the page to 1 when the page size changes', () => {
    expect(applyPageSizeChange({ make: 'BMW', page: 3 }, 100)).toEqual({
      make: 'BMW',
      pageSize: 100,
    });
  });

  it('sends the effective page size to the server query', () => {
    expect(toVehicleListQuery({}).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(toVehicleListQuery({ pageSize: 25 }).pageSize).toBe(25);
    expect(toVehicleListQuery({ pageSize: 100 }).pageSize).toBe(100);
  });

  it('keeps the page size when clearing collection filters', () => {
    expect(clearAllFilters({ make: 'BMW', page: 2, pageSize: 100 })).toEqual({ pageSize: 100 });
  });
});
