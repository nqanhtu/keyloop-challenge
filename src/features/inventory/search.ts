import type { VehicleListQuery, VehicleSortOption } from '../../api/types';

/**
 * Decision 0004 / System Design 6.8 (as amended): page size is URL-owned and
 * user-selectable. The allowed values are 25, 50, and 100; the default of 50
 * is omitted from the URL and always sent to the server as the effective size.
 */
export const PAGE_SIZE_OPTIONS: ReadonlyArray<number> = [25, 50, 100];

export const DEFAULT_PAGE_SIZE = 50;

/** System Design 5.2: default ordering is `inventoryAgeDays DESC` (oldest first). */
export const DEFAULT_INVENTORY_SORT: VehicleSortOption = 'inventoryAgeDays:desc';

export const INVENTORY_SORT_OPTIONS: ReadonlyArray<{ value: VehicleSortOption; label: string }> = [
  { value: 'inventoryAgeDays:desc', label: 'Oldest inventory first' },
  { value: 'inventoryAgeDays:asc', label: 'Newest inventory first' },
];

export const INVENTORY_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'RESERVED', label: 'Reserved' },
  { value: 'SOLD', label: 'Sold' },
  { value: 'UNAVAILABLE', label: 'Unavailable' },
];

const SORT_VALUES: readonly string[] = INVENTORY_SORT_OPTIONS.map((option) => option.value);

/**
 * System Design 6.1: filters, sorting, and page are URL state.
 * Every field is optional; an absent field means "no constraint" (or the
 * documented default for sort/page).
 */
export interface InventorySearch {
  make?: string;
  model?: string;
  ageMinDays?: number;
  ageMaxDays?: number;
  inventoryStatus?: string;
  actionStatusId?: string;
  agingOnly?: boolean;
  sort?: VehicleSortOption;
  page?: number;
  /**
   * Decision 0004: the selected page size is URL state. Only the designed
   * options are accepted and the default is omitted from the URL.
   */
  pageSize?: number;
  /**
   * System Design 6.5: the detail surface is selected through the URL so the
   * discovery state around it stays shareable and survives open/close.
   */
  vehicleId?: string;
}

function readText(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function readInteger(value: unknown, minimum: number): number | undefined {
  const candidate = typeof value === 'number' ? value : Number(readText(value));
  if (!Number.isFinite(candidate) || !Number.isInteger(candidate) || candidate < minimum) {
    return undefined;
  }
  return candidate;
}

function readBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true' || value === '1' || value === 1) {
    return true;
  }
  return undefined;
}

/**
 * Decision 0004: the effective page size for every consumer. Anything that is
 * not one of the designed options — a hand-typed `37`, `abc`, `0`, `1000`, a
 * negative number, or a missing value — resolves to the documented default, so
 * the server query, the rendered page, and the page count can never disagree.
 */
export function normalizePageSize(value: unknown): number {
  const candidate = readInteger(value, 1);
  return candidate !== undefined && PAGE_SIZE_OPTIONS.includes(candidate)
    ? candidate
    : DEFAULT_PAGE_SIZE;
}

/**
 * URL state keeps only a supported, non-default page size; the default is
 * omitted so it never appears in the address bar.
 */
function readPageSize(value: unknown): number | undefined {
  const pageSize = normalizePageSize(value);
  return pageSize === DEFAULT_PAGE_SIZE ? undefined : pageSize;
}

/**
 * Normalizes raw router search input into the URL-owned discovery state.
 * Unknown or malformed values are dropped rather than propagated to the API.
 */
export function parseInventorySearch(input: Record<string, unknown>): InventorySearch {
  const rawSort = readText(input.sort);
  const sort = rawSort && SORT_VALUES.includes(rawSort) ? (rawSort as VehicleSortOption) : undefined;

  return pruneInventorySearch({
    make: readText(input.make),
    model: readText(input.model),
    ageMinDays: readInteger(input.ageMinDays, 0),
    ageMaxDays: readInteger(input.ageMaxDays, 0),
    inventoryStatus: readText(input.inventoryStatus),
    actionStatusId: readText(input.actionStatusId),
    agingOnly: readBoolean(input.agingOnly),
    sort,
    page: readInteger(input.page, 1),
    pageSize: readPageSize(input.pageSize),
    vehicleId: readText(input.vehicleId),
  });
}

