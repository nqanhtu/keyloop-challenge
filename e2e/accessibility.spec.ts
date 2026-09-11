import { test, expect, type Locator } from '@playwright/test';
import {
  APP_READY_TIMEOUT_MS,
  AGING_VEHICLE,
  NON_AGING_VEHICLE,
  CREATED_ACTION_STATUS_ID,
  detailsButton,
  gotoInventory,
  openFilterSheet,
  openDashboard,
  reloadInventory,
  vehicleDetail,
} from './support/journey';

/**
 * The documented minimum interactive target size for this challenge: WCAG 2.2
 * Success Criterion 2.5.8 "Target Size (Minimum)" at Level AA, 24 x 24 CSS px.
 */
const MIN_TARGET_SIZE = 24;

async function isFocused(locator: Locator): Promise<boolean> {
  return locator.evaluate((element) => element === document.activeElement);
}

/** System Design 6.10: visible focus, not a focus that cannot be seen. */
async function expectVisibleFocus(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  const visible = await locator.evaluate((element) => {
    const style = window.getComputedStyle(element);
    const hasOutline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 1;
    const hasRing = style.boxShadow !== 'none';
    return element.matches(':focus-visible') && (hasOutline || hasRing);
  });
  expect(visible).toBe(true);
}

async function collectUndersizedTargets(scope: Locator): Promise<string[]> {
  const controls = scope.locator(
    'button, a[href], select, textarea, input:not([type="hidden"])',
  );
  const count = await controls.count();
  const violations: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) {
      continue;
    }
    const box = await control.boundingBox();
    if (!box) {
      continue;
    }
    if (box.width < MIN_TARGET_SIZE || box.height < MIN_TARGET_SIZE) {
      const label = await control.evaluate((element) => {
        const id = element.id ? `#${element.id}` : '';
        const name = element.getAttribute('aria-label');
        return `${element.tagName.toLowerCase()}${id}${name ? `[${name}]` : ''}`;
      });
      violations.push(`${label} -> ${Math.round(box.width)}x${Math.round(box.height)}px`);
    }
  }

  return violations;
}

test('primary controls are keyboard-operable with visible focus and focus returns after close', async ({
  page,
}) => {
  await openDashboard(page);

  // The first two tabs reach the toolbar controls with visible focus.
  await page.keyboard.press('Tab');
  const sort = page.locator('#inventory-sort');
  await expectVisibleFocus(sort);

  await page.keyboard.press('Tab');
  const agingToggle = page.locator('#inventory-aging-only');
  await expectVisibleFocus(agingToggle);

  // Reach the aging vehicle's detail control by keyboard alone.
  const details = detailsButton(page, AGING_VEHICLE);
  let reached = await isFocused(details);
  for (let attempt = 0; attempt < 80 && !reached; attempt += 1) {
    await page.keyboard.press('Tab');
    reached = await isFocused(details);
  }
  expect(reached).toBe(true);
  await expectVisibleFocus(details);

  // Activate by keyboard and confirm focus moves into the dialog.
  await page.keyboard.press('Enter');
  const detail = vehicleDetail(page);
  await expect(detail).toBeVisible();
  await expect(detail.getByRole('button', { name: 'Close vehicle detail' })).toBeFocused();

  // Closing returns focus to the control that opened the detail.
  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  await expect(details).toBeFocused();
});

test('the action form reports validation accessibly with an announced, described error', async ({
  page,
}) => {
  await openDashboard(page);

  // A present but non-aging vehicle is rejected by the create-action contract.
  await gotoInventory(page, `?vehicleId=${NON_AGING_VEHICLE.vehicleId}`);
  const detail = vehicleDetail(page);
  await expect(detail).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });

  const form = detail.locator('form.create-action-form');
  await form.getByLabel('Action status').selectOption(CREATED_ACTION_STATUS_ID);
  await form.getByRole('button', { name: 'Record action' }).click();

  const alert = form.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/not aging/i);

  // The error is announced and programmatically associated with the form.
  const describedBy = await form.getAttribute('aria-describedby');
  expect(describedBy).not.toBeNull();
  await expect(detail.locator(`#${describedBy as string}`)).toHaveAttribute('role', 'alert');
});

