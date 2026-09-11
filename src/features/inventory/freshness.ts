/**
 * System Design 8.2 / 8.5: `syncLag = current time - lastSuccessfulSyncAt`.
 * When the lag exceeds the configured freshness threshold the dashboard raises
 * an operational signal and communicates that inventory may be outdated while
 * still presenting the last successfully synchronized inventory.
 *
 * The 30 minute threshold is the accepted demo default (Decision 0001), not
 * production business policy.
 */
export const FRESHNESS_WARNING_THRESHOLD_MS = 30 * 60 * 1000;

export const OUTDATED_INVENTORY_WARNING =
  'Inventory may be outdated. Showing the last successfully synchronized inventory.';

export interface FreshnessInput {
  lastSuccessfulSyncAt?: string | null;
  /** Controllable current time in epoch milliseconds. */
  now: number;
  thresholdMs?: number;
}

export interface FreshnessState {
  lastSuccessfulSyncAt: string;
  syncLagMs: number;
  thresholdMs: number;
  isStale: boolean;
  lastUpdatedLabel: string;
  warning?: string;
}

/** Renders a stored UTC instant explicitly instead of applying local time. */
export function formatSyncInstant(instant: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(instant);
  return match ? `${match[1]} ${match[2]} UTC` : instant;
}

/**
 * Derives the freshness signal from server-provided sync metadata. Returns
 * `null` when the server has not reported a usable sync instant, so the
 * dashboard never invents freshness state.
 */
export function computeFreshness(input: FreshnessInput): FreshnessState | null {
  const { lastSuccessfulSyncAt, now, thresholdMs = FRESHNESS_WARNING_THRESHOLD_MS } = input;

  if (!lastSuccessfulSyncAt) {
    return null;
  }

  const syncedAtMs = Date.parse(lastSuccessfulSyncAt);
  if (!Number.isFinite(syncedAtMs)) {
    return null;
  }

  const syncLagMs = Math.max(0, now - syncedAtMs);
  const isStale = syncLagMs > thresholdMs;

  return {
    lastSuccessfulSyncAt,
    syncLagMs,
    thresholdMs,
    isStale,
    lastUpdatedLabel: `Last updated ${formatSyncInstant(lastSuccessfulSyncAt)}`,
    warning: isStale ? OUTDATED_INVENTORY_WARNING : undefined,
  };
}
