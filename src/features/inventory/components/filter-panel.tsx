import { useEffect, useRef } from 'react';
import { Button } from '../../../app/ui';
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

/**
 * UI System Design §13.4: the sheet is a real modal surface. Focus moves into
 * it on open, is trapped while it is open, Escape closes it, and focus returns
 * to the control that opened it (the `Filters` trigger).
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Tablet and mobile: the filter set moves into an adaptive sheet. */
export function FilterSheet({ onClose, ...controls }: FilterSheetProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Focus in on open; focus out (back to the trigger) on close.
  useEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    return () => {
      openerRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const root = dialogRef.current;
      if (!root) {
        return;
      }

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!root.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return;
      }
      if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div className="filter-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className="filter-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Inventory filters"
      >
        <div className="filter-sheet__header">
          <h2>Filters</h2>
          <Button ref={closeButtonRef} onClick={onClose} aria-label="Close filters">
            Close
          </Button>
        </div>
        <FilterControls {...controls} />
        <div className="filter-sheet__actions">
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </>
  );
}
