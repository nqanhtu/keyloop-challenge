import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

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

export function checkStorageAccessViolation(code: string): string | null {
  // Catches localStorage, sessionStorage in dot notation, bracket notation, window bracket notation, or direct token
  const patterns = [
    /(?:window|globalThis)?\.?(?:localStorage|sessionStorage)\./,
    /(?:window|globalThis)?\s*\[\s*['"`](?:localStorage|sessionStorage)['"`]\s*\]/,
    /(?:localStorage|sessionStorage)\s*\[/,
    /(?:const|let|var)\s*\{[^}]*(?:localStorage|sessionStorage)[^}]*\}\s*=/,
    /\b(?:localStorage|sessionStorage)\b/,
  ];

  for (const p of patterns) {
    const match = p.exec(code);
    if (match) {
      return `Forbidden browser storage access detected matching ${p}: "${match[0]}"`;
    }
  }
  return null;
}

export function checkActionModuleImportViolation(code: string): string | null {
  const sourceFile = ts.createSourceFile('check.ts', code, ts.ScriptTarget.Latest, true);

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;

    const moduleSpecifier = (statement.moduleSpecifier as ts.StringLiteral).text;
    const targetsInventory =
      moduleSpecifier.includes('/inventory') ||
      moduleSpecifier.endsWith('inventory');
    if (!targetsInventory) continue;

    const rawStatement = statement.getText(sourceFile).trim();

    let authorizedIdentifier: string | null = null;
    if (
      moduleSpecifier.endsWith('/inventory/projection-reader') ||
      moduleSpecifier === './projection-reader' ||
      moduleSpecifier === '../inventory/projection-reader'
    ) {
      authorizedIdentifier = 'VehicleProjectionReader';
    } else if (
      moduleSpecifier.endsWith('/inventory/action-reader') ||
      moduleSpecifier === './action-reader' ||
      moduleSpecifier === '../inventory/action-reader'
    ) {
      authorizedIdentifier = 'CurrentActionReader';
    }

    if (!authorizedIdentifier) {
      return `Action module imports concrete inventory module "${moduleSpecifier}": "${rawStatement}"`;
    }

    const clause = statement.importClause;
    if (!clause) {
      return `Action module imports concrete inventory module without clause: "${rawStatement}"`;
    }

    const clauseIsTypeOnly = Boolean(clause.isTypeOnly);

    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        const importedName = (element.propertyName ?? element.name).text;

        if (importedName === 'FixtureVehicleProjectionReader') {
          return `Action module imports concrete inventory implementation "FixtureVehicleProjectionReader": "${rawStatement}"`;
        }

        if (importedName !== authorizedIdentifier) {
          return `Action module imports unauthorized inventory identifier "${importedName}": "${rawStatement}"`;
        }

        const isTypeOnly = clauseIsTypeOnly || Boolean(element.isTypeOnly);
        if (!isTypeOnly) {
          return `Action module imports ${authorizedIdentifier} as a value import instead of type-only: "${rawStatement}"`;
        }
      }
    } else {
      return `Action module imports concrete inventory dependency without named bindings: "${rawStatement}"`;
    }
  }

  return null;
}

export function checkInventoryModuleImportViolation(code: string): string | null {
  const sourceFile = ts.createSourceFile('check.ts', code, ts.ScriptTarget.Latest, true);

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;

    const moduleSpecifier = (statement.moduleSpecifier as ts.StringLiteral).text;
    const targetsActions =
      moduleSpecifier.includes('/actions') ||
      moduleSpecifier.endsWith('actions');
    if (!targetsActions) continue;

    const rawStatement = statement.getText(sourceFile).trim();

    const clause = statement.importClause;
    if (!clause) {
      return `Inventory module imports concrete action module: "${rawStatement}"`;
    }

    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        const importedName = (element.propertyName ?? element.name).text;
        return `Inventory module imports concrete action identifier "${importedName}": "${rawStatement}"`;
      }
    }

    return `Inventory module imports concrete action dependency: "${rawStatement}"`;
  }

  return null;
}

