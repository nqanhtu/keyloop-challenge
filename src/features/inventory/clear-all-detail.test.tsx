import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { createTestQueryClient } from '../../test/test-utils';

/** Heavy full-dashboard jsdom tests: keep an explicit ceiling (INC-001). */
const INTERACTION_TIMEOUT = 15_000;

function renderInventory(initialEntry = '/inventory') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
  render(<App queryClient={createTestQueryClient()} router={router} />);
  return { router };
}

describe('U03 — Clear all preserves vehicle-detail context (UI §13.3)', () => {
  it('removes every collection filter but keeps the URL-owned vehicleId and the open detail', async () => {
    const user = userEvent.setup();
    const { router } = renderInventory('/inventory?make=BMW&agingOnly=true&vehicleId=veh_004');

    await screen.findByRole('button', { name: 'Clear all filters' });
    expect(await screen.findByRole('dialog', { name: /vehicle detail/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ vehicleId: 'veh_004' });
    });
    // The unrelated detail context is not destroyed by clearing collection filters.
    expect(screen.getByRole('dialog', { name: /vehicle detail/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Active filters')).toBeNull();
  }, INTERACTION_TIMEOUT);
});
