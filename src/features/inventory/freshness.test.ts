import { describe, expect, it } from 'vitest';
import {
  FRESHNESS_WARNING_THRESHOLD_MS,
  computeFreshness,
  formatSyncInstant,
} from './freshness';

const SYNCED_AT = '2026-06-01T12:00:00Z';

describe('T06 — Sync freshness seam (UI-STATE-004)', () => {
  it('uses a 30 minute demo freshness threshold by default', () => {
    expect(FRESHNESS_WARNING_THRESHOLD_MS).toBe(30 * 60 * 1000);
  });

  it('does not warn while the sync lag stays within the threshold', () => {
    const freshness = computeFreshness({
      lastSuccessfulSyncAt: SYNCED_AT,
      now: Date.parse('2026-06-01T12:29:00Z'),
    });

    expect(freshness).not.toBeNull();
    expect(freshness?.syncLagMs).toBe(29 * 60 * 1000);
    expect(freshness?.isStale).toBe(false);
    expect(freshness?.warning).toBeUndefined();
    expect(freshness?.lastUpdatedLabel).toBe('Last updated 2026-06-01 12:00 UTC');
  });

  it('does not warn exactly at the threshold and warns once the lag exceeds it', () => {
    const atThreshold = computeFreshness({
      lastSuccessfulSyncAt: SYNCED_AT,
      now: Date.parse('2026-06-01T12:30:00Z'),
    });
    const pastThreshold = computeFreshness({
      lastSuccessfulSyncAt: SYNCED_AT,
      now: Date.parse('2026-06-01T12:31:00Z'),
    });

    expect(atThreshold?.isStale).toBe(false);
    expect(pastThreshold?.isStale).toBe(true);
    expect(pastThreshold?.warning).toMatch(/may be outdated/i);
  });

  it('computes sync lag from the current time and the last successful sync', () => {
    const freshness = computeFreshness({
      lastSuccessfulSyncAt: SYNCED_AT,
      now: Date.parse('2026-06-01T14:00:00Z'),
    });

    expect(freshness?.syncLagMs).toBe(2 * 60 * 60 * 1000);
  });

  it('returns no freshness state when the server has not reported a sync', () => {
    expect(computeFreshness({ lastSuccessfulSyncAt: null, now: Date.now() })).toBeNull();
    expect(computeFreshness({ lastSuccessfulSyncAt: 'not-a-timestamp', now: Date.now() })).toBeNull();
  });

  it('formats a sync instant as an explicit UTC label', () => {
    expect(formatSyncInstant(SYNCED_AT)).toBe('2026-06-01 12:00 UTC');
  });
});
