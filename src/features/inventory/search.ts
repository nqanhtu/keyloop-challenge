import type { VehicleListQuery, VehicleSortOption } from '../../api/types';

/**
 * System Design 6.8: approximately 50 records are rendered per page.
 * Page size is a fixed presentation constant; it is not part of the URL state
 * because the design only makes filters, sort, and page URL-owned.
 */
export const INVENTORY_PAGE_SIZE = 50;

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

/** Clear all removes every filter and returns to the first page, keeping sort. */
export function clearAllFilters(search: InventorySearch): InventorySearch {
  return pruneInventorySearch({ sort: search.sort });
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

/** Builds the server query. Every server-side key is sent explicitly. */
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
    pageSize: INVENTORY_PAGE_SIZE,
  };
}
