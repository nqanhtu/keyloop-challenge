import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { server } from '../../mocks/server';
import { createTestQueryClient } from '../../test/test-utils';

const EMPTY_PAGE = {
  data: [],
  meta: { page: 1, pageSize: 50, total: 0, lastSuccessfulSyncAt: '2026-06-01T12:00:00Z' },
};

function renderInventory(initialEntry = '/inventory') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
  const queryClient = createTestQueryClient();
  render(<App queryClient={queryClient} router={router} />);
  return { router, queryClient };
}

describe('T04 — Dashboard summary seam (UI-001)', () => {
  it('renders Total Inventory, Aging Vehicles, and Aging With Action from GET /inventory/summary', async () => {
    server.use(
      http.get('/inventory/summary', () =>
        HttpResponse.json({
          totalInventory: 137,
          agingVehicles: 41,
          agingWithAction: 12,
          lastSuccessfulSyncAt: '2026-06-01T12:00:00Z',
        }),
      ),
    );

    renderInventory();

    expect(await screen.findByText('Total Inventory')).toBeInTheDocument();
    expect(screen.getByText('Aging Vehicles')).toBeInTheDocument();
    expect(screen.getByText('Aging With Action')).toBeInTheDocument();

    expect(await screen.findByTestId('kpi-total-inventory')).toHaveTextContent('137');
    expect(screen.getByTestId('kpi-aging-vehicles')).toHaveTextContent('41');
    expect(screen.getByTestId('kpi-aging-with-action')).toHaveTextContent('12');
  });
});

describe('T04 — Server-query seam (UI-004)', () => {
  it('requests GET /vehicles with every server-side key derived from the URL', async () => {
    const requestedUrls: URL[] = [];
    server.use(
      http.get('/vehicles', ({ request }) => {
        requestedUrls.push(new URL(request.url));
        return HttpResponse.json(EMPTY_PAGE);
      }),
    );

    renderInventory(
      '/inventory?make=BMW&model=X5&ageMinDays=91&ageMaxDays=180&inventoryStatus=AVAILABLE&actionStatusId=status_price_reduction&agingOnly=true&sort=inventoryAgeDays:asc&page=2',
    );

    await waitFor(() => expect(requestedUrls.length).toBeGreaterThan(0));
    const request = requestedUrls[requestedUrls.length - 1];

    expect(request.searchParams.get('make')).toBe('BMW');
    expect(request.searchParams.get('model')).toBe('X5');
    expect(request.searchParams.get('ageMinDays')).toBe('91');
    expect(request.searchParams.get('ageMaxDays')).toBe('180');
    expect(request.searchParams.get('inventoryStatus')).toBe('AVAILABLE');
    expect(request.searchParams.get('actionStatusId')).toBe('status_price_reduction');
    expect(request.searchParams.get('agingOnly')).toBe('true');
    expect(request.searchParams.get('sort')).toBe('inventoryAgeDays:asc');
    expect(request.searchParams.get('page')).toBe('2');
    expect(request.searchParams.get('pageSize')).toBe('50');
  });

  it('sends the server default sort and page 1 when the URL carries no discovery state', async () => {
    const requestedUrls: URL[] = [];
    server.use(
      http.get('/vehicles', ({ request }) => {
        requestedUrls.push(new URL(request.url));
        return HttpResponse.json(EMPTY_PAGE);
      }),
    );

    renderInventory();

    await waitFor(() => expect(requestedUrls.length).toBeGreaterThan(0));
    const request = requestedUrls[requestedUrls.length - 1];

    expect(request.searchParams.get('sort')).toBe('inventoryAgeDays:desc');
    expect(request.searchParams.get('page')).toBe('1');
  });
});

