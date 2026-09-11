import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { createTestQueryClient } from '../../test/test-utils';
import { MOBILE_VIEWPORT_QUERY } from './use-viewport-tier';

/** Heavy full-dashboard jsdom tests: keep an explicit ceiling (INC-001). */
const INTERACTION_TIMEOUT = 15_000;

const originalMatchMedia = window.matchMedia;

function stubMobileViewport() {
  window.matchMedia = ((query: string) => ({
    matches: query === MOBILE_VIEWPORT_QUERY,
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

describe('U03 — Mobile card lifecycle seam (UI §11.3, §12.1)', () => {
  it('shows lifecycle status on each card, alongside age, aging and current action', async () => {
    stubMobileViewport();
    renderInventory();

    const cards = await screen.findByRole('list', { name: 'Inventory vehicles' });
    await waitFor(() => expect(within(cards).getAllByRole('listitem').length).toBe(50));

    // The oldest fixture (Audi Q7, 151 days) is first; it is AVAILABLE and aging.
    const firstCard = within(cards).getAllByRole('listitem')[0];
    expect(firstCard).toHaveTextContent('Audi Q7');
    expect(firstCard).toHaveTextContent('151 days');
    expect(within(firstCard).getByText('AGING')).toBeInTheDocument();
    expect(within(firstCard).getByText('Status')).toBeInTheDocument();
    expect(firstCard).toHaveTextContent('AVAILABLE');
    expect(within(firstCard).getByText('Current action')).toBeInTheDocument();

    // A card list, never a table, on the mobile tier.
    expect(screen.queryByRole('table')).toBeNull();
  }, INTERACTION_TIMEOUT);
});
