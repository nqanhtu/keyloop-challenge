import { defineConfig, devices } from '@playwright/test';

/**
 * Representative viewports for the three documented responsive tiers
 * (System Design 6.3). The widths mirror the breakpoints in
 * src/features/inventory/use-viewport-tier.ts so each project renders exactly
 * one tier: mobile < 768, tablet 768-1023, desktop >= 1024.
 */
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };
const TABLET_VIEWPORT = { width: 834, height: 1112 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  // The browser proof drives the full dashboard (MSW + TanStack Query), so keep
  // a load-tolerant ceiling without weakening any assertion (INC-001). The
  // assertions themselves are unchanged; only the wait ceilings grow so a slow
  // MSW worker start or query resolution cannot masquerade as a product defect.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: DESKTOP_VIEWPORT },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: TABLET_VIEWPORT, hasTouch: true },
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: MOBILE_VIEWPORT, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // Boot the documented dev server with the same load tolerance as the specs:
    // host contention must not fail the proof before a single assertion runs.
    timeout: 120_000,
  },
});
