import type { VehicleActionStatus } from '../../../api/types';
import type { InventorySearch } from '../search';
import { INVENTORY_STATUS_OPTIONS } from '../search';

export interface FilterControlsProps {
  idPrefix: string;
  search: InventorySearch;
  makes: string[];
  models: string[];
  statuses: VehicleActionStatus[];
  onFilterChange: (patch: Partial<InventorySearch>) => void;
}

function readAge(value: string): number | undefined {
  if (value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * System Design 6.4: the designed filter set is make, model, age range,
 * inventory status, action status, and aging only. Every control is labelled
 * and writes its value back to the URL-owned search state.
 */
export function FilterControls({
  idPrefix,
  search,
  makes,
  models,
  statuses,
  onFilterChange,
}: FilterControlsProps) {
  const modelOptions =
    search.model && !models.includes(search.model) ? [search.model, ...models] : models;

  return (
    <div className="filter-controls">
      <fieldset className="filter-group">
        <legend className="filter-group__legend">Vehicle</legend>
        <div className="filter-group__fields">
          <div className="filter-field">
            <label htmlFor={`${idPrefix}-make`}>Make</label>
            <select
              id={`${idPrefix}-make`}
              value={search.make ?? ''}
              onChange={(event) =>
                onFilterChange({
                  make: event.target.value === '' ? undefined : event.target.value,
                  model: undefined,
                })
              }
            >
              <option value="">All makes</option>
              {makes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor={`${idPrefix}-model`}>Model</label>
            <select
              id={`${idPrefix}-model`}
              value={search.model ?? ''}
              onChange={(event) =>
                onFilterChange({
                  model: event.target.value === '' ? undefined : event.target.value,
                })
              }
            >
              <option value="">All models</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend className="filter-group__legend">Inventory age</legend>
        <div className="filter-group__fields">
          <div className="filter-field filter-field--age">
            <label htmlFor={`${idPrefix}-age-min`}>Min age (days)</label>
            <input
              id={`${idPrefix}-age-min`}
              type="number"
              min={0}
              inputMode="numeric"
              value={search.ageMinDays ?? ''}
              onChange={(event) => onFilterChange({ ageMinDays: readAge(event.target.value) })}
            />
          </div>

          <div className="filter-field filter-field--age">
            <label htmlFor={`${idPrefix}-age-max`}>Max age (days)</label>
            <input
              id={`${idPrefix}-age-max`}
              type="number"
              min={0}
              inputMode="numeric"
              value={search.ageMaxDays ?? ''}
              onChange={(event) => onFilterChange({ ageMaxDays: readAge(event.target.value) })}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend className="filter-group__legend">Status</legend>
        <div className="filter-group__fields">
          <div className="filter-field">
            <label htmlFor={`${idPrefix}-inventory-status`}>Inventory status</label>
            <select
              id={`${idPrefix}-inventory-status`}
              value={search.inventoryStatus ?? ''}
              onChange={(event) =>
                onFilterChange({
                  inventoryStatus: event.target.value === '' ? undefined : event.target.value,
                })
              }
            >
              <option value="">All inventory statuses</option>
              {INVENTORY_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor={`${idPrefix}-action-status`}>Action status</label>
            <select
              id={`${idPrefix}-action-status`}
              value={search.actionStatusId ?? ''}
              onChange={(event) =>
                onFilterChange({
                  actionStatusId: event.target.value === '' ? undefined : event.target.value,
                })
              }
            >
              <option value="">Any action status</option>
              {statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </fieldset>
    </div>
  );
}
