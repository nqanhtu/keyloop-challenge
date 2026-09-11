import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { server } from '../../mocks/server';
import { createTestQueryClient } from '../../test/test-utils';

const SAMPLE_VEHICLE = {
  vehicleId: 'veh_page_size_probe',
  vin: 'VIN_PAGE_SIZE_1',
  make: 'BMW',
  model: 'X5',
  stockedAt: '2026-05-20T12:00:00Z',
  upstreamStatus: 'AVAILABLE',
  inventoryAgeDays: 12,
  isAging: false,
  currentAction: null,
};

function renderInventory(initialEntry = '/inventory') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
  render(<App queryClient={createTestQueryClient()} router={router} />);
  return { router };
}

/**
 * Serves one row per page and echoes the requested page/pageSize so the tests
 * can prove the client sends the effective page size rather than a constant.
 */
function servePagedInventory(total: number, requests: URL[]) {
  server.use(
    http.get('/vehicles', ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '50');
      return HttpResponse.json({
        data: [SAMPLE_VEHICLE],
        meta: { page, pageSize, total, lastSuccessfulSyncAt: '2026-06-01T12:00:00Z' },
      });
    }),
  );
}

const lastRequest = (requests: URL[]) => requests[requests.length - 1];

/**
 * Decision 0004 — React Testing Library + MSW proof that the page-size control
 * writes URL-owned state, drives the server query, and resets pagination.
 */
describe('Decision 0004 — page-size control integration', () => {
  it('requests pageSize=100 and reflects it in the URL when 100 is selected', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    servePagedInventory(120, requests);

    const { router } = renderInventory();

    const select = await screen.findByLabelText('Rows per page');
    expect(select).toHaveValue('50');

    await user.selectOptions(select, '100');

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ pageSize: 100 });
    });
    await waitFor(() => {
      expect(lastRequest(requests).searchParams.get('pageSize')).toBe('100');
    });
  });

  it('removes pageSize from the URL when the default page size is selected', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    servePagedInventory(120, requests);

    const { router } = renderInventory('/inventory?pageSize=100');

    const select = await screen.findByLabelText('Rows per page');
    expect(select).toHaveValue('100');

    await user.selectOptions(select, '50');

    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
    await waitFor(() => {
      expect(lastRequest(requests).searchParams.get('pageSize')).toBe('50');
    });
  });

  it('resets to page 1 and requests page 1 when the page size changes on page 2', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    servePagedInventory(120, requests);

    const { router } = renderInventory('/inventory?page=2');

    const select = await screen.findByLabelText('Rows per page');
    await user.selectOptions(select, '100');

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ pageSize: 100 });
    });
    expect(router.state.location.search).not.toMatchObject({ page: 2 });
    await waitFor(() => {
      expect(lastRequest(requests).searchParams.get('page')).toBe('1');
    });
  });

  it('derives the page count from the selected page size', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    servePagedInventory(120, requests);

    renderInventory();

    // 120 records at the default 50 per page is 3 pages.
    await waitFor(() => {
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Page 1 of 3');
    });

    await user.selectOptions(await screen.findByLabelText('Rows per page'), '100');
    await waitFor(() => {
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Page 1 of 2');
    });

    await user.selectOptions(screen.getByLabelText('Rows per page'), '25');
    await waitFor(() => {
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Page 1 of 5');
    });
  });

  it('keeps the selected page size when Clear all removes the filters', async () => {
    const user = userEvent.setup();
    const requests: URL[] = [];
    servePagedInventory(120, requests);

    const { router } = renderInventory('/inventory?make=BMW&page=2&pageSize=100');

    await user.click(await screen.findByRole('button', { name: 'Clear all filters' }));

    await waitFor(() => {
      expect(router.state.location.search).toEqual({ pageSize: 100 });
    });
    await waitFor(() => {
      const request = lastRequest(requests);
      expect(request.searchParams.get('pageSize')).toBe('100');
      expect(request.searchParams.get('make')).toBeNull();
      expect(request.searchParams.get('page')).toBe('1');
    });
  });
});

/** Serves as many rows as the requested page size, echoing page/pageSize back. */
function serveEchoedInventory(total: number, requests: URL[]) {
  server.use(
    http.get('/vehicles', ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const pageSize = Number(url.searchParams.get('pageSize') ?? '50');
      const firstIndex = (page - 1) * pageSize;
      const rows = Math.max(0, Math.min(pageSize, total - firstIndex));
      return HttpResponse.json({
        data: Array.from({ length: rows }, (_, index) => ({
          ...SAMPLE_VEHICLE,
          vehicleId: `veh_page_size_${firstIndex + index}`,
          vin: `VIN_PAGE_SIZE_${firstIndex + index}`,
        })),
        meta: { page, pageSize, total, lastSuccessfulSyncAt: '2026-06-01T12:00:00Z' },
      });
    }),
  );
}

/**
 * F-01: a hand-typed, unsupported URL value must never become the effective
 * collection state. The dashboard renders the sanitized InventorySearch, so the
 * control, the page count, the rendered rows, and the server request all agree
 * on the designed default rather than the raw address-bar value.
 */
describe('F-01 — unsupported URL values are normalized before render and request', () => {
  it.each(['37', 'abc', '0', '1000', '-5'])(
    'normalizes /inventory?pageSize=%s to the default 50',
    async (rawPageSize) => {
      const requests: URL[] = [];
      serveEchoedInventory(120, requests);

      renderInventory(`/inventory?pageSize=${rawPageSize}`);

      // The control reports the effective size, not the first option.
      expect(await screen.findByLabelText('Rows per page')).toHaveValue('50');
      // The page count is finite and derived from the effective size (120/50 = 3).
      await waitFor(() => {
        expect(screen.getByTestId('pagination-status')).toHaveTextContent('Page 1 of 3');
      });
      // The raw value never reaches the server.
      await waitFor(() => {
        expect(lastRequest(requests).searchParams.get('pageSize')).toBe('50');
      });
      // The rendered page equals the effective size (header row + 50 body rows).
      await waitFor(() => {
        expect(screen.getAllByRole('row')).toHaveLength(51);
      });
    },
  );

  it('normalizes an unsupported page and sort alongside the page size', async () => {
    const requests: URL[] = [];
    serveEchoedInventory(120, requests);

    renderInventory('/inventory?page=abc&sort=bogus&pageSize=37');

    expect(await screen.findByLabelText('Rows per page')).toHaveValue('50');
    await waitFor(() => {
      expect(screen.getByTestId('pagination-status')).toHaveTextContent('Page 1 of 3');
    });
    await waitFor(() => {
      const request = lastRequest(requests);
      expect(request.searchParams.get('page')).toBe('1');
      expect(request.searchParams.get('pageSize')).toBe('50');
      expect(request.searchParams.get('sort')).toBe('inventoryAgeDays:desc');
    });
  });
});
