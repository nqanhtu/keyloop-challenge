import { useState } from 'react';
import type { VehicleSortOption } from '../../api/types';
import { VehicleDetail } from '../actions/vehicle-detail';
import { AgingIndicator } from './components/aging-indicator';
import { ActiveFilterChips, buildFilterChips, type FilterChip } from './components/filter-chips';
import { FilterSheet, InlineFilterBar } from './components/filter-panel';
import { KpiCards } from './components/kpi-cards';
import { Pagination } from './components/pagination';
import { VehicleCards } from './components/vehicle-cards';
import { VehicleTable } from './components/vehicle-table';
import { useActionStatuses, useInventoryFilterOptions, useInventorySummary, useVehicleList } from './queries';
import {
  DEFAULT_INVENTORY_SORT,
  INVENTORY_PAGE_SIZE,
  INVENTORY_SORT_OPTIONS,
  applyFilterChange,
  applyPageChange,
  applySortChange,
  clearAllFilters,
  closeVehicleDetail,
  hasActiveFilters,
  openVehicleDetail,
  type InventorySearch,
} from './search';
import { useViewportTier } from './use-viewport-tier';
import './inventory-dashboard.css';

export interface InventoryDashboardProps {
  search: InventorySearch;
  onApplySearch: (next: InventorySearch) => void;
}

/**
 * System Design 6.2: the dashboard is the KPI header plus the discoverable
 * inventory list. Filter, sort, and page state arrive from the router URL;
 * every server-derived value comes from TanStack Query.
 */
export function InventoryDashboard({ search, onApplySearch }: InventoryDashboardProps) {
  const tier = useViewportTier();
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);

  const summaryQuery = useInventorySummary();
  const listQuery = useVehicleList(search);
  const filterOptions = useInventoryFilterOptions(search.make);
  const statusesQuery = useActionStatuses();

  const page = search.page ?? 1;
  const sort = search.sort ?? DEFAULT_INVENTORY_SORT;
  const vehicles = listQuery.data?.data ?? [];
  const total = listQuery.data?.meta.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / INVENTORY_PAGE_SIZE));
  const statuses = statusesQuery.data ?? [];

  /** System Design 6.5: selection is URL state, so discovery values survive. */
  const selectVehicle = (vehicleId: string) => onApplySearch(openVehicleDetail(search, vehicleId));

  const filterControlsProps = {
    idPrefix: 'inventory-filter',
    search,
    makes: filterOptions.makes,
    models: filterOptions.models,
    statuses,
    onFilterChange: (patch: Partial<InventorySearch>) =>
      onApplySearch(applyFilterChange(search, patch)),
  };

  const chips = buildFilterChips(search, statuses);

  return (
    <div className="inventory-dashboard">
      <header className="inventory-dashboard__header">
        <h1>Keyloop Inventory Command Center</h1>
        <p className="inventory-dashboard__subtitle">
          Discover aging inventory and the actions already taken on it.
        </p>
      </header>

      <KpiCards summary={summaryQuery.data} />

      <section className="inventory-discovery" aria-label="Inventory discovery">
        <div className="inventory-toolbar">
          <div className="toolbar-field">
            <label htmlFor="inventory-sort">Sort</label>
            <select
              id="inventory-sort"
              value={sort}
              onChange={(event) =>
                onApplySearch(applySortChange(search, event.target.value as VehicleSortOption))
              }
            >
              {INVENTORY_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="toolbar-field toolbar-field--toggle">
            <input
              id="inventory-aging-only"
              type="checkbox"
              checked={Boolean(search.agingOnly)}
              onChange={(event) =>
                onApplySearch(
                  applyFilterChange(search, {
                    agingOnly: event.target.checked ? true : undefined,
                  }),
                )
              }
            />
            <label htmlFor="inventory-aging-only">Aging only</label>
          </div>

          {tier !== 'desktop' && (
            <button
              type="button"
              className="button"
              aria-expanded={isFilterSheetOpen}
              onClick={() => setFilterSheetOpen(true)}
            >
              Filters
            </button>
          )}
        </div>

        {tier === 'desktop' && <InlineFilterBar {...filterControlsProps} />}

        <ActiveFilterChips
          chips={chips}
          onRemove={(chip: FilterChip) => onApplySearch(applyFilterChange(search, chip.clear))}
          onClearAll={() => onApplySearch(clearAllFilters(search))}
        />
      </section>

      {isFilterSheetOpen && (
        <FilterSheet {...filterControlsProps} onClose={() => setFilterSheetOpen(false)} />
      )}

      <section
        className="inventory-results"
        aria-label="Inventory results"
        aria-busy={listQuery.isFetching}
      >
        {listQuery.isSuccess && vehicles.length === 0 && (
          <p className="inventory-results__empty" role="status">
            {hasActiveFilters(search)
              ? 'No vehicles match the current filters.'
              : 'No vehicles in inventory.'}
          </p>
        )}

        {listQuery.isSuccess && vehicles.length > 0 && tier === 'mobile' && (
          <VehicleCards vehicles={vehicles} onSelectVehicle={selectVehicle} />
        )}

        {listQuery.isSuccess && vehicles.length > 0 && tier !== 'mobile' && (
          <VehicleTable
            vehicles={vehicles}
            rowCount={total}
            page={page}
            pageSize={INVENTORY_PAGE_SIZE}
            density={tier === 'tablet' ? 'compact' : 'full'}
            onSelectVehicle={selectVehicle}
          />
        )}

        {listQuery.isSuccess && (
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            onPageChange={(nextPage) => onApplySearch(applyPageChange(search, nextPage))}
          />
        )}
      </section>

      <div className="inventory-dashboard__aging-legend">
        <AgingIndicator isAging />
        <span>Aging inventory is 91 or more days in stock.</span>
      </div>

      {search.vehicleId && (
        <VehicleDetail
          vehicleId={search.vehicleId}
          tier={tier}
          onClose={() => onApplySearch(closeVehicleDetail(search))}
        />
      )}
    </div>
  );
}
