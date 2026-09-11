import type { Page } from '@playwright/test';

/**
 * The three documented responsive tiers (System Design 6.3). The project
 * viewports in playwright.config.ts are chosen so each project renders exactly
 * one tier, and the breakpoints below mirror
 * src/features/inventory/use-viewport-tier.ts.
 */
export type ViewportTier = 'desktop' | 'tablet' | 'mobile';

export const TABLET_MIN_WIDTH = 768;
export const DESKTOP_MIN_WIDTH = 1024;

/** System Design 6.5: one master-detail surface with three modalities. */
export const DETAIL_VARIANT_BY_TIER: Record<ViewportTier, 'drawer' | 'sheet' | 'fullscreen'> = {
  desktop: 'drawer',
  tablet: 'sheet',
  mobile: 'fullscreen',
};

export function resolveTier(page: Page): ViewportTier {
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error('The browser proof requires a fixed viewport per project.');
  }
  if (viewport.width < TABLET_MIN_WIDTH) {
    return 'mobile';
  }
  if (viewport.width < DESKTOP_MIN_WIDTH) {
    return 'tablet';
  }
  return 'desktop';
}
