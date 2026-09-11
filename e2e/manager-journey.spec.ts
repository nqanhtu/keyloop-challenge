import { test, expect } from '@playwright/test';
import {
  ACTIONS_STORAGE_KEY,
  AGING_VEHICLE,
  APP_READY_TIMEOUT_MS,
  CREATED_ACTION_NOTE,
  CREATED_ACTION_STATUS_ID,
  CREATED_ACTION_STATUS_LABEL,
  applyMakeFilter,
  detailsButton,
  openDashboard,
  reloadInventory,
  vehicleDetail,
} from './support/journey';
import { DETAIL_VARIANT_BY_TIER } from './support/tiers';

/**
 * System Design 9.3 / Gate D: the primary manager journey in a real browser.
 * One spec, executed once per project, so desktop, tablet, and mobile are each
 * proven against their own presentation.
 */
test('primary manager journey: filter, open aging vehicle, record action, reload, persist', async ({
  page,
}) => {
  const tier = await openDashboard(page);

  // Filter inventory.
  await applyMakeFilter(page, tier, AGING_VEHICLE.make);
  await expect(page.getByRole('button', { name: 'Remove Make filter' })).toBeVisible();

  // Select an aging vehicle and open its detail.
  const details = detailsButton(page, AGING_VEHICLE);
  await expect(details).toBeVisible();
  await details.click();

  const detail = vehicleDetail(page);
  await expect(detail).toBeVisible();
  await expect(detail).toHaveAttribute('data-variant', DETAIL_VARIANT_BY_TIER[tier]);

  const summary = detail.getByRole('region', { name: 'Vehicle summary' });
  await expect(summary).toContainText(AGING_VEHICLE.vin);
  await expect(summary.getByText('AGING', { exact: true })).toBeVisible();

  const currentAction = detail.getByRole('region', { name: 'Current action' });
  const history = detail.getByRole('region', { name: 'Action history' });
  await expect(currentAction).toContainText('No current action');
  await expect(history).toContainText('No actions recorded yet.');

  // Create an action.
  await detail.getByLabel('Action status').selectOption(CREATED_ACTION_STATUS_ID);
  await detail.getByLabel('Note (optional)').fill(CREATED_ACTION_NOTE);
  await detail.getByRole('button', { name: 'Record action' }).click();

  // The authoritative response becomes the current action and appends history.
  await expect(currentAction).toContainText(CREATED_ACTION_STATUS_LABEL);
  await expect(currentAction).toContainText(CREATED_ACTION_NOTE);
  await expect(history.getByRole('listitem')).toHaveCount(1);
  await expect(history.getByRole('listitem').first()).toContainText(CREATED_ACTION_STATUS_LABEL);
  await expect(history.getByRole('listitem').first()).toContainText(CREATED_ACTION_NOTE);

  // Reload the browser: discovery and detail selection are URL state, and the
  // created action is read back from the persisted mock layer.
  await reloadInventory(page);
  const reopened = vehicleDetail(page);
  await expect(reopened).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });
  await expect(reopened.getByRole('region', { name: 'Current action' })).toContainText(
    CREATED_ACTION_NOTE,
  );
  await expect(
    reopened.getByRole('region', { name: 'Action history' }).getByRole('listitem'),
  ).toHaveCount(1);

  const persisted = await page.evaluate(
    (storageKey) => window.localStorage.getItem(storageKey),
    ACTIONS_STORAGE_KEY,
  );
  expect(persisted).toContain(CREATED_ACTION_NOTE);
});
