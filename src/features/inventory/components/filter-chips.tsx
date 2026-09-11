import type { VehicleActionStatus } from '../../../api/types';
import type { InventorySearch } from '../search';
import { INVENTORY_STATUS_OPTIONS } from '../search';

export interface FilterChip {
  key: string;
  label: string;
  removeLabel: string;
  clear: Partial<InventorySearch>;
}

function inventoryStatusLabel(value: string): string {
  return INVENTORY_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/** System Design 6.4: every active filter appears as a removable chip. */
export function buildFilterChips(
  search: InventorySearch,
  statuses: VehicleActionStatus[],
): FilterChip[] {
  const chips: FilterChip[] = [];

  if (search.make) {
    chips.push({
      key: 'make',
      label: `Make: ${search.make}`,
      removeLabel: 'Make',
      clear: { make: undefined },
    });
  }
  if (search.model) {
    chips.push({
      key: 'model',
      label: `Model: ${search.model}`,
      removeLabel: 'Model',
      clear: { model: undefined },
    });
  }
  if (search.ageMinDays !== undefined) {
    chips.push({
      key: 'ageMinDays',
      label: `Min age: ${search.ageMinDays} days`,
      removeLabel: 'Minimum age',
      clear: { ageMinDays: undefined },
    });
  }
  if (search.ageMaxDays !== undefined) {
    chips.push({
      key: 'ageMaxDays',
      label: `Max age: ${search.ageMaxDays} days`,
      removeLabel: 'Maximum age',
      clear: { ageMaxDays: undefined },
    });
  }
  if (search.inventoryStatus) {
    chips.push({
      key: 'inventoryStatus',
      label: `Inventory: ${inventoryStatusLabel(search.inventoryStatus)}`,
      removeLabel: 'Inventory status',
      clear: { inventoryStatus: undefined },
    });
  }
  if (search.actionStatusId) {
    const statusLabel =
      statuses.find((status) => status.id === search.actionStatusId)?.label ?? search.actionStatusId;
    chips.push({
      key: 'actionStatusId',
      label: `Action: ${statusLabel}`,
      removeLabel: 'Action status',
      clear: { actionStatusId: undefined },
    });
  }
  if (search.agingOnly) {
    chips.push({
      key: 'agingOnly',
      label: 'Aging only',
      removeLabel: 'Aging only',
      clear: { agingOnly: undefined },
    });
  }

  return chips;
}

export interface ActiveFilterChipsProps {
  chips: FilterChip[];
  onRemove: (chip: FilterChip) => void;
  onClearAll: () => void;
}

export function ActiveFilterChips({ chips, onRemove, onClearAll }: ActiveFilterChipsProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="active-filters">
      <ul className="filter-chips" aria-label="Active filters">
        {chips.map((chip) => (
          <li key={chip.key} className="filter-chip">
            <span className="filter-chip__label">{chip.label}</span>
            <button
              type="button"
              className="filter-chip__remove"
              aria-label={`Remove ${chip.removeLabel} filter`}
              onClick={() => onRemove(chip)}
            >
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="button" onClick={onClearAll} aria-label="Clear all filters">
        Clear all
      </button>
    </div>
  );
}
