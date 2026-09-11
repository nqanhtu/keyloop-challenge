import { test, expect, type Page } from '@playwright/test';
import { gotoInventory, openDashboard } from './support/journey';

/**
 * U03 — Visual system proof (UI System Design §7.2, §8, §19).
 *
 * The deterministic responsive/accessibility gates live in the other specs;
 * this spec proves the semantic token layer is actually loaded and consumed by
 * a real element in each of the four documented surface families — canvas,
 * panel, raised/interactive, and semantic status.
 */

/** Resolves a CSS custom property the same way the browser resolves a component. */
async function resolveToken(page: Page, token: string, property: string): Promise<string> {
  return page.evaluate(
    ([tokenName, propertyName]) => {
      const probe = document.createElement('span');
      probe.style.setProperty(propertyName, `var(${tokenName})`);
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).getPropertyValue(propertyName);
      probe.remove();
      return value;
    },
    [token, property] as const,
  );
}

async function computed(page: Page, selector: string, property: string): Promise<string> {
  return page.locator(selector).first().evaluate(
    (element, propertyName) => getComputedStyle(element).getPropertyValue(propertyName),
    property,
  );
}

test('every surface family resolves its semantic token in the browser', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openDashboard(page);

  // Level 1 — canvas.
  expect(await computed(page, 'body', 'background-color')).toBe(
    await resolveToken(page, '--ui-canvas', 'background-color'),
  );

  // Level 2 — panel (KPI card).
  expect(await computed(page, '.kpi-card', 'background-color')).toBe(
    await resolveToken(page, '--ui-surface', 'background-color'),
  );

  // Level 3 — raised/interactive (the Sort control).
  expect(await computed(page, '#inventory-sort', 'border-radius')).toBe(
    await resolveToken(page, '--ui-radius-8', 'border-radius'),
  );

  // Level 4 — semantic status (the aging KPI emphasis).
  const agingCard = page.locator('.kpi-card--emphasis');
  await expect(agingCard).toHaveCount(1);
  expect(await computed(page, '.kpi-card--emphasis', 'background-color')).toBe(
    await resolveToken(page, '--ui-aging-bg', 'background-color'),
  );

  // The KPI numerals carry the numeric hierarchy (tabular figures, largest step).
  const valueStyles = await page.locator('[data-testid="kpi-aging-vehicles"]').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      fontVariantNumeric: style.fontVariantNumeric,
      fontSize: style.fontSize,
    };
  });
  expect(valueStyles.fontVariantNumeric).toContain('tabular-nums');
  expect(valueStyles.fontSize).toBe('32px');
});

test('reduced motion removes non-essential transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await gotoInventory(page);
  const movingDuration = await page.locator('#inventory-sort').evaluate((element) =>
    parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(movingDuration).toBeGreaterThan(0);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reducedDuration = await page.locator('#inventory-sort').evaluate((element) =>
    parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(reducedDuration).toBeLessThan(0.01);
});

/**
 * UI §11.3 / §21: the page must never scroll horizontally at a reference tier,
 * including when text is resized. A dense table owns its own horizontal scroll,
 * so the page itself stays within the viewport.
 */
test('the page never scrolls horizontally at this tier, including at 200% text', async ({
  page,
}) => {
  await openDashboard(page);

  const measure = () =>
    page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));

  const base = await measure();
  expect(base.scrollWidth).toBeLessThanOrEqual(base.innerWidth + 1);

  // 200% text resize (WCAG 1.4.4 proxy): no unintended horizontal overflow.
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '32px';
  });

  const resized = await measure();
  expect(resized.scrollWidth).toBeLessThanOrEqual(resized.innerWidth + 1);
});

/**
 * UI §12.3 / §19 / §22: interactive controls have visibly distinct hover and
 * disabled states, not just a default look. Reduced motion is emulated so the
 * hovered computed style settles immediately instead of mid-transition.
 */
test('controls expose distinct hover and disabled states', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openDashboard(page);

  const details = page.getByRole('button', { name: /view details for/i }).first();
  const restBackground = await details.evaluate((el) => getComputedStyle(el).backgroundColor);
  await details.hover();
  const hoverBackground = await details.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(hoverBackground).not.toBe(restBackground);

  // Page 1 always disables Previous: the disabled state is visually distinct.
  const previous = page.getByRole('button', { name: 'Previous page' });
  await expect(previous).toBeDisabled();
  const disabled = await previous.evaluate((el) => ({
    opacity: parseFloat(getComputedStyle(el).opacity),
    cursor: getComputedStyle(el).cursor,
  }));
  expect(disabled.opacity).toBeLessThan(1);
  expect(disabled.cursor).toBe('not-allowed');
});
