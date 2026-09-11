import { isApiError } from '../../api';

/**
 * System Design 8.1 / 8.2: the frontend owns a client instrumentation boundary
 * that reports client errors and Web Vitals through an injectable sink. The
 * real telemetry backend is design-only, so the boundary is the contract and
 * the sink is supplied by the host application (a no-op sink by default).
 *
 * Note exclusion: the report shapes below intentionally carry only stable
 * machine-readable fields. There is no field for free-text content, and the
 * normalization step never copies an error message, `details`, request body,
 * or action note into a report, so free-text action notes cannot reach
 * telemetry or general application logs through this boundary.
 */

export type ClientErrorSource = 'api' | 'mutation' | 'render' | 'global' | 'unknown';

export interface ClientErrorReport {
  readonly type: 'client_error';
  readonly code: string;
  readonly requestId?: string;
  readonly endpoint?: string;
  readonly status?: number;
  readonly source: ClientErrorSource;
}

export type WebVitalName = 'CLS' | 'FCP' | 'INP' | 'LCP' | 'TTFB';
export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

export interface WebVitalMetric {
  readonly type: 'web_vital';
  readonly name: WebVitalName;
  readonly value: number;
  readonly rating: WebVitalRating;
}

export type WebVitalReport = Omit<WebVitalMetric, 'type'>;

export interface InstrumentationSink {
  reportClientError(report: ClientErrorReport): void;
  reportWebVitals(metric: WebVitalMetric): void;
}

export interface ClientErrorContext {
  source?: ClientErrorSource;
  endpoint?: string;
}

export interface ClientInstrumentation {
  reportClientError(error: unknown, context?: ClientErrorContext): void;
  reportWebVitals(metric: WebVitalReport): void;
}

const UNEXPECTED_CLIENT_ERROR_CODE = 'UNEXPECTED_CLIENT_ERROR';

/**
 * Normalizes an arbitrary failure into the allowlisted report shape. Only the
 * stable contract fields (code, request id, status) survive; free-text messages
 * and `details` payloads are deliberately dropped.
 */
export function toClientErrorReport(
  error: unknown,
  context: ClientErrorContext = {},
): ClientErrorReport {
  const source = context.source ?? 'unknown';

  if (isApiError(error)) {
    return {
      type: 'client_error',
      code: error.code,
      requestId: error.requestId,
      status: error.status,
      endpoint: context.endpoint,
      source,
    };
  }

  return {
    type: 'client_error',
    code: UNEXPECTED_CLIENT_ERROR_CODE,
    endpoint: context.endpoint,
    source,
  };
}

export function createClientInstrumentation(sink: InstrumentationSink): ClientInstrumentation {
  return {
    reportClientError(error, context) {
      sink.reportClientError(toClientErrorReport(error, context));
    },
    reportWebVitals(metric) {
      sink.reportWebVitals({ type: 'web_vital', ...metric });
    },
  };
}

export const noopInstrumentationSink: InstrumentationSink = {
  reportClientError() {},
  reportWebVitals() {},
};

/** Default boundary used when the host application does not inject a sink. */
export const defaultInstrumentation: ClientInstrumentation = createClientInstrumentation(
  noopInstrumentationSink,
);

type GlobalErrorTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

/**
 * System Design 8.1: uncaught client errors become structured reports. Only the
 * error object is inspected; the raw message string never leaves the boundary.
 */
export function installGlobalClientErrorReporting(
  instrumentation: ClientInstrumentation,
  target: GlobalErrorTarget | undefined = typeof window === 'undefined'
    ? undefined
    : window,
): () => void {
  if (!target) {
    return () => {};
  }

  const handleError = (event: ErrorEvent) => {
    instrumentation.reportClientError(event.error ?? event.message, { source: 'global' });
  };

  target.addEventListener('error', handleError);
  return () => target.removeEventListener('error', handleError);
}

export interface WebVitalsEntry {
  entryType: string;
  startTime: number;
  value?: number;
  hadRecentInput?: boolean;
}

export interface WebVitalsEntryList {
  getEntries(): WebVitalsEntry[];
}

export interface WebVitalsObserver {
  observe(options: { type: string; buffered?: boolean }): void;
  disconnect(): void;
}

export interface WebVitalsEnvironment {
  PerformanceObserver?: new (
    callback: (list: WebVitalsEntryList) => void,
  ) => WebVitalsObserver;
}

const OBSERVED_ENTRY_TYPES = [
  'first-contentful-paint',
  'largest-contentful-paint',
  'layout-shift',
] as const;

/** System Design 8.2: map the observed layout/paint entries to named metrics. */
function toWebVitalMetric(entry: WebVitalsEntry): WebVitalReport | null {
  switch (entry.entryType) {
    case 'first-contentful-paint':
      return {
        name: 'FCP',
        value: entry.startTime,
        rating: rateWebVital('FCP', entry.startTime),
      };
    case 'largest-contentful-paint':
      return {
        name: 'LCP',
        value: entry.startTime,
        rating: rateWebVital('LCP', entry.startTime),
      };
    case 'layout-shift':
      return {
        name: 'CLS',
        value: entry.value ?? 0,
        rating: rateWebVital('CLS', entry.value ?? 0),
      };
    default:
      return null;
  }
}

/** Standard Web Vitals "good" boundaries for a coarse, dependency-free rating. */
function rateWebVital(name: WebVitalName, value: number): WebVitalRating {
  switch (name) {
    case 'CLS':
      return value <= 0.1 ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor';
    case 'LCP':
      return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor';
    case 'FCP':
      return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor';
    case 'INP':
      return value <= 200 ? 'good' : value <= 500 ? 'needs-improvement' : 'poor';
    case 'TTFB':
      return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor';
  }
}

/**
 * Dependency-free Web Vitals observation. Environments without
 * `PerformanceObserver` (including most jsdom test runs) simply get a no-op
 * collector, so the boundary never breaks rendering.
 */
export function observeWebVitals(
  report: (metric: WebVitalReport) => void,
  environment: WebVitalsEnvironment = globalThis,
): () => void {
  const Observer = environment.PerformanceObserver;
  if (typeof Observer !== 'function') {
    return () => {};
  }

  const observer = new Observer((list) => {
    for (const entry of list.getEntries()) {
      const metric = toWebVitalMetric(entry);
      if (metric) {
        report(metric);
      }
    }
  });

  for (const type of OBSERVED_ENTRY_TYPES) {
    observer.observe({ type, buffered: true });
  }

  return () => observer.disconnect();
}
