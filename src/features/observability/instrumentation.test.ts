import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api';
import {
  createClientInstrumentation,
  installGlobalClientErrorReporting,
  observeWebVitals,
  type ClientErrorReport,
  type InstrumentationSink,
  type WebVitalMetric,
  type WebVitalsEntryList,
} from './instrumentation';

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

describe('T06 — Client instrumentation seam (OBS-001)', () => {
  it('reports an API failure through the stable code and request id only', () => {
    const sink = createRecordingSink();
    const instrumentation = createClientInstrumentation(sink);

    instrumentation.reportClientError(
      new ApiError(500, {
        code: 'INTERNAL_ERROR',
        message: 'Unhandled failure while recording the action',
        requestId: 'req_obs_1',
        details: { note: 'plain text note that must not travel' },
      }),
      { source: 'api', endpoint: '/vehicles/veh_001/actions' },
    );

    expect(sink.clientErrors).toHaveLength(1);
    const [report] = sink.clientErrors;
    expect(report).toEqual({
      type: 'client_error',
      code: 'INTERNAL_ERROR',
      requestId: 'req_obs_1',
      status: 500,
      endpoint: '/vehicles/veh_001/actions',
      source: 'api',
    });
    expect(JSON.stringify(report)).not.toContain('plain text note');
  });

  it('falls back to a stable code for a non-contract client failure', () => {
    const sink = createRecordingSink();
    const instrumentation = createClientInstrumentation(sink);

    instrumentation.reportClientError(new Error('boom'), { source: 'render' });

    expect(sink.clientErrors).toHaveLength(1);
    expect(sink.clientErrors[0]).toMatchObject({
      type: 'client_error',
      code: 'UNEXPECTED_CLIENT_ERROR',
      source: 'render',
    });
    expect(JSON.stringify(sink.clientErrors[0])).not.toContain('boom');
  });

  it('reports Web Vitals metrics to the injected sink', () => {
    const sink = createRecordingSink();
    const instrumentation = createClientInstrumentation(sink);

    instrumentation.reportWebVitals({ name: 'LCP', value: 1234, rating: 'good' });

    expect(sink.webVitals).toEqual([
      { type: 'web_vital', name: 'LCP', value: 1234, rating: 'good' },
    ]);
  });

  it('forwards window client errors to the sink without free-text payloads', () => {
    const sink = createRecordingSink();
    const instrumentation = createClientInstrumentation(sink);
    const uninstall = installGlobalClientErrorReporting(instrumentation, window);

    window.dispatchEvent(new ErrorEvent('error', { message: 'render blew up' }));

    expect(sink.clientErrors).toHaveLength(1);
    expect(sink.clientErrors[0].source).toBe('global');
    expect(JSON.stringify(sink.clientErrors[0])).not.toContain('render blew up');

    uninstall();
  });

  it('derives Web Vitals from observed performance entries when the browser supports it', () => {
    const reports: Array<Omit<WebVitalMetric, 'type'>> = [];
    let observedTypes: string[] = [];
    let disconnected = false;

    const environment = {
      PerformanceObserver: class {
        private readonly callback: (list: WebVitalsEntryList) => void;
        constructor(callback: (list: WebVitalsEntryList) => void) {
          this.callback = callback;
        }
        observe(options: { type: string }) {
          observedTypes = [...observedTypes, options.type];
          if (options.type !== 'largest-contentful-paint') {
            return;
          }
          this.callback({
            getEntries: () => [
              { entryType: 'largest-contentful-paint', name: '', startTime: 3000 },
            ],
          });
        }
        disconnect() {
          disconnected = true;
        }
      },
    };

    const stop = observeWebVitals((metric) => reports.push(metric), environment);

    expect(observedTypes).toContain('largest-contentful-paint');
    expect(reports).toContainEqual({ name: 'LCP', value: 3000, rating: 'needs-improvement' });

    stop();
    expect(disconnected).toBe(true);
  });

  it('is a no-op Web Vitals collector when the runtime has no PerformanceObserver', () => {
    const reports: Array<Omit<WebVitalMetric, 'type'>> = [];
    const stop = observeWebVitals((metric) => reports.push(metric), {});

    expect(reports).toEqual([]);
    expect(() => stop()).not.toThrow();
  });
});