test('interactive controls meet the documented minimum target size', async ({ page }) => {
  const tier = await openDashboard(page);

  // Reveal the removable filter chip so its control is measured too.
  await page.locator('#inventory-aging-only').check();
  await expect(page.getByRole('button', { name: 'Remove Aging only filter' })).toBeVisible();
  expect(await collectUndersizedTargets(page.locator('body'))).toEqual([]);

  // Tablet and mobile move the filters into an adaptive sheet, so its controls
  // must meet the same minimum size. Desktop keeps them inline (already
  // measured above).
  if (tier !== 'desktop') {
    const sheet = await openFilterSheet(page);
    expect(await collectUndersizedTargets(sheet)).toEqual([]);
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toBeHidden();
  }

  // Measure the create-action controls exposed by the detail surface.
  await gotoInventory(page, `?vehicleId=${AGING_VEHICLE.vehicleId}`);
  const detail = vehicleDetail(page);
  await expect(detail).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });
  expect(await collectUndersizedTargets(detail)).toEqual([]);
});

test('closing a detail opened without a click keeps focus off the page body', async ({ page }) => {
  await openDashboard(page);

  // Direct URL open: there is no click, so no opener is captured.
  await gotoInventory(page, `?vehicleId=${AGING_VEHICLE.vehicleId}`);
  await expect(vehicleDetail(page)).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });

  // Reload reproduces the same non-click open path (browser back/forward too):
  // the URL still selects the vehicle, but no opener was ever captured.
  await reloadInventory(page);
  await expect(vehicleDetail(page)).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });
  const closeButton = page.getByRole('button', { name: 'Close vehicle detail' });
  await expect(closeButton).toBeFocused();

  await closeButton.click();
  await expect(vehicleDetail(page)).toBeHidden();

  // Focus must land on a sensible element, never <body>. The list renders the
  // selected vehicle's trigger behind the detail, so focus is restored to it
  // even though the opener was never captured.
  expect(await page.evaluate(() => document.activeElement?.tagName ?? 'NONE')).not.toBe('BODY');
  await expect(detailsButton(page, AGING_VEHICLE)).toBeFocused();

  // Closing and reopening via a direct URL keeps the guarantee.
  await gotoInventory(page, `?vehicleId=${AGING_VEHICLE.vehicleId}`);
  await expect(vehicleDetail(page)).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });
  await page.getByRole('button', { name: 'Close vehicle detail' }).click();
  await expect(vehicleDetail(page)).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.tagName ?? 'NONE')).not.toBe('BODY');
  await expect(detailsButton(page, AGING_VEHICLE)).toBeFocused();
});

/**
 * U06 RP-1 (UI §17.8, §18, §13.4): while a modal surface is open, Tab and
 * Shift+Tab cycle inside it, the background subtree is inert, and closing still
 * restores focus to the trigger. This is additive to the existing focus
 * assertions above, which are unchanged.
 */
test('modal surfaces contain focus and make the background subtree inert', async ({ page }) => {
  const tier = await openDashboard(page);

  const isInert = () =>
    page
      .locator('.inventory-dashboard__page')
      .evaluate((element) => element.hasAttribute('inert'));
  const activeInsideDialog = () =>
    page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')));

  // Detail surface: aria-modal="true" with a full-viewport scrim.
  await gotoInventory(page, `?vehicleId=${AGING_VEHICLE.vehicleId}`);
  const detail = vehicleDetail(page);
  await expect(detail).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });
  expect(await isInert()).toBe(true);

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    expect(await activeInsideDialog()).toBe(true);
  }
  for (let index = 0; index < 6; index += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await activeInsideDialog()).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(detail).toBeHidden();
  expect(await isInert()).toBe(false);

  if (tier === 'desktop') {
    return;
  }

  // Filter sheet: modal at the tablet and mobile tiers.
  const sheet = await openFilterSheet(page);
  expect(await isInert()).toBe(true);
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    expect(await activeInsideDialog()).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  expect(await isInert()).toBe(false);
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toBeFocused();
});
