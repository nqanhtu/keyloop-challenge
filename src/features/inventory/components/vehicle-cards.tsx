import type { VehicleView } from '../../../api/types';
import { Button } from '../../../app/ui';
import { AgingIndicator } from './aging-indicator';

export interface VehicleCardsProps {
  vehicles: VehicleView[];
  onSelectVehicle: (vehicleId: string, trigger: HTMLElement | null) => void;
}

/**
 * System Design 6.3: the mobile presentation prioritizes make/model, inventory
 * age, aging status, and current action (System Design 6.5 selection opens the
 * full-screen detail surface).
 */
export function VehicleCards({ vehicles, onSelectVehicle }: VehicleCardsProps) {
  return (
    <ul className="vehicle-cards" aria-label="Inventory vehicles">
      {vehicles.map((vehicle) => (
        <li key={vehicle.vehicleId} className="vehicle-card">
          <article className="vehicle-card__body">
            <header className="vehicle-card__header">
              <p className="vehicle-card__title">
                {vehicle.make} {vehicle.model}
              </p>
              <span className="vehicle-card__vin">{vehicle.vin}</span>
            </header>
            <dl className="vehicle-card__details">
              <div className="vehicle-card__detail">
                <dt>Age</dt>
                <dd>{vehicle.inventoryAgeDays} days</dd>
              </div>
              <div className="vehicle-card__detail">
                {/*
                 * RP-8 (U04 F-06): label the value for assistive tech without
                 * printing "AGING" twice beside the indicator. The visible
                 * statement is the dot plus the readable AGING text.
                 */}
                <dt className="ui-sr-only">Aging</dt>
                <dd>
                  <AgingIndicator isAging={vehicle.isAging} />
                </dd>
              </div>
              <div className="vehicle-card__detail">
                <dt>Status</dt>
                <dd>{vehicle.upstreamStatus}</dd>
              </div>
              <div className="vehicle-card__detail">
                <dt>Current action</dt>
                <dd>
                  {/*
                   * RP-9 (U04 F-07): a neutral, non-colour-only pill so a card
                   * with no current action is scannable at a glance.
                   */}
                  <span
                    className={
                      vehicle.currentAction
                        ? 'ui-status-pill'
                        : 'ui-status-pill ui-status-pill--empty'
                    }
                  >
                    {vehicle.currentAction
                      ? vehicle.currentAction.status.label
                      : 'No current action'}
                  </span>
                </dd>
              </div>
            </dl>
            <Button
              className="vehicle-card__select"
              onClick={(event) => onSelectVehicle(vehicle.vehicleId, event.currentTarget)}
              data-vehicle-detail-trigger={vehicle.vehicleId}
              aria-label={`View details for ${vehicle.make} ${vehicle.model} (${vehicle.vin})`}
            >
              Details
            </Button>
          </article>
        </li>
      ))}
    </ul>
  );
}