describe('T04 — URL-owned discovery state seam (UI-003)', () => {
  it('restores filters, sort, and page from a directly entered URL', async () => {
    const requestedUrls: URL[] = [];
    server.use(
      http.get('/vehicles', ({ request }) => {
        requestedUrls.push(new URL(request.url));
        return HttpResponse.json(EMPTY_PAGE);
      }),
    );

    renderInventory('/inventory?make=BMW&agingOnly=true&sort=inventoryAgeDays:asc&page=2');

    await waitFor(() => expect(requestedUrls.length).toBeGreaterThan(0));
    const request = requestedUrls[requestedUrls.length - 1];

    expect(request.searchParams.get('make')).toBe('BMW');
    expect(request.searchParams.get('agingOnly')).toBe('true');
    expect(request.searchParams.get('sort')).toBe('inventoryAgeDays:asc');
    expect(request.searchParams.get('page')).toBe('2');

    expect(await screen.findByLabelText('Make')).toHaveValue('BMW');
    expect(screen.getByLabelText('Aging only')).toBeChecked();
    expect(screen.getByLabelText('Sort')).toHaveValue('inventoryAgeDays:asc');
  });

  it('resets the page to 1 when a filter changes', async () => {
    const user = userEvent.setup();
    const requestedUrls: URL[] = [];
    server.use(
      http.get('/vehicles', ({ request }) => {
        requestedUrls.push(new URL(request.url));
        return HttpResponse.json(EMPTY_PAGE);
      }),
    );

    const { router } = renderInventory('/inventory?page=2');
    await waitFor(() => expect(requestedUrls.length).toBeGreaterThan(0));

    await user.selectOptions(await screen.findByLabelText('Make'), 'BMW');

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ make: 'BMW' });
    });
    expect(router.state.location.search).not.toMatchObject({ page: 2 });
    expect(requestedUrls[requestedUrls.length - 1].searchParams.get('page')).toBe('1');
  });

  it('updates the URL when the aging-only quick filter is toggled on', async () => {
    const user = userEvent.setup();
    const requestedUrls: URL[] = [];
    server.use(
      http.get('/vehicles', ({ request }) => {
        requestedUrls.push(new URL(request.url));
        return HttpResponse.json(EMPTY_PAGE);
      }),
    );

    const { router } = renderInventory();

    await user.click(await screen.findByLabelText('Aging only'));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ agingOnly: true });
    });
    await waitFor(() => {
      expect(requestedUrls[requestedUrls.length - 1].searchParams.get('agingOnly')).toBe('true');
    });
  });
});

