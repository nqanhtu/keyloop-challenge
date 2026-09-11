/**
 * U06 RP-1 (UI System Design §17.8, §18, §14): modal surfaces must contain
 * keyboard focus. This is the one shared implementation both the filter sheet
 * and the vehicle detail surface compose, so their behaviour cannot drift.
 */
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Every focusable, currently enabled control inside `root`, in tab order. */
export function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1,
  );
}

/**
 * Keeps Tab / Shift+Tab cycling inside `root`. Returns true when it handled the
 * event, so the caller can keep Escape and other keys separate.
 */
export function trapTabKey(root: HTMLElement, event: KeyboardEvent): boolean {
  const focusable = getFocusable(root);
  if (focusable.length === 0) {
    return false;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (!root.contains(active)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return true;
  }
  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
