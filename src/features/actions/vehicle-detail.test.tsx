import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryHistory } from '@tanstack/react-router';
import { http, HttpResponse } from 'msw';
import fs from 'node:fs';
import path from 'node:path';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { server } from '../../mocks/server';
import { createTestQueryClient } from '../../test/test-utils';
import { useIsolatedMockBackend } from '../../test/mock-backend';
import {
  MOBILE_VIEWPORT_QUERY,
  TABLET_VIEWPORT_QUERY,
  type ViewportTier,
} from '../inventory/use-viewport-tier';

/** These tests drive the full dashboard, so allow headroom under CPU load. */
const INTERACTION_TIMEOUT = 15_000;

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

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function renderInventory(initialEntry = '/inventory') {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialEntry] }));
  render(<App queryClient={createTestQueryClient()} router={router} />);
  return { router };
}

function detailRegion(detail: HTMLElement, label: string): HTMLElement {
  return within(detail).getByRole('region', { name: label });
}

const DETAIL_REGION_ORDER = [
  'Vehicle summary',
  'Current action',
  'Record an action',
  'Action history',
];

describe('T05 — Detail surface seam (DETAIL-001)', () => {
  it('presents vehicle summary, current action, create-action form, then action history in that order', async () => {
    useIsolatedMockBackend();

    renderInventory('/inventory?vehicleId=veh_004');

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    expect(detail).toHaveAttribute('aria-modal', 'true');

    await waitFor(() => {
      expect(
        within(detail)
          .getAllByRole('region')
          .map((region) => region.getAttribute('aria-label')),
      ).toEqual(DETAIL_REGION_ORDER);
    });

    const summary = detailRegion(detail, 'Vehicle summary');
    expect(summary).toHaveTextContent('Audi Q7');
    expect(summary).toHaveTextContent('1HGCR2F83HA000004');
    expect(summary).toHaveTextContent('151 days');
    expect(within(summary).getByText('AGING')).toBeInTheDocument();

    expect(detailRegion(detail, 'Current action')).toHaveTextContent('Legacy Hold (Discontinued)');

    const form = detailRegion(detail, 'Record an action');
    expect(within(form).getByLabelText('Action status')).toBeInTheDocument();
    expect(within(form).getByLabelText('Note (optional)')).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Record action' })).toBeInTheDocument();

    expect(detailRegion(detail, 'Action history')).toHaveTextContent(
      'Initial hold prior to policy deprecation',
    );
  }, INTERACTION_TIMEOUT);

  it('opens the detail surface for the selected inventory vehicle', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend();

    const { router } = renderInventory('/inventory');

    await user.click(
      await screen.findByRole('button', { name: /view details for audi q7 \(1hgcr2f83ha000004\)/i }),
    );

    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ vehicleId: 'veh_004' });
    });
    expect(await screen.findByRole('dialog', { name: /vehicle detail/i })).toBeInTheDocument();
  }, INTERACTION_TIMEOUT);
});

const detailCss = fs.readFileSync(path.resolve(__dirname, 'vehicle-detail.css'), 'utf-8');

function cssRule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(detailCss);
  if (!match) {
    throw new Error(`Expected ${selector} to be declared in vehicle-detail.css`);
  }
  return match[1];
}

