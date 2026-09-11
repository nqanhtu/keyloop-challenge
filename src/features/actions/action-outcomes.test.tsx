import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryHistory } from '@tanstack/react-router';
import { App } from '../../app/App';
import { createAppRouter } from '../../app/router';
import { server } from '../../mocks/server';
import { createTestQueryClient } from '../../test/test-utils';
import { useIsolatedMockBackend } from '../../test/mock-backend';
import {
  createClientInstrumentation,
  type ClientErrorReport,
  type ClientInstrumentation,
  type InstrumentationSink,
  type WebVitalMetric,
} from '../observability/instrumentation';

/** Heavy full-dashboard jsdom tests: keep an explicit ceiling (INC-001). */
const INTERACTION_TIMEOUT = 15_000;

const FIXED_CLOCK = () => '2026-06-01T12:00:00Z';
const FIXED_ID = () => 'act_created_t06';
const WITHIN_THRESHOLD_NOW = () => Date.parse('2026-06-01T12:10:00Z');

/** A distinctive free-text note used to prove note exclusion from telemetry. */
const DISTINCTIVE_NOTE = 'NOTE_T06_SECRET_7f3c9b1e-must-not-leak';

interface RecordingSink extends InstrumentationSink {
  clientErrors: ClientErrorReport[];
  webVitals: WebVitalMetric[];
}

function createRecordingSink(): RecordingSink {
  const sink: RecordingSink = {
    clientErrors: [],
    webVitals: [],
    reportClientError(report) {
      sink.clientErrors.push(report);
    },
    reportWebVitals(metric) {
      sink.webVitals.push(metric);
    },
  };
  return sink;
}

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

function detailRegion(detail: HTMLElement, label: string): HTMLElement {
  return within(detail).getByRole('region', { name: label });
}

async function openDetail(vin: string): Promise<HTMLElement> {
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

/** veh_002 is a 90 day old vehicle, so an action creation is a business rejection. */
async function submitActionFromDetail(
  user: ReturnType<typeof userEvent.setup>,
  detail: HTMLElement,
  note?: string,
) {
  if (note !== undefined) {
    await user.type(
      within(detailRegion(detail, 'Record an action')).getByLabelText('Note (optional)'),
      note,
    );
  }
  await user.click(within(detail).getByRole('button', { name: 'Record action' }));
}

const VEH_001_VIN = '1HGCR2F83HA000001';
const VEH_002_VIN = '1HGCR2F83HA000002';

describe('T06 — Stable error-code containment seam (ERR-002)', () => {
  it('contains an expected VEHICLE_NOT_AGING rejection to the action form region without telemetry', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });
    const sink = createRecordingSink();

    server.use(
      http.post('/vehicles/:vehicleId/actions', () =>
        HttpResponse.json(
          {
            code: 'VEHICLE_NOT_AGING',
            message: 'Vehicle veh_002 is not aging (> 90 days)',
            requestId: 'req_not_aging_1',
          },
          { status: 400 },
        ),
      ),
    );

    renderInventory('/inventory?vehicleId=veh_002', {
      now: WITHIN_THRESHOLD_NOW,
      instrumentation: createClientInstrumentation(sink),
    });

    const detail = await openDetail(VEH_002_VIN);
    await submitActionFromDetail(user, detail);

    const form = detailRegion(detail, 'Record an action');
    expect(await within(form).findByRole('alert')).toHaveTextContent(
      'Vehicle veh_002 is not aging (> 90 days)',
    );

    // Expected business rejection: contained regionally, not reported as an incident.
    expect(sink.clientErrors).toHaveLength(0);

    // The rest of the dashboard is unaffected.
    expect(within(detailRegion(detail, 'Current action')).getAllByText(/./).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    expect(inventoryRowFor(VEH_001_VIN)).toBeInTheDocument();
  }, INTERACTION_TIMEOUT);

  it('branches on the stable code rather than the message text', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });
    const sink = createRecordingSink();

    // Same human-readable message as the business rejection, different stable code.
    const sharedMessage = 'Vehicle veh_002 is not aging (> 90 days)';
    server.use(
      http.post('/vehicles/:vehicleId/actions', () =>
        HttpResponse.json(
          { code: 'INTERNAL_ERROR', message: sharedMessage, requestId: 'req_same_message_1' },
          { status: 500 },
        ),
      ),
    );

    renderInventory('/inventory?vehicleId=veh_002', {
      now: WITHIN_THRESHOLD_NOW,
      instrumentation: createClientInstrumentation(sink),
    });

    const detail = await openDetail(VEH_002_VIN);
    await submitActionFromDetail(user, detail);

    await waitFor(() => expect(sink.clientErrors).toHaveLength(1));
    expect(sink.clientErrors[0]).toEqual({
      type: 'client_error',
      code: 'INTERNAL_ERROR',
      requestId: 'req_same_message_1',
      status: 500,
      endpoint: '/vehicles/veh_002/actions',
      source: 'mutation',
    });
  }, INTERACTION_TIMEOUT);
});

