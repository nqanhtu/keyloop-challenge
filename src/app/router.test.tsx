import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from './App';
import { createAppRouter } from './router';
import { createTestQueryClient } from '../test/test-utils';

/**
 * Approved routing decision: opening the app root must show the inventory
 * dashboard, while `/inventory` stays the single canonical dashboard URL. The
 * index route is a pure redirect, so entry at `/` renders no page of its own.
 */
function renderAt(initialEntry: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
  render(<App queryClient={createTestQueryClient()} router={router} />);
  return router;
}

describe('V05 — app root redirects to the canonical dashboard', () => {
  it('resolves the app root to /inventory and renders the dashboard', async () => {
    const router = renderAt('/');

    expect(await screen.findByRole('region', { name: 'Inventory results' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 1, name: /keyloop inventory command center/i }),
    ).toBeInTheDocument();

    expect(router.state.location.pathname).toBe('/inventory');
    // The removed index placeholder must not be reachable at the root.
    expect(screen.queryByText(/foundation ready/i)).not.toBeInTheDocument();
  });

  it('carries the incoming query string through the redirect', async () => {
    const router = renderAt('/?make=BMW');

    expect(await screen.findByRole('region', { name: 'Inventory results' })).toBeInTheDocument();

    expect(router.state.location.pathname).toBe('/inventory');
    expect(router.state.location.searchStr).toBe('?make=BMW');
    expect(router.state.location.search).toMatchObject({ make: 'BMW' });
    expect(screen.getByRole('button', { name: 'Remove Make filter' })).toBeInTheDocument();
  });
});
