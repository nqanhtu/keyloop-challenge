import { expect, type Locator, type Page } from '@playwright/test';
import { resolveTier, type ViewportTier } from './tiers';

/** The canonical dashboard route rendered by src/app/router.tsx. */
export const DASHBOARD_PATH = '/inventory';

/** System Design 6.11: manager actions persist in browser storage under this key. */
export const ACTIONS_STORAGE_KEY = 'keyloop:mock:vehicle-actions:v1';

export interface VehicleIdentity {
  vehicleId: string;
  make: string;
  model: string;
  vin: string;
}

/**
 * Deterministic fixtures (src/mocks/inventory/fixtures.ts). Aging is derived
 * against the fixed reference instant 2026-06-01T12:00:00Z, so these stay
 * stable: veh_001 is 91 days (aging, no current action); veh_002 is 90 days
 * (present but not aging, so the create-action contract rejects it).
 */
export const AGING_VEHICLE: VehicleIdentity = {
  vehicleId: 'veh_001',
  make: 'BMW',
  model: 'X5',
  vin: '1HGCR2F83HA000001',
};

export const NON_AGING_VEHICLE: VehicleIdentity = {
  vehicleId: 'veh_002',
  make: 'BMW',
  model: '3 Series',
  vin: '1HGCR2F83HA000002',
};

export const CREATED_ACTION_STATUS_ID = 'status_wholesale_auction';
export const CREATED_ACTION_STATUS_LABEL = 'Wholesale / Auction';
export const CREATED_ACTION_NOTE = 'Browser proof: recorded during the primary manager journey.';

/**
 * src/main.tsx starts the MSW browser worker before React renders, so under host
 * load the first paint can arrive well after `goto` resolves. Every navigation
 * waits for this mount signal, and the ceiling is load-tolerant, so a slow
 * worker start is never mistaken for a product failure (INC-001 load class).
 */
export const APP_READY_TIMEOUT_MS = 30_000;

/**
 * Stable app-ready signal: the dashboard heading and the inventory results
 * region only exist once the app has mounted and the first query resolved.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name: /keyloop inventory command center/i }),
  ).toBeVisible({ timeout: APP_READY_TIMEOUT_MS });
  await expect(page.getByRole('region', { name: 'Inventory results' })).toBeVisible({
    timeout: APP_READY_TIMEOUT_MS,
  });
}

/** Navigate to an inventory route and wait until the app has mounted. */
export async function gotoInventory(page: Page, search = ''): Promise<void> {
  await page.goto(`${DASHBOARD_PATH}${search}`);
  await waitForAppReady(page);
}

/** Reload the current inventory route and wait until the app has mounted again. */
export async function reloadInventory(page: Page): Promise<void> {
  await page.reload();
  await waitForAppReady(page);
}

export async function openDashboard(page: Page): Promise<ViewportTier> {
  await gotoInventory(page);
  return resolveTier(page);
}

export function detailsButton(page: Page, vehicle: VehicleIdentity): Locator {
  return page.getByRole('button', {
    name: `View details for ${vehicle.make} ${vehicle.model} (${vehicle.vin})`,
  });
}

export function vehicleDetail(page: Page): Locator {
  return page.getByRole('dialog', { name: /vehicle detail/i });
}

export function filterSheet(page: Page): Locator {
  return page.getByRole('dialog', { name: 'Inventory filters' });
}

/** Tablet/mobile hide inline filters behind the adaptive filter sheet (6.4). */
export async function openFilterSheet(page: Page): Promise<Locator> {
  // `exact` keeps this unambiguous once an active filter adds the
  // "Clear all filters" control.
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  const sheet = filterSheet(page);
  await expect(sheet).toBeVisible();
  return sheet;
}

export async function applyMakeFilter(
  page: Page,
  tier: ViewportTier,
  make: string,
): Promise<void> {
  if (tier === 'desktop') {
    await page.locator('#inventory-filter-make').selectOption(make);
  } else {
    const sheet = await openFilterSheet(page);
    await sheet.locator('#inventory-filter-make').selectOption(make);
    await sheet.getByRole('button', { name: 'Done' }).click();
    await expect(sheet).toBeHidden();
  }
  // The filter is URL-owned (System Design 6.1), so the address is the proof.
  await expect(page).toHaveURL(new RegExp(`make=${make}`));
}
