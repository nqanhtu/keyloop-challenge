import { useEffect, useState } from 'react';
import type { VehicleSortOption } from '../../api/types';
import { Button, VisuallyHidden } from '../../app/ui';
import { VehicleDetail } from '../actions/vehicle-detail';
import { clientErrorMessage } from '../errors/business-errors';
import { useAppEnvironment } from '../observability/environment';
import { AgingIndicator } from './components/aging-indicator';
import { ActiveFilterChips, buildFilterChips, type FilterChip } from './components/filter-chips';
import { FilterSheet, InlineFilterBar } from './components/filter-panel';
import { FreshnessNotice } from './components/freshness-notice';
import { KpiCards } from './components/kpi-cards';
import { InventoryListSkeleton, KpiCardsSkeleton } from './components/loading-skeleton';
import { Pagination } from './components/pagination';
import { RegionalError } from './components/regional-error';
import { VehicleCards } from './components/vehicle-cards';
import { VehicleTable } from './components/vehicle-table';
import { computeFreshness } from './freshness';
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
  const { now } = useAppEnvironment();
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);
  /**
   * RP-1: the sheet's background is inert while it is open, so the trigger is
   * captured at click time and handed to the sheet for focus return.
   */
  const [filterSheetOpener, setFilterSheetOpener] = useState<HTMLElement | null>(null);
  /**
   * System Design 6.10: remember which control opened the detail so focus can
   * return to it. The list re-renders while the detail is open, so the stable
   * accessible name is captured in the click handler rather than the DOM node
   * (never read from a ref during render). It is keyed by vehicle so a non-click
   * open path (direct URL, reload, browser back/forward) cannot restore focus to
   * a different vehicle's trigger.
   */
  const [detailOpener, setDetailOpener] = useState<{
    vehicleId: string;
    label: string | null;
  } | null>(null);

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

  /**
   * System Design 8.5: freshness comes from server-provided sync metadata and a
   * controllable current time; the warning never replaces the inventory.
   */
  const freshness = computeFreshness({
    lastSuccessfulSyncAt:
      listQuery.data?.meta.lastSuccessfulSyncAt ?? summaryQuery.data?.lastSuccessfulSyncAt,
    now: now(),
  });

  /** System Design 6.5: selection is URL state, so discovery values survive. */
  const selectVehicle = (vehicleId: string, trigger: HTMLElement | null) => {
    setDetailOpener({ vehicleId, label: trigger?.getAttribute('aria-label') ?? null });
    onApplySearch(openVehicleDetail(search, vehicleId));
  };

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

  /**
   * RP-1 (U05 F1/F5): while a modal surface is open the rest of the dashboard
   * is inert, so background controls are neither focusable nor exposed to
   * assistive technology. Each modal also traps Tab/Shift+Tab inside itself.
   */
  const modalOpen = isFilterSheetOpen || Boolean(search.vehicleId);

  /**
   * R-01 (U05 F1 residual; UI §17.8, §18, §13.4): `inert` removes focus and
   * pointer access to the page behind a modal, but it does not stop the
   * document from scrolling — at 1280x800 both wheel scrolling and a
   * programmatic `window.scrollTo` moved the page underneath an open detail
   * (scrollY 0 -> 410). While any modal surface is open, pin <body> at the
   * current offset so the background cannot scroll, then restore the exact
   * prior inline state and offset on close.
   *
   * Pinning beats `overflow: hidden` here: an overflow-hidden root is still a
   * scroll container, so it blocks the wheel but JavaScript can still scroll
   * it. The modal surfaces themselves are `position: fixed` with their own
   * `overflow-y: auto`, so their internal scrolling is unaffected.
   */
  useEffect(() => {
    if (!modalOpen) {
      return;
    }
    const { body } = document;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
    };
    const scrollY = window.scrollY;
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';

    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      // Pinning collapsed the document scroll, so put the page back where it was.
      if (scrollY !== 0) {
        window.scrollTo(0, scrollY);
      }
    };
  }, [modalOpen]);

  return (
    /* RP-7 (U05 F4): the /inventory route renders a single main landmark. */
    <main className="inventory-dashboard">
      <div className="inventory-dashboard__page" inert={modalOpen ? true : undefined}>
        <header className="inventory-dashboard__header">
          <div className="inventory-dashboard__identity">
            {/* System Design 6.10: focus fallback when the detail was opened
             * without a click, so closing it never drops focus on <body>. */}
            <h1 tabIndex={-1} data-focus-fallback="page-heading">
              Keyloop Inventory Command Center
            </h1>
            <p className="inventory-dashboard__subtitle">
              Discover aging inventory and the actions already taken on it.
            </p>
          </div>
          <FreshnessNotice freshness={freshness} isLoading={summaryQuery.isPending} />
        </header>

        {summaryQuery.isPending ? (
          <KpiCardsSkeleton />
        ) : summaryQuery.isError ? (
          <section className="kpi-section" aria-label="Inventory summary">
            <RegionalError
              region="inventory summary"
              message={clientErrorMessage(
                summaryQuery.error,
                'Unable to load the inventory summary.',
              )}
              onRetry={() => void summaryQuery.refetch()}
            />
          </section>
        ) : (
          <KpiCards summary={summaryQuery.data} />
        )}

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
              <Button
                aria-expanded={isFilterSheetOpen}
                onClick={(event) => {
                  setFilterSheetOpener(event.currentTarget);
                  setFilterSheetOpen(true);
                }}
              >
                Filters
              </Button>
            )}
          </div>

          {tier === 'desktop' && <InlineFilterBar {...filterControlsProps} />}

          <ActiveFilterChips
            chips={chips}
            onRemove={(chip: FilterChip) => onApplySearch(applyFilterChange(search, chip.clear))}
            onClearAll={() => onApplySearch(clearAllFilters(search))}
          />
        </section>

        <section
          className="inventory-results"
          aria-label="Inventory results"
          aria-busy={listQuery.isFetching}
          tabIndex={-1}
          data-focus-fallback="inventory-results"
        >
          <div className="inventory-results__header">
            <h2 className="inventory-results__title">Inventory</h2>
            {listQuery.isSuccess && (
              <p className="inventory-results__count" data-testid="inventory-results-count">
                <VisuallyHidden>Inventory count: </VisuallyHidden>
                {vehicles.length} of {total} vehicles
              </p>
            )}
          </div>

          {listQuery.isPending && <InventoryListSkeleton />}

          {listQuery.isError && (
            <RegionalError
              region="inventory results"
              message={clientErrorMessage(listQuery.error, 'Unable to load inventory.')}
              onRetry={() => void listQuery.refetch()}
            />
          )}

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
      </div>

      {/* Modal surfaces stay interactive siblings of the inert page subtree. */}
      {isFilterSheetOpen && (
        <FilterSheet
          {...filterControlsProps}
          returnFocusTo={filterSheetOpener}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}

      {search.vehicleId && (
        <VehicleDetail
          vehicleId={search.vehicleId}
          tier={tier}
          focusReturnLabel={
            detailOpener?.vehicleId === search.vehicleId ? detailOpener.label : null
          }
          onClose={() => onApplySearch(closeVehicleDetail(search))}
        />
      )}
    </main>
  );
}