describe('T05 — Responsive detail seam (RESP-003)', () => {
  it('presents the desktop detail as a right-side drawer', async () => {
    stubViewport('desktop');
    useIsolatedMockBackend();

    renderInventory('/inventory?vehicleId=veh_004');

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    expect(detail).toHaveAttribute('data-variant', 'drawer');
    expect(detail).toHaveClass('vehicle-detail--drawer');
    expect(cssRule('.vehicle-detail--drawer')).toMatch(/inset:\s*0 0 0 auto/);
  }, INTERACTION_TIMEOUT);

  it('presents the tablet detail as an adaptive wide sheet', async () => {
    stubViewport('tablet');
    useIsolatedMockBackend();

    renderInventory('/inventory?vehicleId=veh_004');

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    expect(detail).toHaveAttribute('data-variant', 'sheet');
    expect(detail).toHaveClass('vehicle-detail--sheet');

    const sheetRules = cssRule('.vehicle-detail--sheet');
    expect(sheetRules).toMatch(/width:\s*min\(48rem/);
    expect(sheetRules).not.toMatch(/inset:\s*auto 0 0 0/);
  }, INTERACTION_TIMEOUT);

  it('presents the mobile detail as a full-screen surface opened from the vehicle card', async () => {
    const user = userEvent.setup({ delay: null });
    stubViewport('mobile');
    useIsolatedMockBackend();

    const { router } = renderInventory('/inventory');

    const cards = await screen.findByRole('list', { name: 'Inventory vehicles' });
    const firstCard = within(cards).getAllByRole('listitem')[0];
    await user.click(within(firstCard).getByRole('button', { name: /view details for audi q7/i }));

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    expect(detail).toHaveAttribute('data-variant', 'fullscreen');
    expect(detail).toHaveClass('vehicle-detail--fullscreen');
    expect(router.state.location.search).toMatchObject({ vehicleId: 'veh_004' });

    const fullscreenRules = cssRule('.vehicle-detail--fullscreen');
    expect(fullscreenRules).toMatch(/inset:\s*0/);
    expect(fullscreenRules).toMatch(/height:\s*100%/);
  }, INTERACTION_TIMEOUT);
});

const READY_TO_WHOLESALE = {
  id: 'act_wholesale',
  vehicleId: 'veh_004',
  statusId: 'status_wholesale_auction',
  status: {
    id: 'status_wholesale_auction',
    code: 'WHOLESALE_AUCTION',
    label: 'Wholesale / Auction',
  },
  note: null,
  createdAt: '2026-05-20T14:30:00Z',
  createdByActorId: 'actor_manager_1',
  createdByDisplayName: 'Alex Manager',
  createdByType: 'USER',
};

const PRICE_REDUCTION_OLDER = {
  id: 'act_price',
  vehicleId: 'veh_004',
  statusId: 'status_price_reduction',
  status: { id: 'status_price_reduction', code: 'PRICE_REDUCTION', label: 'Price Reduction' },
  note: 'Review price after weekend campaign.',
  createdAt: '2026-05-15T09:00:00Z',
  createdByActorId: 'actor_system',
  createdByDisplayName: 'System Migration',
  createdByType: 'SYSTEM',
};

describe('T05 — Action-history seam (DETAIL-002)', () => {
  it('renders the complete newest-first history with status, actor, time, and note', async () => {
    useIsolatedMockBackend();
    const requestedPaths: string[] = [];
    server.use(
      http.get('/vehicles/:vehicleId/actions', ({ request }) => {
        requestedPaths.push(new URL(request.url).pathname);
        return HttpResponse.json([READY_TO_WHOLESALE, PRICE_REDUCTION_OLDER]);
      }),
    );

    renderInventory('/inventory?vehicleId=veh_004');

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    const history = detailRegion(detail, 'Action history');
    await waitFor(() => expect(within(history).getAllByRole('listitem')).toHaveLength(2));

    const [newest, older] = within(history).getAllByRole('listitem');

    expect(newest).toHaveTextContent('Wholesale / Auction');
    expect(newest).toHaveTextContent('Alex Manager');
    expect(newest).toHaveTextContent('2026-05-20 14:30 UTC');
    expect(newest).toHaveTextContent('No note');

    expect(older).toHaveTextContent('Price Reduction');
    expect(older).toHaveTextContent('System Migration');
    expect(older).toHaveTextContent('2026-05-15 09:00 UTC');
    expect(older).toHaveTextContent('Review price after weekend campaign.');

    expect(requestedPaths).toContain('/vehicles/veh_004/actions');
  }, INTERACTION_TIMEOUT);

  it('renders the history in the order the server returned it instead of re-sorting it', async () => {
    useIsolatedMockBackend();
    server.use(
      http.get('/vehicles/:vehicleId/actions', () =>
        HttpResponse.json([PRICE_REDUCTION_OLDER, READY_TO_WHOLESALE]),
      ),
    );

    renderInventory('/inventory?vehicleId=veh_004');

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    const history = detailRegion(detail, 'Action history');
    await waitFor(() => expect(within(history).getAllByRole('listitem')).toHaveLength(2));

    // A client-side newest-first re-sort would put Wholesale / Auction first.
    const [first, second] = within(history).getAllByRole('listitem');
    expect(first).toHaveTextContent('Price Reduction');
    expect(second).toHaveTextContent('Wholesale / Auction');
  }, INTERACTION_TIMEOUT);
});

describe('T05 — Dynamic-status form seam (ACT-008)', () => {
  it('populates the create-action status options from the active statuses endpoint only', async () => {
    useIsolatedMockBackend();
    server.use(
      http.get('/vehicle-action-statuses', () =>
        HttpResponse.json([
          {
            id: 'status_wholesale_auction',
            code: 'WHOLESALE_AUCTION',
            label: 'Wholesale / Auction',
            isActive: true,
            sortOrder: 2,
          },
          {
            id: 'status_legacy_hold',
            code: 'LEGACY_HOLD',
            label: 'Legacy Hold (Discontinued)',
            isActive: false,
            sortOrder: 5,
          },
          {
            id: 'status_price_reduction',
            code: 'PRICE_REDUCTION',
            label: 'Price Reduction',
            isActive: true,
            sortOrder: 1,
          },
        ]),
      ),
    );

    renderInventory('/inventory?vehicleId=veh_004');

    const detail = await screen.findByRole('dialog', { name: /vehicle detail/i });
    const form = detailRegion(detail, 'Record an action');
    const statusSelect = within(form).getByLabelText('Action status');

    await waitFor(() => {
      expect(within(statusSelect).getAllByRole('option')).toHaveLength(2);
    });
    expect(
      within(statusSelect)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Wholesale / Auction', 'Price Reduction']);
    expect(within(statusSelect).queryByRole('option', { name: /Legacy Hold/ })).toBeNull();
  }, INTERACTION_TIMEOUT);
});