describe('T06 — Instrumentation note-exclusion seam (OBS-001)', () => {
  it('never reports a free-text action note after a successful create', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });
    const sink = createRecordingSink();

    renderInventory('/inventory?vehicleId=veh_001', {
      now: WITHIN_THRESHOLD_NOW,
      instrumentation: createClientInstrumentation(sink),
    });

    const detail = await openDetail(VEH_001_VIN);
    await submitActionFromDetail(user, detail, DISTINCTIVE_NOTE);

    const history = detailRegion(detail, 'Action history');
    await waitFor(() => expect(within(history).getAllByRole('listitem')).toHaveLength(1));

    // The note is real product data (it renders) but never becomes telemetry.
    expect(within(history).getAllByRole('listitem')[0]).toHaveTextContent(DISTINCTIVE_NOTE);
    expect(sink.clientErrors).toHaveLength(0);
    expect(JSON.stringify(sink.clientErrors)).not.toContain(DISTINCTIVE_NOTE);
    expect(JSON.stringify(sink.webVitals)).not.toContain(DISTINCTIVE_NOTE);
  }, INTERACTION_TIMEOUT);

  it('never reports a free-text action note after a rollback, even when telemetry is emitted', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });
    const sink = createRecordingSink();

    server.use(
      http.post('/vehicles/:vehicleId/actions', () =>
        HttpResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: 'Action service unavailable',
            requestId: 'req_rollback_1',
          },
          { status: 500 },
        ),
      ),
    );

    renderInventory('/inventory?vehicleId=veh_001', {
      now: WITHIN_THRESHOLD_NOW,
      instrumentation: createClientInstrumentation(sink),
    });

    const detail = await openDetail(VEH_001_VIN);
    await submitActionFromDetail(user, detail, DISTINCTIVE_NOTE);

    const form = detailRegion(detail, 'Record an action');
    expect(await within(form).findByRole('alert')).toHaveTextContent('Action service unavailable');

    // Telemetry is genuinely emitted on this path, which makes the exclusion assertion meaningful.
    await waitFor(() => expect(sink.clientErrors).toHaveLength(1));
    expect(sink.clientErrors[0].code).toBe('INTERNAL_ERROR');

    const serialized = JSON.stringify([...sink.clientErrors, ...sink.webVitals]);
    expect(serialized).not.toContain(DISTINCTIVE_NOTE);
    expect(serialized).not.toContain('Action service unavailable');
  }, INTERACTION_TIMEOUT);
});

describe('T06 — Cross-feature coherence seam (ACT-010)', () => {
  it('keeps list, detail, history, and summary coherent after a successful create', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });

    renderInventory('/inventory?vehicleId=veh_001', { now: WITHIN_THRESHOLD_NOW });

    // The seeded action belongs to veh_004, so exactly one aging vehicle has an action.
    await waitFor(() => expect(screen.getByTestId('kpi-aging-with-action')).toHaveTextContent('1'));

    const detail = await openDetail(VEH_001_VIN);
    expect(detailRegion(detail, 'Current action')).toHaveTextContent('No current action');
    expect(within(detailRegion(detail, 'Action history')).queryAllByRole('listitem')).toHaveLength(0);

    await user.selectOptions(
      within(detailRegion(detail, 'Record an action')).getByLabelText('Action status'),
      'status_price_reduction',
    );
    await submitActionFromDetail(user, detail);

    await waitFor(() =>
      expect(within(detailRegion(detail, 'Action history')).getAllByRole('listitem')).toHaveLength(1),
    );
    expect(detailRegion(detail, 'Current action')).toHaveTextContent('Price Reduction');

    await waitFor(() => expect(inventoryRowFor(VEH_001_VIN)).toHaveTextContent('Price Reduction'));
    expect(inventoryRowFor(VEH_001_VIN)).not.toHaveTextContent('No current action');

    // The summary is a distinct server-state view of the same mutation.
    await waitFor(() => expect(screen.getByTestId('kpi-aging-with-action')).toHaveTextContent('2'));
    expect(screen.getByTestId('kpi-total-inventory')).toHaveTextContent('55');
  }, INTERACTION_TIMEOUT);

  it('keeps list, detail, history, and summary coherent after a rollback', async () => {
    const user = userEvent.setup({ delay: null });
    useIsolatedMockBackend({ clock: FIXED_CLOCK, idGenerator: FIXED_ID });

    server.use(
      http.post('/vehicles/:vehicleId/actions', () =>
        HttpResponse.json(
          {
            code: 'INTERNAL_ERROR',
            message: 'Action service unavailable',
            requestId: 'req_coherence_rollback_1',
          },
          { status: 500 },
        ),
      ),
    );

    renderInventory('/inventory?vehicleId=veh_001', { now: WITHIN_THRESHOLD_NOW });

    await waitFor(() => expect(screen.getByTestId('kpi-aging-with-action')).toHaveTextContent('1'));

    const detail = await openDetail(VEH_001_VIN);
    await submitActionFromDetail(user, detail);

    const form = detailRegion(detail, 'Record an action');
    expect(await within(form).findByRole('alert')).toHaveTextContent('Action service unavailable');

    // Every server-state view returns to the pre-submit value.
    await waitFor(() =>
      expect(detailRegion(detail, 'Current action')).toHaveTextContent('No current action'),
    );
    expect(within(detailRegion(detail, 'Action history')).queryAllByRole('listitem')).toHaveLength(0);
    expect(inventoryRowFor(VEH_001_VIN)).toHaveTextContent('No current action');
    expect(screen.getByTestId('kpi-aging-with-action')).toHaveTextContent('1');
  }, INTERACTION_TIMEOUT);
});