export function checkMutableActionOperationViolation(code: string): string | null {
  const forbiddenPatterns = [
    /http\.(?:put|patch|delete)\s*\(/,
    /\b(?:clearActions?|deleteAction|updateAction)\s*\(/,
    /\b(?:update|delete)\s*\(\s*(?:vehicleId|actionId|action)/,
    /(?:class\s+(?:BrowserActionStorageAdapter|PersistentActionRepository)[^{]*\{[\s\S]*?\n\s*(?:clear|delete|update|setAll|resetToSeed)\s*\()/,
    /(?:interface\s+ActionRepository[^{]*\{[\s\S]*?\n\s*(?:clear|delete|update|setAll)\s*\()/,
  ];
  for (const p of forbiddenPatterns) {
    const match = p.exec(code);
    if (match) {
      return `Disallowed mutable action operation detected: "${match[0]}"`;
    }
  }
  return null;
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
      /localStorage/,
      /sessionStorage/,
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

  it('ensures vehicle projection fixtures omit inventoryAgeDays and isAging (AGE-002, Gate E)', () => {
    const fixturesPath = path.resolve(__dirname, '../mocks/inventory/fixtures.ts');
    const fixturesContent = fs.readFileSync(fixturesPath, 'utf-8');

    expect(fixturesContent).not.toMatch(/inventoryAgeDays\s*:/);
    expect(fixturesContent).not.toMatch(/isAging\s*:/);
  });

  it('ensures frontend application code does not recompute inventoryAgeDays or isAging (AGE-002, Gate E)', () => {
    const srcDir = path.resolve(__dirname, '..');
    const appFiles = getFilesRecursively(path.join(srcDir, 'app'));
    const apiFiles = getFilesRecursively(path.join(srcDir, 'api'));
    const allProductionFiles = [...appFiles, ...apiFiles];

    const agingComputationPatterns = [
      /calculateAging/,
      />\s*90/,
      />=\s*91/,
      /86400000/,
      /MS_PER_DAY/,
    ];

    for (const file of allProductionFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);

      for (const pattern of agingComputationPatterns) {
        const hasViolation = pattern.test(content);
        expect(
          hasViolation,
          `File ${relativePath} violates AGE-002 boundary by recomputing aging: ${pattern}`,
        ).toBe(false);
      }
    }
  });

  it('ensures vehicle projections use vehicleId for identity and keep vin separate (ARCH-DOM-001)', () => {
    const typesPath = path.resolve(__dirname, '../mocks/inventory/types.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf-8');

    expect(typesContent).toMatch(/vehicleId:\s*string;/);
    expect(typesContent).toMatch(/vin:\s*string;/);
    expect(typesContent).toMatch(/isPresentInLatestSnapshot:\s*boolean;/);
    expect(typesContent).toMatch(/upstreamStatus:\s*UpstreamVehicleStatus;/);
  });

  it('ensures only mock action storage adapter touches browser storage including bracket/alias forms (Gate E, Seam 9)', () => {
    const srcDir = path.resolve(__dirname, '..');
    const allSrcFiles = getFilesRecursively(srcDir);
    const storageAdapterPath = path.resolve(srcDir, 'mocks/actions/storage-adapter.ts');

    for (const file of allSrcFiles) {
      if (file === storageAdapterPath) continue;
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);

      const violation = checkStorageAccessViolation(content);
      expect(
        violation,
        `File ${relativePath} illegally accesses browser storage: ${violation}`,
      ).toBeNull();
    }
  });

  it('ensures action and inventory modules communicate only through explicit interfaces and composition root (Seam 9)', () => {
    const srcDir = path.resolve(__dirname, '..');
    const actionFiles = getFilesRecursively(path.join(srcDir, 'mocks/actions'));
    const inventoryFiles = getFilesRecursively(path.join(srcDir, 'mocks/inventory'));

    for (const file of actionFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);
      const violation = checkActionModuleImportViolation(content);
      expect(
        violation,
        `Action file ${relativePath} violates module boundaries: ${violation}`,
      ).toBeNull();
    }

    for (const file of inventoryFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);
      const violation = checkInventoryModuleImportViolation(content);
      expect(
        violation,
        `Inventory file ${relativePath} violates module boundaries: ${violation}`,
      ).toBeNull();
    }
  });

  it('ensures no mutable action update, delete, or clear operations exist across HTTP, API, repo, and adapter (Gate E)', () => {
    const actionHandlersPath = path.resolve(__dirname, '../mocks/actions/handlers.ts');
    const actionHandlersContent = fs.readFileSync(actionHandlersPath, 'utf-8');
    expect(checkMutableActionOperationViolation(actionHandlersContent)).toBeNull();

    const apiActionsPath = path.resolve(__dirname, '../api/actions.ts');
    const apiActionsContent = fs.readFileSync(apiActionsPath, 'utf-8');
    expect(checkMutableActionOperationViolation(apiActionsContent)).toBeNull();

    const repoPath = path.resolve(__dirname, '../mocks/actions/action-repository.ts');
    const repoContent = fs.readFileSync(repoPath, 'utf-8');
    expect(checkMutableActionOperationViolation(repoContent)).toBeNull();

    const adapterPath = path.resolve(__dirname, '../mocks/actions/storage-adapter.ts');
    const adapterContent = fs.readFileSync(adapterPath, 'utf-8');
    expect(checkMutableActionOperationViolation(adapterContent)).toBeNull();
  });

  describe('Gate E Negative Fixtures (proving actionable rejection diagnostics)', () => {
    it('detects bracket-notation and window alias browser storage access', () => {
      const negativeSample1 = "const store = window['localStorage'];";
      const negativeSample2 = 'sessionStorage.getItem("key");';
      const negativeSample3 = 'const { localStorage } = window;';

      expect(checkStorageAccessViolation(negativeSample1)).not.toBeNull();
      expect(checkStorageAccessViolation(negativeSample1)).toContain('Forbidden browser storage access detected');

      expect(checkStorageAccessViolation(negativeSample2)).not.toBeNull();
      expect(checkStorageAccessViolation(negativeSample3)).not.toBeNull();
    });

    it('detects concrete inventory imports inside action module', () => {
      const negativeActionCode = "import { mockVehicleProjections } from '../inventory/fixtures';";
      const violation = checkActionModuleImportViolation(negativeActionCode);
      expect(violation).not.toBeNull();
      expect(violation).toContain('Action module imports concrete inventory');
    });

    it('detects concrete FixtureVehicleProjectionReader import inside action module', () => {
      const negativeActionCode =
        "import { FixtureVehicleProjectionReader } from '../inventory/projection-reader';";
      const violation = checkActionModuleImportViolation(negativeActionCode);
      expect(violation).not.toBeNull();
      expect(violation).toContain('FixtureVehicleProjectionReader');
    });

    it('allows type-only VehicleProjectionReader import inside action module', () => {
      const validActionCode =
        "import type { VehicleProjectionReader } from '../inventory/projection-reader';";
      const violation = checkActionModuleImportViolation(validActionCode);
      expect(violation).toBeNull();
    });

    it('allows type-only CurrentActionReader import inside action module', () => {
      const validActionCode =
        "import type { CurrentActionReader } from '../inventory/action-reader';";
      const violation = checkActionModuleImportViolation(validActionCode);
      expect(violation).toBeNull();
    });

    it('rejects value import of CurrentActionReader even when preceded by an unrelated type import', () => {
      const multiImportCode = [
        "import type { SomeUnrelatedType } from './some-module';",
        "import { CurrentActionReader } from '../inventory/action-reader';",
      ].join('\n');
      const violation = checkActionModuleImportViolation(multiImportCode);
      expect(violation).not.toBeNull();
      expect(violation).toContain('CurrentActionReader');
    });

    it('rejects value import of VehicleProjectionReader even when preceded by an unrelated type import (multi-import false-negative test)', () => {
      const multiImportCode = [
        "import type { SomeUnrelatedType } from './some-module';",
        "import { VehicleProjectionReader } from '../inventory/projection-reader';",
      ].join('\n');
      const violation = checkActionModuleImportViolation(multiImportCode);
      expect(violation).not.toBeNull();
      expect(violation).toContain('VehicleProjectionReader');
    });

    it('detects concrete action singletons imported inside inventory module', () => {
      const negativeInventoryCode = "import { defaultActionRepository } from '../actions/handlers';";
      const violation = checkInventoryModuleImportViolation(negativeInventoryCode);
      expect(violation).not.toBeNull();
      expect(violation).toContain('Inventory module imports concrete action');
    });

    it('detects concrete ActionCurrentActionReader import inside inventory module', () => {
      const negativeInventoryCode =
        "import { ActionCurrentActionReader } from '../actions/current-action-reader';";
      const violation = checkInventoryModuleImportViolation(negativeInventoryCode);
      expect(violation).not.toBeNull();
      expect(violation).toContain('ActionCurrentActionReader');
    });

    it('detects mutable HTTP and repository operations', () => {
      const negativeHttp = "http.delete('/vehicles/:id/actions', () => {})";
      const negativeRepo = 'class PersistentActionRepository {\n  clear(): void {\n    this.items = [];\n  }\n}';
      const negativeApi = 'export async function deleteAction(id: string): Promise<void> {}';

      expect(checkMutableActionOperationViolation(negativeHttp)).not.toBeNull();
      expect(checkMutableActionOperationViolation(negativeRepo)).not.toBeNull();
      expect(checkMutableActionOperationViolation(negativeApi)).not.toBeNull();
    });
  });
});