/** Drops empty values so the URL only carries meaningful discovery state. */
export function pruneInventorySearch(search: InventorySearch): InventorySearch {
  const pruned: InventorySearch = {};

  if (search.make) pruned.make = search.make;
  if (search.model) pruned.model = search.model;
  if (search.ageMinDays !== undefined) pruned.ageMinDays = search.ageMinDays;
  if (search.ageMaxDays !== undefined) pruned.ageMaxDays = search.ageMaxDays;
  if (search.inventoryStatus) pruned.inventoryStatus = search.inventoryStatus;
  if (search.actionStatusId) pruned.actionStatusId = search.actionStatusId;
  if (search.agingOnly) pruned.agingOnly = true;
  if (search.sort) pruned.sort = search.sort;
  if (search.page !== undefined && search.page > 1) pruned.page = search.page;
  // Decision 0004: only a non-default page size is meaningful URL state.
  if (search.pageSize !== undefined && search.pageSize !== DEFAULT_PAGE_SIZE) {
    pruned.pageSize = search.pageSize;
  }
  if (search.vehicleId) pruned.vehicleId = search.vehicleId;

  return pruned;
}

/** True when any designed filter constrains the result set. */
export function hasActiveFilters(search: InventorySearch): boolean {
  return Boolean(
    search.make ||
      search.model ||
      search.ageMinDays !== undefined ||
      search.ageMaxDays !== undefined ||
      search.inventoryStatus ||
      search.actionStatusId ||
      search.agingOnly,
  );
}

/** Changing a filter resets pagination to page 1 (System Design 6.1). */
export function applyFilterChange(
  search: InventorySearch,
  patch: Partial<InventorySearch>,
): InventorySearch {
  return pruneInventorySearch({ ...search, ...patch, page: undefined });
}

/**
 * Sorting reorders the whole result set, so the previous page number is no
 * longer meaningful; page returns to 1 for the same reason filter changes do.
 */
export function applySortChange(
  search: InventorySearch,
  sort: VehicleSortOption,
): InventorySearch {
  return pruneInventorySearch({ ...search, sort, page: undefined });
}

export function applyPageChange(search: InventorySearch, page: number): InventorySearch {
  return pruneInventorySearch({ ...search, page });
}

/**
 * Decision 0004: changing the page size re-partitions the whole result set, so
 * the previous page number is no longer meaningful and the page returns to 1.
 */
export function applyPageSizeChange(search: InventorySearch, pageSize: number): InventorySearch {
  return pruneInventorySearch({ ...search, pageSize, page: undefined });
}

/**
 * Clear all removes every collection filter and returns to the first page,
 * keeping sort and page size. UI System Design §13.3: page size is a view
 * control rather than a filter constraint, and it must not destroy unrelated
 * vehicle-detail context, so the URL-owned `vehicleId` survives too.
 */
export function clearAllFilters(search: InventorySearch): InventorySearch {
  return pruneInventorySearch({
    sort: search.sort,
    pageSize: search.pageSize,
    vehicleId: search.vehicleId,
  });
}

/**
 * Opening the detail surface keeps every T04 discovery value untouched and only
 * adds the selected vehicle; closing it removes exactly that value.
 */
export function openVehicleDetail(search: InventorySearch, vehicleId: string): InventorySearch {
  return pruneInventorySearch({ ...search, vehicleId });
}

export function closeVehicleDetail(search: InventorySearch): InventorySearch {
  return pruneInventorySearch({ ...search, vehicleId: undefined });
}

/**
 * Builds the server query. Every server-side key is sent explicitly, and the
 * page size goes through the same normalization as URL state so the request
 * can never carry an unsupported value even if a caller passes one through.
 */
export function toVehicleListQuery(search: InventorySearch): VehicleListQuery {
  return {
    make: search.make,
    model: search.model,
    ageMinDays: search.ageMinDays,
    ageMaxDays: search.ageMaxDays,
    inventoryStatus: search.inventoryStatus,
    actionStatusId: search.actionStatusId,
    agingOnly: search.agingOnly ? true : undefined,
    sort: search.sort ?? DEFAULT_INVENTORY_SORT,
    page: search.page ?? 1,
    pageSize: normalizePageSize(search.pageSize),
  };
}
