import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { createTestQueryClient } from '../../test/test-utils';
import { TABLET_VIEWPORT_QUERY } from './use-viewport-tier';

/** Heavy full-dashboard jsdom tests: keep an explicit ceiling (INC-001). */
const INTERACTION_TIMEOUT = 15_000;

const originalMatchMedia = window.matchMedia;

function stubTabletViewport() {
  window.matchMedia = ((query: string) => ({
    matches: query === TABLET_VIEWPORT_QUERY,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

function renderInventory(initialEntry = '/inventory') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
  render(<App queryClient={createTestQueryClient()} router={router} />);
  return { router };
}

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('U03 — Filter sheet modal seam (UI §13.4)', () => {
  it('moves focus in, traps Tab, closes on Escape, and restores focus to the Filters trigger', async () => {
    const user = userEvent.setup();
    stubTabletViewport();
    renderInventory();

    const filtersButton = await screen.findByRole('button', { name: 'Filters' });
    await user.click(filtersButton);

    const sheet = screen.getByRole('dialog', { name: 'Inventory filters' });
    const closeButton = within(sheet).getByRole('button', { name: 'Close filters' });
    const doneButton = within(sheet).getByRole('button', { name: 'Done' });

    // Focus moves into the dialog when it opens.
    expect(closeButton).toHaveFocus();

    // Focus is trapped: Shift+Tab from the first control wraps to the last...
    await user.tab({ shift: true });
    expect(doneButton).toHaveFocus();

    // ...and Tab from the last control wraps back to the first (never leaves).
    await user.tab();
    expect(closeButton).toHaveFocus();

    // Escape closes the sheet and returns focus to the trigger.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Inventory filters' })).toBeNull();
    expect(filtersButton).toHaveFocus();
  }, INTERACTION_TIMEOUT);

  it('keeps the sheet name stable and exposes the grouped filter set', async () => {
    const user = userEvent.setup();
    stubTabletViewport();
    renderInventory();

    await user.click(await screen.findByRole('button', { name: 'Filters' }));

    const sheet = screen.getByRole('dialog', { name: 'Inventory filters' });
    expect(sheet).toHaveAttribute('aria-modal', 'true');
    for (const label of [
      'Make',
      'Model',
      'Min age (days)',
      'Max age (days)',
      'Inventory status',
      'Action status',
    ]) {
      expect(within(sheet).getByLabelText(label)).toBeInTheDocument();
    }
  }, INTERACTION_TIMEOUT);
});
