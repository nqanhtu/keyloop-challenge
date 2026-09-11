import { expect, test, type Page } from '@playwright/test';
import { openDashboard, reloadInventory } from './support/journey';
import type { ViewportTier } from './support/tiers';

/**
 * Decision 0004 / UI System Design §11.1, §13: page size is URL-owned and
 * user-selectable, so the same journey is proven at each presentation tier.
 * The mobile tier renders cards instead of a table, so the "rendered rows"
 * locator follows the tier's documented modality.
 */
function renderedRows(page: Page, tier: ViewportTier) {
  if (tier === 'mobile') {
    return page.getByRole('list', { name: 'Inventory vehicles' }).getByRole('listitem');
  }
  const density = tier === 'tablet' ? 'compact' : 'full';
  return page.locator(`table[data-density="${density}"] tbody tr`);
}

test('the URL-owned page size changes the rendered rows, survives reload, and restores the default', async ({
  page,
}) => {
  const tier = await openDashboard(page);

  const select = page.getByLabel('Rows per page');
  await expect(select).toHaveValue('50');

  // Select 25: the URL owns the value and the rendered page shrinks with it.
  await select.selectOption('25');
  await expect(page).toHaveURL(/pageSize=25/);
  await expect(page.getByTestId('pagination-status')).toHaveText('Page 1 of 3');
  await expect(renderedRows(page, tier)).toHaveCount(25);

  // Reload: the URL still carries the selection, so the page is the same.
  await reloadInventory(page);
  await expect(page.getByLabel('Rows per page')).toHaveValue('25');
  await expect(page).toHaveURL(/pageSize=25/);
  await expect(renderedRows(page, tier)).toHaveCount(25);

  // Restore the default: 50 is the default and is omitted from the URL.
  await page.getByLabel('Rows per page').selectOption('50');
  await expect(page).not.toHaveURL(/pageSize=/);
  await expect(renderedRows(page, tier)).toHaveCount(50);
});
