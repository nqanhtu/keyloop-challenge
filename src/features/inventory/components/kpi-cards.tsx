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
  const agingVehicles = summary?.agingVehicles;
  const agingEmphasis = typeof agingVehicles === 'number' && agingVehicles > 0;

  return (
    <section className="kpi-section" aria-label="Inventory summary">
      <div className="kpi-card">
        <span className="kpi-card__value" data-testid="kpi-total-inventory">
          {formatValue(summary?.totalInventory)}
        </span>
        <span className="kpi-card__label">Total Inventory</span>
      </div>
      <div className={`kpi-card${agingEmphasis ? ' kpi-card--emphasis' : ''}`}>
        <span className="kpi-card__value" data-testid="kpi-aging-vehicles">
          {formatValue(summary?.agingVehicles)}
        </span>
        <span className="kpi-card__label">Aging Vehicles</span>
      </div>
      <div className="kpi-card">
        <span className="kpi-card__value" data-testid="kpi-aging-with-action">
          {formatValue(summary?.agingWithAction)}
        </span>
        <span className="kpi-card__label">Aging With Action</span>
      </div>
    </section>
  );
}
