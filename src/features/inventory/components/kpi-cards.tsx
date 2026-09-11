import type { InventorySummary } from '../../../api/types';

export interface KpiCardsProps {
  summary?: InventorySummary;
}

function formatValue(value: number | undefined): string {
  return value === undefined ? '—' : String(value);
}

/**
 * System Design 6.2: primary KPI cards are Total Inventory, Aging Vehicles,
 * and Aging With Action, sourced from GET /inventory/summary.
 */
export function KpiCards({ summary }: KpiCardsProps) {
  return (
    <section className="kpi-section" aria-label="Inventory summary">
      <div className="kpi-card">
        <span className="kpi-card__label">Total Inventory</span>
        <span className="kpi-card__value" data-testid="kpi-total-inventory">
          {formatValue(summary?.totalInventory)}
        </span>
      </div>
      <div className="kpi-card">
        <span className="kpi-card__label">Aging Vehicles</span>
        <span className="kpi-card__value" data-testid="kpi-aging-vehicles">
          {formatValue(summary?.agingVehicles)}
        </span>
      </div>
      <div className="kpi-card">
        <span className="kpi-card__label">Aging With Action</span>
        <span className="kpi-card__value" data-testid="kpi-aging-with-action">
          {formatValue(summary?.agingWithAction)}
        </span>
      </div>
    </section>
  );
}