describe('T04 — Filter-options seam (UI-002)', () => {
  it('offers make options from GET /inventory/filter-options', async () => {
    renderInventory();

    const makeSelect = await screen.findByLabelText('Make');

    await waitFor(() => {
      expect(within(makeSelect).getByRole('option', { name: 'BMW' })).toBeInTheDocument();
    });
    expect(within(makeSelect).getByRole('option', { name: 'Audi' })).toBeInTheDocument();
  });

  it('narrows model options to the selected make', async () => {
    const user = userEvent.setup();
    renderInventory();

    const modelSelect = await screen.findByLabelText('Model');
    await waitFor(() => {
      expect(within(modelSelect).getByRole('option', { name: 'A4' })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Make'), 'BMW');

    await waitFor(() => {
      expect(within(screen.getByLabelText('Model')).queryByRole('option', { name: 'A4' })).toBeNull();
    });
    expect(
      within(screen.getByLabelText('Model')).getByRole('option', { name: 'X5' }),
    ).toBeInTheDocument();
  });
});

describe('T04 — Filter-chip seam (UI-002)', () => {
  it('renders a removable chip per active filter and removes the filter when the chip is removed', async () => {
    const user = userEvent.setup();
    const requestedUrls: URL[] = [];
    server.use(
      http.get('/vehicles', ({ request }) => {
        requestedUrls.push(new URL(request.url));
        return HttpResponse.json(EMPTY_PAGE);
      }),
    );

    const { router } = renderInventory('/inventory?make=BMW&agingOnly=true');

    const chips = await screen.findByLabelText('Active filters');
    expect(within(chips).getByText('Make: BMW')).toBeInTheDocument();
    expect(within(chips).getByText('Aging only')).toBeInTheDocument();

    await user.click(within(chips).getByRole('button', { name: 'Remove Make filter' }));

    await waitFor(() => {
      expect(router.state.location.search).not.toMatchObject({ make: 'BMW' });
    });
    await waitFor(() => {
      expect(requestedUrls[requestedUrls.length - 1].searchParams.get('make')).toBeNull();
    });
    expect(router.state.location.search).toMatchObject({ agingOnly: true });
  });

  it('clears every filter when Clear all is used', async () => {
    const user = userEvent.setup();
    const requestedUrls: URL[] = [];
    server.use(
      http.get('/vehicles', ({ request }) => {
        requestedUrls.push(new URL(request.url));
        return HttpResponse.json(EMPTY_PAGE);
      }),
    );

    const { router } = renderInventory('/inventory?make=BMW&agingOnly=true&page=2');

    await user.click(await screen.findByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
    await waitFor(() => {
      const request = requestedUrls[requestedUrls.length - 1];
      expect(request.searchParams.get('make')).toBeNull();
      expect(request.searchParams.get('agingOnly')).toBeNull();
      expect(request.searchParams.get('page')).toBe('1');
    });
  });
});

function serverPage(
  data: Array<Record<string, unknown>>,
  meta: { page?: number; pageSize?: number; total?: number } = {},
) {
  return {
    data,
    meta: {
      page: meta.page ?? 1,
      pageSize: meta.pageSize ?? 50,
      total: meta.total ?? data.length,
      lastSuccessfulSyncAt: '2026-06-01T12:00:00Z',
    },
  };
}

const NON_AGING_FORD = {
  vehicleId: 'veh_probe_old',
  vin: 'VIN_PROBE_1',
  make: 'Ford',
  model: 'F-150',
  stockedAt: '2026-05-20T12:00:00Z',
  upstreamStatus: 'AVAILABLE',
  inventoryAgeDays: 12,
  isAging: false,
  currentAction: null,
};

const AGING_BMW = {
  vehicleId: 'veh_probe_mid',
  vin: 'VIN_PROBE_2',
  make: 'BMW',
  model: 'X5',
  stockedAt: '2026-03-02T12:00:00Z',
  upstreamStatus: 'AVAILABLE',
  inventoryAgeDays: 91,
  isAging: true,
  currentAction: {
    id: 'act_probe_1',
    status: {
      id: 'status_price_reduction',
      code: 'PRICE_REDUCTION',
      label: 'Price Reduction',
    },
    note: null,
    createdAt: '2026-05-30T09:00:00Z',
    createdByDisplayName: 'Manager Demo',
    createdByType: 'USER',
  },
};

const AGING_BMW_OLDER = {
  vehicleId: 'veh_probe_newest',
  vin: 'VIN_PROBE_3',
  make: 'BMW',
  model: '3 Series',
  stockedAt: '2026-01-01T12:00:00Z',
  upstreamStatus: 'AVAILABLE',
  inventoryAgeDays: 151,
  isAging: true,
  currentAction: null,
};

function dataRows(): HTMLElement[] {
  const table = screen.getByRole('table');
  return within(table).getAllByRole('row').slice(1);
}

describe('T04 — Server-page fidelity seam (UI-004)', () => {
  it('renders exactly the returned page: no client re-sorting or re-filtering', async () => {
    server.use(
      http.get('/vehicles', () =>
        HttpResponse.json(serverPage([NON_AGING_FORD, AGING_BMW, AGING_BMW_OLDER])),
      ),
    );

    renderInventory('/inventory?make=BMW');

    await waitFor(() => expect(dataRows().length).toBe(3));
    const rows = dataRows();

    // The server page arrives oldest-last; a client re-sort would put VIN_PROBE_3 first.
    expect(rows[0]).toHaveTextContent('VIN_PROBE_1');
    expect(rows[1]).toHaveTextContent('VIN_PROBE_2');
    expect(rows[2]).toHaveTextContent('VIN_PROBE_3');

    // The page contains a non-matching make; a client re-filter would drop it.
    expect(rows[0]).toHaveTextContent('Ford');
  });
});

describe('T04 — Aging and order seam (UI-001)', () => {
  it('shows a readable AGING indicator only on aging vehicles', async () => {
    server.use(
      http.get('/vehicles', () => HttpResponse.json(serverPage([AGING_BMW, NON_AGING_FORD]))),
    );

    renderInventory();

    await waitFor(() => expect(dataRows().length).toBe(2));
    const rows = dataRows();

    expect(within(rows[0]).getByText('AGING')).toBeInTheDocument();
    expect(within(rows[1]).queryByText('AGING')).toBeNull();
  });

  it('renders the served oldest-first order with the oldest inventory first', async () => {
    renderInventory();

    await waitFor(() => expect(dataRows().length).toBe(50));
    const rows = dataRows();

    // 151 days (veh_004) is the oldest fixture, then 106 days (veh_unavail).
    expect(rows[0]).toHaveTextContent('1HGCR2F83HA000004');
    expect(rows[1]).toHaveTextContent('1HGCR2F83HA000007');
    expect(rows[0]).toHaveTextContent('151');
    expect(rows[1]).toHaveTextContent('106');
  });
});

describe('T04 — Empty and no-match states seam (UI-STATE-002)', () => {
  it('distinguishes an empty inventory from a filtered no-match result', async () => {
    server.use(http.get('/vehicles', () => HttpResponse.json(EMPTY_PAGE)));

    renderInventory();

    expect(await screen.findByText('No vehicles in inventory.')).toBeInTheDocument();
    expect(screen.queryByText('No vehicles match the current filters.')).toBeNull();
  });

  it('shows the no-match message when filters exclude every vehicle', async () => {
    server.use(http.get('/vehicles', () => HttpResponse.json(EMPTY_PAGE)));

    renderInventory('/inventory?make=Porsche');

    expect(
      await screen.findByText('No vehicles match the current filters.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('No vehicles in inventory.')).toBeNull();
  });
});

describe('T04 — Pagination seam (UI-004)', () => {
  it('renders one server page at a time and moves to the next page through the URL', async () => {
    const user = userEvent.setup();
    const requestedUrls: URL[] = [];
    server.use(
      http.get('/vehicles', ({ request }) => {
        const url = new URL(request.url);
        requestedUrls.push(url);
        const page = Number(url.searchParams.get('page') ?? '1');
        return HttpResponse.json(
          serverPage([{ ...NON_AGING_FORD, vehicleId: `veh_page_${page}` }], {
            page,
            total: 120,
          }),
        );
      }),
    );

    const { router } = renderInventory();

    await waitFor(() => expect(dataRows().length).toBe(1));
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Page 1 of 3');

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ page: 2 });
    });
    await waitFor(() => {
      expect(requestedUrls[requestedUrls.length - 1].searchParams.get('page')).toBe('2');
    });
    await waitFor(() => expect(dataRows().length).toBe(1));
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Page 2 of 3');
  });

  it('renders 50 rows for page 1 and the remaining 5 rows for page 2 of the real inventory', async () => {
    const user = userEvent.setup();
    renderInventory();

    await waitFor(() => expect(dataRows().length).toBe(50));
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Page 1 of 2');

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    await waitFor(() => expect(dataRows().length).toBe(5));
    expect(screen.getByTestId('pagination-status')).toHaveTextContent('Page 2 of 2');
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });
});

describe('T04 — Accessibility seam (A11Y-001)', () => {
  it('uses semantic table markup with column headers', async () => {
    renderInventory();

    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader');

    expect(headers.length).toBeGreaterThan(0);
    expect(headers.map((header) => header.textContent)).toContain('Make');
    expect(headers.map((header) => header.textContent)).toContain('Aging');
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
  });

  it('provides labelled filter controls and accessible interactive names', async () => {
    renderInventory('/inventory?make=BMW&agingOnly=true');

    expect(await screen.findByLabelText('Make')).toBeInTheDocument();
    expect(screen.getByLabelText('Model')).toBeInTheDocument();
    expect(screen.getByLabelText('Min age (days)')).toBeInTheDocument();
    expect(screen.getByLabelText('Max age (days)')).toBeInTheDocument();
    expect(screen.getByLabelText('Inventory status')).toBeInTheDocument();
    expect(screen.getByLabelText('Action status')).toBeInTheDocument();
    expect(screen.getByLabelText('Sort')).toBeInTheDocument();
    expect(screen.getByLabelText('Aging only')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Make filter' })).toBeInTheDocument();
  });
});

describe('U06 — Current-action scannability (RP-9, U04 F-07)', () => {
  it('marks the no-action state with a neutral pill distinct from an existing action', async () => {
    renderInventory();

    await waitFor(() => expect(dataRows().length).toBe(50));
    const rows = dataRows();
    const noAction = rows.find((row) => row.textContent?.includes('1HGCR2F83HA000001'));
    const withAction = rows.find((row) => row.textContent?.includes('Legacy Hold'));

    expect(noAction).toBeTruthy();
    expect(withAction).toBeTruthy();

    // The no-action state is a distinct, non-colour-only pill...
    expect(
      noAction!.querySelector('.vehicle-table__current-action.ui-status-pill--empty'),
    ).not.toBeNull();
    // ...while an existing action stays a readable neutral pill.
    expect(withAction!.querySelector('.vehicle-table__current-action')).not.toBeNull();
    expect(
      withAction!.querySelector('.vehicle-table__current-action.ui-status-pill--empty'),
    ).toBeNull();
  });
});
