import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { server } from '../../mocks/server';
import { createTestQueryClient } from '../../test/test-utils';
import type { ClientInstrumentation } from '../observability/instrumentation';

/** Heavy full-dashboard jsdom tests: keep an explicit ceiling (INC-001). */
const INTERACTION_TIMEOUT = 15_000;

/** 2026-06-01T12:00:00Z is the deterministic mock sync instant. */
const WITHIN_THRESHOLD_NOW = () => Date.parse('2026-06-01T12:10:00Z');
const PAST_THRESHOLD_NOW = () => Date.parse('2026-06-01T13:00:00Z');

const EMPTY_PAGE = {
  data: [],
  meta: { page: 1, pageSize: 50, total: 0, lastSuccessfulSyncAt: '2026-06-01T12:00:00Z' },
};

function renderInventory(
  initialEntry = '/inventory',
  options: { now?: () => number; instrumentation?: ClientInstrumentation } = {},
) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
  render(
    <App
      queryClient={createTestQueryClient()}
      router={router}
      now={options.now}
      instrumentation={options.instrumentation}
    />,
  );
  return { router };
}

function dataRows(): HTMLElement[] {
  const table = screen.getByRole('table');
  return within(table).getAllByRole('row').slice(1);
}

describe('T06 — Localized loading skeleton seam (UI-STATE-001)', () => {
  it('renders skeletons per KPI, list, and detail region while the shell stays present', async () => {
    let releaseRequests: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      releaseRequests = resolve;
    });

    server.use(
      http.get('/inventory/summary', async () => {
        await pending;
        return HttpResponse.json({
          totalInventory: 55,
          agingVehicles: 3,
          agingWithAction: 1,
          lastSuccessfulSyncAt: '2026-06-01T12:00:00Z',
        });
      }),
      http.get('/vehicles', async () => {
        await pending;
        return HttpResponse.json(EMPTY_PAGE);
      }),
      http.get('/vehicles/:vehicleId', async () => {
        await pending;
        return HttpResponse.json(
          {
            vehicleId: 'veh_001',
            vin: '1HGCR2F83HA000001',
            make: 'BMW',
            model: 'X5',
            stockedAt: '2026-03-02T12:00:00Z',
            upstreamStatus: 'AVAILABLE',
            inventoryAgeDays: 91,
            isAging: true,
            currentAction: null,
          },
          { status: 200 },
        );
      }),
    );

    renderInventory('/inventory?vehicleId=veh_001', { now: WITHIN_THRESHOLD_NOW });

    // Localized skeletons, one per region.
    expect(await screen.findByTestId('kpi-skeleton')).toBeInTheDocument();
    expect(screen.getByTestId('inventory-list-skeleton')).toBeInTheDocument();
    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    expect(within(detail).getByTestId('vehicle-detail-skeleton')).toBeInTheDocument();

    // The application shell is not replaced by a global spinner.
    expect(
      screen.getByRole('heading', { level: 1, name: /keyloop inventory command center/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Inventory summary' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Inventory results' })).toBeInTheDocument();
    expect(screen.getByLabelText('Sort')).toBeInTheDocument();

    releaseRequests();

    await waitFor(() => expect(screen.queryByTestId('kpi-skeleton')).toBeNull());
    expect(screen.queryByTestId('inventory-list-skeleton')).toBeNull();
    expect(await screen.findByTestId('kpi-total-inventory')).toHaveTextContent('55');
  }, INTERACTION_TIMEOUT);
});

describe('T06 — Freshness threshold seam (UI-STATE-004)', () => {
  it('retains inventory, shows Last updated, and warns when sync lag exceeds the threshold', async () => {
    renderInventory('/inventory', { now: PAST_THRESHOLD_NOW });

    await waitFor(() => expect(dataRows().length).toBe(50));

    expect(screen.getByTestId('freshness-label')).toHaveTextContent(
      'Last updated 2026-06-01 12:00 UTC',
    );
    expect(screen.getByTestId('freshness-warning')).toHaveTextContent(/may be outdated/i);

    // Previous inventory is retained rather than hidden behind the warning.
    expect(dataRows().length).toBe(50);
    expect(within(dataRows()[0]).getByText('AGING')).toBeInTheDocument();
  }, INTERACTION_TIMEOUT);

  it('shows the last update without a warning while sync lag is within the threshold', async () => {
    renderInventory('/inventory', { now: WITHIN_THRESHOLD_NOW });

    await waitFor(() => expect(dataRows().length).toBe(50));

    expect(screen.getByTestId('freshness-label')).toHaveTextContent(/last updated/i);
    expect(screen.queryByTestId('freshness-warning')).toBeNull();
  }, INTERACTION_TIMEOUT);
});

describe('T06 — Regional failure containment seam (UI-STATE-003)', () => {
  it('contains a /vehicles failure to the results region with retry while other regions stay usable', async () => {
    const user = userEvent.setup({ delay: null });
    let attempts = 0;

    server.use(
      http.get('/vehicles', () => {
        attempts += 1;
        if (attempts === 1) {
          return HttpResponse.json(
            {
              code: 'INTERNAL_ERROR',
              message: 'Inventory list is temporarily unavailable',
              requestId: 'req_list_failure_1',
            },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: [
            {
              vehicleId: 'veh_001',
              vin: '1HGCR2F83HA000001',
              make: 'BMW',
              model: 'X5',
              stockedAt: '2026-03-02T12:00:00Z',
              upstreamStatus: 'AVAILABLE',
              inventoryAgeDays: 91,
              isAging: true,
              currentAction: null,
            },
          ],
          meta: { page: 1, pageSize: 50, total: 1, lastSuccessfulSyncAt: '2026-06-01T12:00:00Z' },
        });
      }),
    );

    renderInventory('/inventory', { now: WITHIN_THRESHOLD_NOW });

    const results = await screen.findByRole('region', { name: 'Inventory results' });
    const regionalError = await within(results).findByRole('alert');
    expect(regionalError).toHaveTextContent('Inventory list is temporarily unavailable');

    // Unaffected regions remain usable.
    expect(await screen.findByTestId('kpi-total-inventory')).toHaveTextContent('55');
    expect(screen.getByLabelText('Sort')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();

    await user.click(within(results).getByRole('button', { name: /retry/i }));

    await waitFor(() => expect(within(results).queryByRole('alert')).toBeNull());
    await waitFor(() => expect(dataRows().length).toBe(1));
    expect(attempts).toBeGreaterThan(1);
  }, INTERACTION_TIMEOUT);

  it('contains a detail failure to the detail region while the inventory list stays usable', async () => {
    server.use(
      http.get('/vehicles/:vehicleId', () =>
        HttpResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: 'Vehicle detail is temporarily unavailable',
            requestId: 'req_detail_failure_1',
          },
          { status: 500 },
        ),
      ),
    );

    renderInventory('/inventory?vehicleId=veh_001', { now: WITHIN_THRESHOLD_NOW });

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    const summaryRegion = within(detail).getByRole('region', { name: 'Vehicle summary' });
    expect(await within(summaryRegion).findByRole('alert')).toHaveTextContent(
      'Vehicle detail is temporarily unavailable',
    );
    expect(screen.queryByTestId('vehicle-detail-skeleton')).toBeNull();

    // The list region is unaffected and still renders inventory.
    await waitFor(() => expect(dataRows().length).toBe(50));
  }, INTERACTION_TIMEOUT);
});
