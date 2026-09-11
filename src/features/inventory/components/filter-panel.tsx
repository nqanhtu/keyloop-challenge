import { FilterControls, type FilterControlsProps } from './filter-controls';

/** Desktop: common filters are inline (System Design 6.4). */
export function InlineFilterBar(props: FilterControlsProps) {
  return (
    <form
      className="filter-bar"
      aria-label="Inventory filters"
      onSubmit={(event) => event.preventDefault()}
    >
      <FilterControls {...props} />
    </form>
  );
}

export interface FilterSheetProps extends FilterControlsProps {
  onClose: () => void;
}

/** Tablet and mobile: the filter set moves into an adaptive sheet. */
export function FilterSheet({ onClose, ...controls }: FilterSheetProps) {
  return (
    <div className="filter-sheet" role="dialog" aria-modal="true" aria-label="Inventory filters">
      <div className="filter-sheet__header">
        <h2>Filters</h2>
        <button type="button" className="button" onClick={onClose} aria-label="Close filters">
          Close
        </button>
      </div>
      <FilterControls {...controls} />
      <button type="button" className="button button--primary" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
