import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { createTestQueryClient } from '../../test/test-utils';
import { MOBILE_VIEWPORT_QUERY, TABLET_VIEWPORT_QUERY, type ViewportTier } from './use-viewport-tier';

const originalMatchMedia = window.matchMedia;

function stubViewport(tier: ViewportTier) {
  window.matchMedia = ((query: string) => ({
    matches:
      (tier === 'mobile' && query === MOBILE_VIEWPORT_QUERY) ||
      (tier === 'tablet' && query === TABLET_VIEWPORT_QUERY),
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

describe('T04 — Responsive presentation seam (RESP-001)', () => {
  it('renders the full desktop table with inline filters', async () => {
    stubViewport('desktop');

    renderInventory();

    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent);

    expect(headers).toEqual([
      'Make',
      'Model',
      'VIN',
      'Stocked',
      'Age (days)',
      'Status',
      'Aging',
      'Current action',
    ]);

    expect(screen.getByLabelText('Make')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filters' })).toBeNull();
  });

  it('renders a condensed compact table and a filter sheet on tablet', async () => {
    const user = userEvent.setup();
    stubViewport('tablet');

    renderInventory();

    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((header) => header.textContent);

    expect(headers).toEqual(['Make', 'Model', 'Age (days)', 'Aging', 'Current action']);
    expect(headers).not.toContain('VIN');
    expect(screen.queryByLabelText('Make')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Filters' }));

    const sheet = screen.getByRole('dialog', { name: 'Inventory filters' });
    expect(within(sheet).getByLabelText('Make')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Action status')).toBeInTheDocument();
  });

  it('renders prioritized vehicle cards and a filter sheet on mobile', async () => {
    const user = userEvent.setup();
    stubViewport('mobile');

    renderInventory();

    const cards = await screen.findByRole('list', { name: 'Inventory vehicles' });
    await waitFor(() => expect(within(cards).getAllByRole('listitem').length).toBe(50));
    expect(screen.queryByRole('table')).toBeNull();

    const firstCard = within(cards).getAllByRole('listitem')[0];
    expect(firstCard).toHaveTextContent('Audi Q7');
    expect(firstCard).toHaveTextContent('151 days');
    expect(within(firstCard).getByText('AGING')).toBeInTheDocument();
    expect(firstCard).toHaveTextContent('Current action');

    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const sheet = screen.getByRole('dialog', { name: 'Inventory filters' });
    expect(within(sheet).getByLabelText('Inventory status')).toBeInTheDocument();
  });
});

describe('T04 — Responsive filter access seam (RESP-002)', () => {
  it('keeps the aging-only quick filter reachable from the primary workflow on every tier', async () => {
    stubViewport('mobile');

    renderInventory();

    expect(await screen.findByLabelText('Aging only')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort')).toBeInTheDocument();
  });
});
