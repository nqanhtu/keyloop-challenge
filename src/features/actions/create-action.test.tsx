import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { http, HttpResponse } from 'msw';
import type { CreateVehicleActionInput } from '../../api/types';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { server } from '../../mocks/server';
import { createTestQueryClient } from '../../test/test-utils';
import { useIsolatedMockBackend } from '../../test/mock-backend';

const FIXED_CLOCK = () => '2026-06-01T12:00:00Z';
const FIXED_ID = () => 'act_created_t05';

/** The optimistic/reconcile tests drive the full dashboard, so allow headroom. */
const INTERACTION_TIMEOUT = 15_000;

function renderInventory(initialEntry = '/inventory') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
  render(<App queryClient={createTestQueryClient()} router={router} />);
  return { router };
}

function detailRegion(detail: HTMLElement, label: string): HTMLElement {
  return within(detail).getByRole('region', { name: label });
}

async function openDetail(vin: string) {
  const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
  await waitFor(() => {
    expect(within(detailRegion(detail, 'Vehicle summary')).getByText(vin)).toBeInTheDocument();
  });
  return detail;
}

function inventoryRowFor(vin: string): HTMLElement {
  const table = screen.getByRole('table');
  const row = within(table)
    .getAllByRole('row')
    .find((candidate) => candidate.textContent?.includes(vin));
  if (!row) {
    throw new Error(`Expected the inventory table to render a row for ${vin}`);
  }
  return row;
}

function currentActionOf(detail: HTMLElement): HTMLElement {
  return detailRegion(detail, 'Current action');
}

function historyOf(detail: HTMLElement): HTMLElement {
  return detailRegion(detail, 'Action history');
}

describe('T05 — Optimistic mutation seam (ACT-009)', () => {
  it('shows the optimistic current action while in flight, then reconciles with the authoritative created action', async () => {
    const user = userEvent.setup({ delay: null });
    const backend = useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });

    const postedBodies: CreateVehicleActionInput[] = [];
    let releaseCreate: () => void = () => {};
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });

    server.use(
      http.post('/vehicles/:vehicleId/actions', async ({ params, request }) => {
        const body = (await request.json()) as CreateVehicleActionInput;
        postedBodies.push(body);
        await createGate;
        const created = await backend.actionService.createAction(params.vehicleId as string, body);
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    renderInventory('/inventory?vehicleId=veh_001');

    const detail = await openDetail('1HGCR2F83HA000001');
    expect(currentActionOf(detail)).toHaveTextContent('No current action');
    expect(within(historyOf(detail)).queryAllByRole('listitem')).toHaveLength(0);

    await user.selectOptions(
      within(detailRegion(detail, 'Record an action')).getByLabelText('Action status'),
      'status_wholesale_auction',
    );
    await user.type(
      within(detailRegion(detail, 'Record an action')).getByLabelText('Note (optional)'),
      'Auction follow-up.',
    );
    await user.click(within(detail).getByRole('button', { name: 'Record action' }));

    // Optimistic: the selected status is the current action before the POST resolves.
    await waitFor(() => {
      expect(currentActionOf(detail)).toHaveTextContent('Wholesale / Auction');
    });
    expect(inventoryRowFor('1HGCR2F83HA000001')).toHaveTextContent('Wholesale / Auction');
    expect(within(historyOf(detail)).queryAllByRole('listitem')).toHaveLength(0);

    releaseCreate();

    // Reconciled: history and actor come from the authoritative created action.
    await waitFor(() => {
      expect(within(historyOf(detail)).getAllByRole('listitem')).toHaveLength(1);
    });
    const recorded = within(historyOf(detail)).getAllByRole('listitem')[0];
    expect(recorded).toHaveTextContent('Wholesale / Auction');
    expect(recorded).toHaveTextContent('Alex Manager');
    expect(recorded).toHaveTextContent('2026-06-01 12:00 UTC');
    expect(recorded).toHaveTextContent('Auction follow-up.');
    expect(currentActionOf(detail)).toHaveTextContent('Wholesale / Auction');

    expect(postedBodies).toEqual([
      { statusId: 'status_wholesale_auction', note: 'Auction follow-up.' },
    ]);
  }, INTERACTION_TIMEOUT);

  it('restores the previous current action and surfaces the failure when the create request fails', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });

    let releaseCreate: () => void = () => {};
    const createGate = new Promise<void>((resolve) => {
      releaseCreate = resolve;
    });

    server.use(
      http.post('/vehicles/:vehicleId/actions', async () => {
        await createGate;
        return HttpResponse.json(
          {
            code: 'STATUS_INACTIVE',
            message: 'Action status is inactive and cannot be assigned to new actions',
            requestId: 'req_t05_failure_1',
          },
          { status: 400 },
        );
      }),
    );

    // veh_004 carries the seeded 'Legacy Hold (Discontinued)' current action.
    renderInventory('/inventory?vehicleId=veh_004');

    const detail = await openDetail('1HGCR2F83HA000004');
    expect(currentActionOf(detail)).toHaveTextContent('Legacy Hold (Discontinued)');

    const form = detailRegion(detail, 'Record an action');
    await user.selectOptions(within(form).getByLabelText('Action status'), 'status_price_reduction');
    await user.click(within(detail).getByRole('button', { name: 'Record action' }));

    await waitFor(() => {
      expect(currentActionOf(detail)).toHaveTextContent('Price Reduction');
    });

    releaseCreate();

    await waitFor(() => {
      expect(currentActionOf(detail)).toHaveTextContent('Legacy Hold (Discontinued)');
    });
    expect(inventoryRowFor('1HGCR2F83HA000004')).toHaveTextContent('Legacy Hold (Discontinued)');
    expect(within(historyOf(detail)).getAllByRole('listitem')).toHaveLength(1);
    expect(within(form).getByRole('alert')).toHaveTextContent(
      'Action status is inactive and cannot be assigned to new actions',
    );
  }, INTERACTION_TIMEOUT);
});

