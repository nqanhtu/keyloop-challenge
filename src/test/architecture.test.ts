import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function getFilesRecursively(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const resolvedPath = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getFilesRecursively(resolvedPath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
      files.push(resolvedPath);
    }
  }
  return files;
}

describe('Architecture Compliance & Import Boundaries (ARCH-HTTP-001, Gate E)', () => {
  it('ensures frontend application and API code do not import mock internals or browser storage directly', () => {
    const srcDir = path.resolve(__dirname, '..');
    const appFiles = getFilesRecursively(path.join(srcDir, 'app'));
    const apiFiles = getFilesRecursively(path.join(srcDir, 'api'));
    const allProductionFiles = [...appFiles, ...apiFiles];

    expect(allProductionFiles.length).toBeGreaterThan(0);

    const forbiddenImportPatterns = [
      /from\s+['"].*\/mocks(\/.*)?['"]/,
      /import\s+['"].*\/mocks(\/.*)?['"]/,
      /from\s+['"].*mock-repository.*['"]/,
      /localStorage\./,
      /sessionStorage\./,
    ];

    for (const file of allProductionFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);

      for (const pattern of forbiddenImportPatterns) {
        const hasViolation = pattern.test(content);
        expect(
          hasViolation,
          `File ${relativePath} violates ARCH-HTTP-001 boundary by matching pattern: ${pattern}`,
        ).toBe(false);
      }
    }
  });

  it('ensures MSW is isolated to mock bootstrap and development/testing boundaries', () => {
    const srcDir = path.resolve(__dirname, '..');
    const appFiles = getFilesRecursively(path.join(srcDir, 'app'));

    for (const file of appFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);

      expect(
        content.includes('msw'),
        `App file ${relativePath} must not import MSW directly`,
      ).toBe(false);
    }
  });
});
