import { test, expect } from '@playwright/test';
import {
  AGING_VEHICLE,
  detailsButton,
  filterSheet,
  openDashboard,
  vehicleDetail,
} from './support/journey';
import { DETAIL_VARIANT_BY_TIER } from './support/tiers';

/**
 * System Design 6.3 / 6.4 / 6.5: each viewport renders and operates its
 * documented presentation. Runs once per project.
 */
test('renders and operates the documented responsive presentation', async ({ page }) => {
  const tier = await openDashboard(page);

  if (tier === 'desktop') {
    // Full table plus inline filters.
    const table = page.locator('table[data-density="full"]');
    await expect(table).toBeVisible();
    await expect(page.getByRole('form', { name: 'Inventory filters' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filters' })).toHaveCount(0);
    await expect(table.getByRole('columnheader', { name: 'VIN' })).toBeVisible();
  }

  if (tier === 'tablet') {
    // Compact table drops lower-priority fields; filters move into a sheet.
    const table = page.locator('table[data-density="compact"]');
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Age (days)' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'VIN' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Filters' }).click();
    const sheet = filterSheet(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('#inventory-filter-make')).toBeVisible();
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toBeHidden();
  }

  if (tier === 'mobile') {
    // Card list prioritizes identity, age, aging status, and current action.
    const cards = page.getByRole('list', { name: 'Inventory vehicles' });
    await expect(cards).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
    await expect(cards.getByRole('listitem').first()).toContainText('Aging');

    await page.getByRole('button', { name: 'Filters' }).click();
    const sheet = filterSheet(page);
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('#inventory-filter-make')).toBeVisible();
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toBeHidden();
  }

  // The master-detail modality matches the tier.
  await detailsButton(page, AGING_VEHICLE).click();
  const detail = vehicleDetail(page);
  await expect(detail).toHaveAttribute('data-variant', DETAIL_VARIANT_BY_TIER[tier]);

  // The rendered layout must also match the documented modality, so a CSS
  // regression fails the proof instead of only the data attribute drifting.
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error('The browser proof requires a fixed viewport per project.');
  }
  const bounds = await detail.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });

  if (tier === 'desktop') {
    // Right-side drawer: flush to the right viewport edge, leaving a left gap,
    // and materially narrower than the viewport.
    expect(Math.abs(bounds.x + bounds.width - viewport.width)).toBeLessThanOrEqual(2);
    expect(bounds.x).toBeGreaterThanOrEqual(viewport.width * 0.4);
    expect(bounds.width).toBeLessThan(viewport.width * 0.9);
  }

  if (tier === 'tablet') {
    // Adaptive wide sheet: centred with equal side gaps, strictly narrower than
    // the viewport, and not full height.
    expect(bounds.width).toBeLessThan(viewport.width);
    expect(bounds.width).toBeLessThanOrEqual(viewport.width * 0.95);
    const leftGap = bounds.x;
    const rightGap = viewport.width - (bounds.x + bounds.width);
    expect(leftGap).toBeGreaterThan(0);
    expect(rightGap).toBeGreaterThan(0);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(4);
    expect(bounds.height).toBeLessThan(viewport.height);
  }

  if (tier === 'mobile') {
    // Full-screen detail: covers the whole viewport.
    expect(Math.abs(bounds.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.width - viewport.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.height - viewport.height)).toBeLessThanOrEqual(1);
  }
});