describe('T05 — Cross-view coherence seam (ACT-009)', () => {
  it('reflects the created action in the list row, the detail current action, and the detail history', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });

    // Counts server reads of the vehicle list so "coherent" means re-read from
    // the server rather than left on the optimistic draft.
    const vehicleListReads: string[] = [];
    const recordVehicleListRead = ({ request }: { request: Request }) => {
      if (request.method === 'GET' && new URL(request.url).pathname === '/vehicles') {
        vehicleListReads.push(request.url);
      }
    };
    server.events.on('request:start', recordVehicleListRead);

    try {
      renderInventory('/inventory?vehicleId=veh_001');

      const detail = await openDetail('1HGCR2F83HA000001');
      const form = detailRegion(detail, 'Record an action');
      const readsBeforeCreate = vehicleListReads.length;

      await user.selectOptions(
        within(form).getByLabelText('Action status'),
        'status_price_reduction',
      );
      await user.click(within(detail).getByRole('button', { name: 'Record action' }));

      await waitFor(() => {
        expect(within(historyOf(detail)).getAllByRole('listitem')).toHaveLength(1);
      });

      expect(currentActionOf(detail)).toHaveTextContent('Price Reduction');
      const recorded = within(historyOf(detail)).getAllByRole('listitem')[0];
      expect(recorded).toHaveTextContent('Price Reduction');
      expect(recorded).toHaveTextContent('No note');

      await waitFor(() => {
        expect(inventoryRowFor('1HGCR2F83HA000001')).toHaveTextContent('Price Reduction');
      });
      expect(inventoryRowFor('1HGCR2F83HA000001')).not.toHaveTextContent('No current action');
      await waitFor(() => expect(vehicleListReads.length).toBeGreaterThan(readsBeforeCreate));
    } finally {
      server.events.removeListener('request:start', recordVehicleListRead);
    }
  }, INTERACTION_TIMEOUT);
});

describe('T05 — Create-action submit seam (ACT-008, ACT-009)', () => {
  it('posts only statusId plus the optional note and normalizes an untouched note to null', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });

    const postedBodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post('/vehicles/:vehicleId/actions', async ({ request }) => {
        postedBodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          {
            id: FIXED_ID(),
            vehicleId: 'veh_001',
            statusId: 'status_inspection_required',
            status: {
              id: 'status_inspection_required',
              code: 'INSPECTION_REQUIRED',
              label: 'Inspection Required',
            },
            note: null,
            createdAt: FIXED_CLOCK(),
            createdByActorId: 'actor_manager_1',
            createdByDisplayName: 'Alex Manager',
            createdByType: 'USER',
          },
          { status: 201 },
        );
      }),
    );

    renderInventory('/inventory?vehicleId=veh_001');

    const detail = await openDetail('1HGCR2F83HA000001');
    const form = detailRegion(detail, 'Record an action');

    await user.selectOptions(
      within(form).getByLabelText('Action status'),
      'status_inspection_required',
    );
    await user.click(within(detail).getByRole('button', { name: 'Record action' }));

    await waitFor(() => expect(postedBodies).toHaveLength(1));
    expect(postedBodies[0]).toEqual({ statusId: 'status_inspection_required', note: null });
  }, INTERACTION_TIMEOUT);
});

describe('T05 — Detail selection URL seam (DETAIL-001)', () => {
  it('preserves the T04 discovery state when the detail surface opens and closes', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });

    const { router } = renderInventory('/inventory?make=BMW&agingOnly=true');

    await screen.findByLabelText('Make');
    await waitFor(() => expect(screen.getByLabelText('Make')).toHaveValue('BMW'));
    expect(screen.getByLabelText('Aging only')).toBeChecked();

    await user.click(
      await screen.findByRole('button', { name: /view details for bmw x5 \(1hgcr2f83ha000001\)/i }),
    );

    await waitFor(() => {
      expect(router.state.location.search).toEqual({
        make: 'BMW',
        agingOnly: true,
        vehicleId: 'veh_001',
      });
    });
    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });

    await user.click(within(detail).getByRole('button', { name: 'Close vehicle detail' }));

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ make: 'BMW', agingOnly: true });
    });
    expect(screen.queryByRole('dialog', { name: /vehicle detail/i })).toBeNull();
    expect(screen.getByLabelText('Make')).toHaveValue('BMW');
    expect(screen.getByLabelText('Aging only')).toBeChecked();
  }, INTERACTION_TIMEOUT);
});
