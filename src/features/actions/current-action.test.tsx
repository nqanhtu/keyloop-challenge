import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { createTestQueryClient } from '../../test/test-utils';
import { useIsolatedMockBackend } from '../../test/mock-backend';

/** Heavy full-dashboard jsdom tests: keep an explicit ceiling (INC-001). */
const INTERACTION_TIMEOUT = 15_000;

function renderInventory(initialEntry = '/inventory') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
  render(<App queryClient={createTestQueryClient()} router={router} />);
  return { router };
}

describe('U03 — Current action content seam (UI §14.2)', () => {
  it('shows status, actor display name, timestamp and note in the Current action region', async () => {
    // veh_004 carries the seeded 'Legacy Hold (Discontinued)' current action.
    useIsolatedMockBackend();
    renderInventory('/inventory?vehicleId=veh_004');

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    const current = within(detail).getByRole('region', { name: 'Current action' });

    await waitFor(() =>
      expect(within(current).getByText('Legacy Hold (Discontinued)')).toBeInTheDocument(),
    );
    // Actor and timestamp come from the VehicleActionSummary the API already returns.
    expect(current).toHaveTextContent('System Migration');
    expect(current).toHaveTextContent('2026-05-15 09:00 UTC');
    expect(current).toHaveTextContent('Initial hold prior to policy deprecation');
  }, INTERACTION_TIMEOUT);

  it('still reports an absent current action distinctly', async () => {
    useIsolatedMockBackend();
    renderInventory('/inventory?vehicleId=veh_001');

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    const current = within(detail).getByRole('region', { name: 'Current action' });
    expect(await within(current).findByText('No current action')).toBeInTheDocument();
  }, INTERACTION_TIMEOUT);
});
