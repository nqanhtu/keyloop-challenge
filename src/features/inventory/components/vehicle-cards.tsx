import type { VehicleView } from '../../../api/types';
import { AgingIndicator } from './aging-indicator';

export interface VehicleCardsProps {
  vehicles: VehicleView[];
  onSelectVehicle: (vehicleId: string) => void;
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
          <p className="vehicle-card__title">
            {vehicle.make} {vehicle.model}
          </p>
          <dl className="vehicle-card__details">
            <div className="vehicle-card__detail">
              <dt>Age</dt>
              <dd>{vehicle.inventoryAgeDays} days</dd>
            </div>
            <div className="vehicle-card__detail">
              <dt>Aging</dt>
              <dd>
                <AgingIndicator isAging={vehicle.isAging} />
              </dd>
            </div>
            <div className="vehicle-card__detail">
              <dt>Current action</dt>
              <dd>
                {vehicle.currentAction ? vehicle.currentAction.status.label : 'No current action'}
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className="button vehicle-card__select"
            onClick={() => onSelectVehicle(vehicle.vehicleId)}
            aria-label={`View details for ${vehicle.make} ${vehicle.model} (${vehicle.vin})`}
          >
            Details
          </button>
        </li>
      ))}
    </ul>
  );
}
