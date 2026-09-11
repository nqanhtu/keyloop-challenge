import { useEffect } from 'react';
import type { VehicleActionSummary, VehicleView } from '../../api/types';
import { AgingIndicator } from '../inventory/components/aging-indicator';
import type { ViewportTier } from '../inventory/use-viewport-tier';
import { ActionHistory } from './action-history';
import { CreateActionForm } from './action-form';
import { useVehicleActions, useVehicleDetail } from './queries';
import './vehicle-detail.css';

/** System Design 6.5: one responsive master-detail surface, three modalities. */
export const DETAIL_VARIANT_BY_TIER: Record<ViewportTier, 'drawer' | 'sheet' | 'fullscreen'> = {
  desktop: 'drawer',
  tablet: 'sheet',
  mobile: 'fullscreen',
};

export interface VehicleDetailProps {
  vehicleId: string;
  tier: ViewportTier;
  onClose: () => void;
}

/**
 * System Design 6.5: vehicle summary, current action, create-action form, and
 * full action history in that order.
 */
export function VehicleDetail({ vehicleId, tier, onClose }: VehicleDetailProps) {
  const detailQuery = useVehicleDetail(vehicleId);
  const historyQuery = useVehicleActions(vehicleId);
  const variant = DETAIL_VARIANT_BY_TIER[tier];
  const vehicle = detailQuery.data;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={`vehicle-detail vehicle-detail--${variant}`}
      role="dialog"
      aria-modal="true"
      aria-label={vehicle ? `Vehicle detail: ${vehicle.make} ${vehicle.model}` : 'Vehicle detail'}
      data-variant={variant}
    >
      <header className="vehicle-detail__header">
        <h2>Vehicle detail</h2>
        <button
          type="button"
          className="button"
          onClick={onClose}
          aria-label="Close vehicle detail"
        >
          Close
        </button>
      </header>

      {vehicle ? (
        <VehicleSummary vehicle={vehicle} />
      ) : (
        <p className="vehicle-detail__loading" role="status">
          Loading vehicle detail…
        </p>
      )}

      <CurrentAction action={vehicle?.currentAction ?? null} />

      <section className="vehicle-detail__section" aria-label="Record an action">
        <h3>Record an action</h3>
        <CreateActionForm vehicleId={vehicleId} />
      </section>

      <ActionHistory actions={historyQuery.data ?? []} />
    </div>
  );
}

function VehicleSummary({ vehicle }: { vehicle: VehicleView }) {
  return (
    <section className="vehicle-detail__section" aria-label="Vehicle summary">
      <h3>Vehicle summary</h3>
      <dl className="vehicle-detail__facts">
        <div className="vehicle-detail__fact">
          <dt>Vehicle</dt>
          <dd>
            {vehicle.make} {vehicle.model}
          </dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>VIN</dt>
          <dd>{vehicle.vin}</dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>Stocked</dt>
          <dd>{vehicle.stockedAt.slice(0, 10)}</dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>Inventory age</dt>
          <dd>{vehicle.inventoryAgeDays} days</dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>Aging</dt>
          <dd>
            <AgingIndicator isAging={vehicle.isAging} />
          </dd>
        </div>
        <div className="vehicle-detail__fact">
          <dt>Inventory status</dt>
          <dd>{vehicle.upstreamStatus}</dd>
        </div>
      </dl>
    </section>
  );
}

function CurrentAction({ action }: { action: VehicleActionSummary | null }) {
  return (
    <section className="vehicle-detail__section" aria-label="Current action">
      <h3>Current action</h3>
      {action === null ? (
        <p className="vehicle-detail__current-empty">No current action</p>
      ) : (
        <div className="vehicle-detail__current">
          <p className="vehicle-detail__current-status">{action.status.label}</p>
          {action.note ? <p className="vehicle-detail__current-note">{action.note}</p> : null}
        </div>
      )}
    </section>
  );
}
