import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  applyPageSizeChange,
  clearAllFilters,
  normalizePageSize,
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

/**
 * F-01: an unsupported value typed into the URL must never become the effective
 * collection state. Every consumer reads the sanitized InventorySearch, so the
 * request, the rendered page, and the page count always agree with the design.
 */
describe('F-01 — unsupported URL values never become the effective state', () => {
  it.each(['37', 'abc', '0', '1000', '-5', '3.5', ''])(
    'normalizes an unsupported pageSize (%s) to the default 50',
    (raw) => {
      expect(normalizePageSize(raw)).toBe(DEFAULT_PAGE_SIZE);
      // The URL state keeps nothing for an unsupported size, so the effective
      // size is the documented default at every consumer.
      expect(parseInventorySearch({ pageSize: raw })).toEqual({});
      expect(toVehicleListQuery(parseInventorySearch({ pageSize: raw })).pageSize).toBe(
        DEFAULT_PAGE_SIZE,
      );
    },
  );

  it('treats an explicit pageSize=50 as the default rather than URL state', () => {
    expect(normalizePageSize('50')).toBe(DEFAULT_PAGE_SIZE);
    expect(parseInventorySearch({ pageSize: '50' })).toEqual({});
    expect(toVehicleListQuery(parseInventorySearch({ pageSize: '50' })).pageSize).toBe(
      DEFAULT_PAGE_SIZE,
    );
  });

  it('is defensive in the query builder even when a caller passes an unsupported size', () => {
    expect(toVehicleListQuery({ pageSize: 37 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(toVehicleListQuery({ pageSize: 0 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(toVehicleListQuery({ pageSize: 1000 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(toVehicleListQuery({ pageSize: -5 }).pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(toVehicleListQuery({ pageSize: 25 }).pageSize).toBe(25);
    expect(toVehicleListQuery({ pageSize: 100 }).pageSize).toBe(100);
  });

  it('normalizes an unsupported page and sort to the designed defaults', () => {
    expect(parseInventorySearch({ page: 'abc' })).toEqual({});
    expect(toVehicleListQuery(parseInventorySearch({ page: 'abc' })).page).toBe(1);
    expect(parseInventorySearch({ sort: 'bogus' })).toEqual({});
    expect(toVehicleListQuery(parseInventorySearch({ sort: 'bogus' })).sort).toBe(
      'inventoryAgeDays:desc',
    );
  });
});
