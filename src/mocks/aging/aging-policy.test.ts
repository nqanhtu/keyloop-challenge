import { describe, it, expect } from 'vitest';
import { calculateAging } from './aging-policy';

describe('Aging Policy Seam (AGE-001, TEST-002, Gate B)', () => {
  it('strictly classifies 89 days as not aging', () => {
    // 2026-03-04 to 2026-06-01 is exactly 89 calendar days
    const stockedAt = '2026-03-04T12:00:00Z';
    const currentInstant = '2026-06-01T12:00:00Z';
    const result = calculateAging({
      stockedAt,
      currentInstant,
      timeZone: 'UTC',
    });

    expect(result.inventoryAgeDays).toBe(89);
    expect(result.isAging).toBe(false);
  });

  it('strictly classifies 90 days as not aging', () => {
    // 2026-03-03 to 2026-06-01 is exactly 90 calendar days
    const stockedAt = '2026-03-03T12:00:00Z';
    const currentInstant = '2026-06-01T12:00:00Z';
    const result = calculateAging({
      stockedAt,
      currentInstant,
      timeZone: 'UTC',
    });

    expect(result.inventoryAgeDays).toBe(90);
    expect(result.isAging).toBe(false);
  });

  it('strictly classifies 91 days as aging (inventoryAgeDays > 90)', () => {
    // 2026-03-02 to 2026-06-01 is exactly 91 calendar days
    const stockedAt = '2026-03-02T12:00:00Z';
    const currentInstant = '2026-06-01T12:00:00Z';
    const result = calculateAging({
      stockedAt,
      currentInstant,
      timeZone: 'UTC',
    });

    expect(result.inventoryAgeDays).toBe(91);
    expect(result.isAging).toBe(true);
  });

  it('calculates calendar days using dealership timezone across UTC midnight boundaries', () => {
    // Stocked at 19:30 EDT on 2026-06-01 (UTC: 2026-06-01T23:30:00Z)
    const stockedAt = '2026-06-01T23:30:00Z';
    // Current instant at 22:00 EDT on 2026-06-01 (UTC: 2026-06-02T02:00:00Z)
    const currentInstant = '2026-06-02T02:00:00Z';

    // In UTC, the date crossed midnight from 2026-06-01 to 2026-06-02 (1 UTC day).
    // In America/New_York (EDT, UTC-4), both instants remain on 2026-06-01.
    const resultNewYork = calculateAging({
      stockedAt,
      currentInstant,
      timeZone: 'America/New_York',
    });

    expect(resultNewYork.inventoryAgeDays).toBe(0);
    expect(resultNewYork.isAging).toBe(false);

    // Contrasting with UTC calculation which has crossed midnight:
    const resultUtc = calculateAging({
      stockedAt,
      currentInstant,
      timeZone: 'UTC',
    });
    expect(resultUtc.inventoryAgeDays).toBe(1);
  });
});
