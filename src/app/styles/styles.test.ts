import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * U03 — Token / base / primitive seam (UI System Design §7.2, §8, §19).
 *
 * Static proof that the global semantic layer exists, that the app entry loads
 * it, and that the feature stylesheets consume semantic tokens instead of
 * deciding raw colour literals of their own. The runtime proof (a browser
 * resolving a token-driven property on a real element) lives in
 * `e2e/visual-system.spec.ts`.
 */
const read = (relative: string) =>
  fs.readFileSync(path.resolve(__dirname, relative), 'utf-8');

const tokens = read('tokens.css');
const base = read('base.css');
const primitives = read('primitives.css');
const dashboard = read('../../features/inventory/inventory-dashboard.css');
const detail = read('../../features/actions/vehicle-detail.css');
const entry = read('../../main.tsx');

/** Raw colour literals a component stylesheet must never contain. */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;

describe('U03 — Semantic token layer (UI §8)', () => {
  it('declares the layer order and the semantic tokens components consume', () => {
    expect(tokens).toMatch(/@layer\s+tokens,\s*base,\s*primitives,\s*components;/);
    expect(tokens).toMatch(/@layer tokens\s*\{/);

    for (const token of [
      '--ui-canvas',
      '--ui-surface',
      '--ui-surface-muted',
      '--ui-surface-raised',
      '--ui-text-primary',
      '--ui-text-secondary',
      '--ui-border',
      '--ui-border-strong',
      '--ui-interactive',
      '--ui-focus',
      '--ui-aging-text',
      '--ui-aging-bg',
      '--ui-aging-border',
      '--ui-error-text',
      '--ui-error-bg',
      '--ui-success-text',
    ]) {
      expect(tokens, `${token} must be declared`).toContain(token);
    }
  });

  it('loads the global stylesheets from the app entry before the app renders', () => {
    const tokensIndex = entry.indexOf("import './app/styles/tokens.css'");
    const baseIndex = entry.indexOf("import './app/styles/base.css'");
    const primitivesIndex = entry.indexOf("import './app/styles/primitives.css'");
    const appIndex = entry.indexOf("import { App } from './app/App'");

    expect(tokensIndex).toBeGreaterThanOrEqual(0);
    expect(baseIndex).toBeGreaterThan(tokensIndex);
    expect(primitivesIndex).toBeGreaterThan(baseIndex);
    expect(appIndex).toBeGreaterThan(primitivesIndex);
  });

  it('feature stylesheets consume tokens rather than raw colour literals', () => {
    for (const [name, css] of [
      ['inventory-dashboard.css', dashboard],
      ['vehicle-detail.css', detail],
      ['base.css', base],
      ['primitives.css', primitives],
    ] as const) {
      expect(css, `${name} must consume a semantic token`).toMatch(/var\(--ui-/);
      expect(css, `${name} must not hardcode a colour literal`).not.toMatch(RAW_COLOR);
    }
  });
});

describe('U03 — Base + shared primitives (UI §17.5, §19, §20)', () => {
  it('defines one explicit focus-visible ring and a reduced-motion guard', () => {
    expect(base).toMatch(/:focus-visible/);
    expect(base).toMatch(/outline:\s*2px solid var\(--ui-focus\)/);
    expect(base).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
    expect(base).toMatch(/transition-duration:\s*0\.001ms\s*!important/);
  });

  it('exposes the shared primitive surfaces both features compose', () => {
    for (const primitive of [
      '.ui-button',
      '.ui-chip',
      '.ui-panel',
      '.ui-status-pill',
      '.ui-vlabel',
      '.ui-sr-only',
      '.ui-skeleton',
    ]) {
      expect(primitives, `${primitive} must exist`).toContain(primitive);
    }
  });

  it('gates the skeleton shimmer behind prefers-reduced-motion: no-preference', () => {
    expect(primitives).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*no-preference\)\s*\{[\s\S]*ui-skeleton--shimmer/,
    );
  });
});

/** Resolves a `--token: var(--other)` chain down to its literal value. */
function tokenValue(css: string, name: string): string {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(css);
  if (!match) {
    throw new Error(`${name} must be declared in tokens.css`);
  }
  const value = match[1].trim();
  const alias = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(value);
  return alias ? tokenValue(css, alias[1]) : value;
}

function relativeLuminance(hex: string): number {
  const digits = hex.replace('#', '');
  const channel = (offset: number) => {
    const value = parseInt(digits.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

function contrastRatio(a: string, b: string): number {
  const [high, low] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

describe('U06 — Muted text contrast (RP-2, U05 F2, WCAG AA 1.4.3)', () => {
  it('keeps the muted text token at >= 4.5:1 on every surface it lands on', () => {
    const muted = tokenValue(tokens, '--ui-text-muted');
    // The muted token is 12-13px everywhere, so it is never "large text": all
    // three surfaces must clear the 4.5:1 normal-text threshold.
    for (const surface of ['--ui-surface', '--ui-surface-muted', '--ui-canvas']) {
      const background = tokenValue(tokens, surface);
      expect(
        contrastRatio(muted, background),
        `${muted} on ${surface} (${background})`,
      ).toBeGreaterThanOrEqual(4.5);
    }

    // The muted token must still read as secondary to the primary text token.
    expect(contrastRatio(muted, tokenValue(tokens, '--ui-text-primary'))).toBeGreaterThan(1);
  });
});
