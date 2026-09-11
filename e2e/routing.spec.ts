import { test, expect } from '@playwright/test';
import { waitForAppReady } from './support/journey';

/**
 * Approved routing decision: opening the app root must show the inventory
 * dashboard, while `/inventory` stays the single canonical dashboard URL. One
 * spec, executed once per project, so the redirect is proven at every
 * documented viewport tier.
 */
test('app root resolves to the canonical /inventory dashboard', async ({ page }) => {
  await page.goto('/');
  await waitForAppReady(page);

  await expect(page).toHaveURL(/\/inventory$/);
  await expect(
    page.getByRole('heading', { level: 1, name: /keyloop inventory command center/i }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Inventory results' })).toBeVisible();
});

test('app root carries a query string through the redirect', async ({ page }) => {
  await page.goto('/?agingOnly=true');
  await waitForAppReady(page);

  await expect(page).toHaveURL(/\/inventory\?agingOnly=true$/);
  await expect(page.getByRole('checkbox', { name: 'Aging only' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Remove Aging only filter' })).toBeVisible();
});
