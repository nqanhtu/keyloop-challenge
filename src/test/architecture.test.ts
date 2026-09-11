import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  checkAgingColorOnlyViolation,
  checkAgingRecomputeViolation,
  checkClientPageRecomputationViolation,
  checkMutableActionSurfaceViolation,
  checkProductionBoundaryViolation,
  checkSecondServerStateStoreViolation,
  checkUrlOwnedCollectionStateViolation,
  findBrowserStorageAccess,
  listProductionSourceFiles,
} from './architecture-checks';

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
  // Delegate to the shared AST boundary check first so this legacy helper
  // cannot drift from the check that runs over every production root.
  const shared = findBrowserStorageAccess(code);
  if (shared) {
    return `Forbidden browser storage access detected: ${shared}`;
  }

  // Regex fallback for exotic forms (for example a bare mention outside an
  // expression) that the AST check does not model.
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
  // Delegate to the shared AST action-surface check first so this legacy helper
  // cannot drift from the check that runs over every production root.
  const shared = checkMutableActionSurfaceViolation(code);
  if (shared) {
    return `Disallowed mutable action operation detected: ${shared}`;
  }

  // Regex fallback for forms the AST check does not model (for example a
  // standalone `update(vehicleId)` call or a bare mutable identifier mention).
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
  it('ensures no production frontend root (app, api, features) imports mock internals or browser storage directly', () => {
    const srcDir = path.resolve(__dirname, '..');
    const allProductionFiles = listProductionSourceFiles(srcDir);

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

  it('ensures MSW is isolated to mock bootstrap and development/testing boundaries across all production roots', () => {
    const srcDir = path.resolve(__dirname, '..');
    const allProductionFiles = listProductionSourceFiles(srcDir);

    for (const file of allProductionFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);

      expect(
        content.includes('msw'),
        `Production file ${relativePath} must not import MSW directly`,
      ).toBe(false);
    }
  });

  it('ensures vehicle projection fixtures omit inventoryAgeDays and isAging (AGE-002, Gate E)', () => {
    const fixturesPath = path.resolve(__dirname, '../mocks/inventory/fixtures.ts');
    const fixturesContent = fs.readFileSync(fixturesPath, 'utf-8');

    expect(fixturesContent).not.toMatch(/inventoryAgeDays\s*:/);
    expect(fixturesContent).not.toMatch(/isAging\s*:/);
  });

  it('ensures no production frontend root recomputes inventoryAgeDays or isAging (AGE-002, Gate E)', () => {
    const srcDir = path.resolve(__dirname, '..');
    const allProductionFiles = listProductionSourceFiles(srcDir);

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

/**
 * T08 (ARCH-SCOPE-001, TEST-005).
 *
 * Closes the carried T04 STD-01 / T05 F3 finding: the mechanical boundary
 * checks used to cover only src/app and src/api, so a violation inside
 * src/features/** was invisible. Every check below runs over ALL production
 * frontend roots and carries both a negative fixture (proving the check rejects
 * a violation) and a positive case (proving compliant code is not rejected).
 */
describe('T08 Production Root Architecture Proof (ARCH-SCOPE-001, TEST-005)', () => {
  const srcDir = path.resolve(__dirname, '..');
  const productionFiles = listProductionSourceFiles(srcDir);

  function expectNoViolationInProduction(
    check: (sourceCode: string) => string | null,
  ): void {
    expect(productionFiles.length).toBeGreaterThan(0);
    for (const file of productionFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(srcDir, file);
      expect(check(content), `${relativePath} violates the architecture check`).toBeNull();
    }
  }

  it('covers src/app, src/api, and src/features production roots', () => {
    const roots = new Set(
      productionFiles.map((file) => path.relative(srcDir, file).split(path.sep)[0]),
    );
    expect([...roots].sort()).toEqual(['api', 'app', 'features']);

    const featureFiles = productionFiles.filter((file) =>
      path.relative(srcDir, file).startsWith(`features${path.sep}`),
    );
    expect(featureFiles.length).toBeGreaterThan(0);
  });

  it('rejects mock-layer imports and browser storage in every production root (ARCH-HTTP-001)', () => {
    expectNoViolationInProduction(checkProductionBoundaryViolation);
  });

  it('rejects client recomputation of inventoryAgeDays or isAging in every production root (AGE-002)', () => {
    expectNoViolationInProduction(checkAgingRecomputeViolation);
  });

  it('keeps filters, sort, and page URL-owned across every production root (System Design 6.1)', () => {
    expectNoViolationInProduction(checkUrlOwnedCollectionStateViolation);
  });

  it('keeps the returned inventory page server-owned with no client re-filtering or re-sorting (System Design 6.8, UI-004)', () => {
    expectNoViolationInProduction(checkClientPageRecomputationViolation);
  });

  it('keeps TanStack Query as the only server-state store with no duplicated server data (System Design 6.1)', () => {
    expectNoViolationInProduction(checkSecondServerStateStoreViolation);
  });

  it('keeps manager actions append-only with no update/delete surface (System Design 4.5)', () => {
    expectNoViolationInProduction(checkMutableActionSurfaceViolation);
  });

  it('communicates aging status without relying on color alone (System Design 6.10)', () => {
    expectNoViolationInProduction(checkAgingColorOnlyViolation);
  });

  it('wires URL search validation to the shared inventory search parser (System Design 6.1)', () => {
    const routerContent = fs.readFileSync(path.resolve(srcDir, 'app/router.tsx'), 'utf-8');
    expect(routerContent).toContain('validateSearch');
    expect(routerContent).toContain('parseInventorySearch');
  });

  describe('T08 negative fixtures (each check must reject a violation)', () => {
    it('rejects a feature that imports mock internals', () => {
      const negative = "import { mockVehicleProjections } from '../../mocks/inventory/fixtures';";
      const violation = checkProductionBoundaryViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('mock layer');
    });

    it('rejects a feature that reads browser storage directly', () => {
      const negative = "const stored = window['localStorage'].getItem('vehicle-actions');";
      const violation = checkProductionBoundaryViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('Browser storage');
    });

    it('rejects a feature that recomputes inventoryAgeDays and isAging', () => {
      const negative = [
        'const projection = {',
        '  vehicleId,',
        '  inventoryAgeDays: Math.floor((Date.now() - stockedAtMs) / 86400000),',
        '  isAging: days > 90,',
        '};',
      ].join('\n');
      const violation = checkAgingRecomputeViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('inventoryAgeDays');
    });

    it('rejects a client threshold comparison on inventoryAgeDays', () => {
      const negative = 'const isAging = vehicle.inventoryAgeDays > 90;';
      const violation = checkAgingRecomputeViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('aging');
    });

    it('rejects client re-filtering of the returned inventory page', () => {
      const negative = 'const agingVehicles = vehicles.filter((vehicle) => vehicle.isAging);';
      const violation = checkClientPageRecomputationViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('re-filtering');
    });

    it('rejects client re-sorting of the returned inventory page', () => {
      const negative =
        'const ordered = pageData.sort((a, b) => b.inventoryAgeDays - a.inventoryAgeDays);';
      const violation = checkClientPageRecomputationViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('re-sorting');
    });

    it('rejects registering a client-side sorting or filtering row model', () => {
      const negative = 'const features = tableFeatures({ rowSortingFeature, columnFilteringFeature });';
      const violation = checkClientPageRecomputationViolation(negative);
      expect(violation).not.toBeNull();
    });

    it('rejects disabling manual sorting so the client re-sorts the returned page', () => {
      const negative = 'const table = useTable({ data: vehicles, rowCount, manualSorting: false });';
      const violation = checkClientPageRecomputationViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('manualSorting');
    });

    it('rejects storing filters, sort, or page in React state instead of the URL', () => {
      const negative = "const [sort, setSort] = useState('inventoryAgeDays:desc');";
      const violation = checkUrlOwnedCollectionStateViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('URL');
    });

    it('rejects a second server-state store dependency', () => {
      const negative = "import { create } from 'zustand';";
      const violation = checkSecondServerStateStoreViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('zustand');
    });

    it('rejects duplicating server state into React state', () => {
      const negative = 'const [vehicles, setVehicles] = useState<VehicleListResponse>();';
      const violation = checkSecondServerStateStoreViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('Server data');
    });

    it('rejects an HTTP delete surface for manager actions', () => {
      const negative =
        'export const deleteAction = (id: string) => apiClient.delete(`/vehicles/${id}/actions`);';
      const violation = checkMutableActionSurfaceViolation(negative);
      expect(violation).not.toBeNull();
    });

    it('rejects an action repository that exposes a mutable clear/update operation', () => {
      const negative =
        'class PersistentActionRepository {\n  clear(): void {\n    this.items = [];\n  }\n}';
      const violation = checkMutableActionSurfaceViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('clear');
    });

    it('rejects a fetch call using a mutating HTTP method for manager actions', () => {
      const negative = "await fetch(`/vehicles/${vehicleId}/actions`, { method: 'DELETE' });";
      const violation = checkMutableActionSurfaceViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('DELETE');
    });

    it('rejects an aging indicator that communicates aging by color alone', () => {
      const negative = [
        'export function AgingDot({ isAging }: { isAging: boolean }) {',
        "  return <span className={isAging ? 'is-aging' : 'is-current'} style={{ color: isAging ? 'orange' : 'green' }} />;",
        '}',
      ].join('\n');
      const violation = checkAgingColorOnlyViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('color-only');
    });

    it('rejects an aging indicator whose only content is a decorative dot', () => {
      const negative = [
        'export function AgingDot({ isAging }: { isAging: boolean }) {',
        '  return (',
        '    <span className="aging-indicator">',
        '      <span className="aging-indicator__dot" aria-hidden="true" />',
        '    </span>',
        '  );',
        '}',
      ].join('\n');
      expect(checkAgingColorOnlyViolation(negative)).not.toBeNull();
    });

    it('rejects an aging cell bound to a vehicle object with no readable text', () => {
      const negative = [
        'export function AgingCell({ vehicle }: { vehicle: VehicleView }) {',
        "  return <span className={vehicle.isAging ? 'is-aging' : 'is-current'} />;",
        '}',
      ].join('\n');
      const violation = checkAgingColorOnlyViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('color-only');
    });

    it('rejects client re-sorting of a query-result-derived page binding', () => {
      const negative = [
        'const items = listQuery.data?.data ?? [];',
        'const ordered = items.sort((a, b) => a.vin.localeCompare(b.vin));',
      ].join('\n');
      const violation = checkClientPageRecomputationViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('re-sorting');
    });

    it('rejects client re-filtering of a query-result-derived page binding', () => {
      const negative = [
        'const items = listQuery.data?.data ?? [];',
        "const bmw = items.filter((vehicle) => vehicle.make === 'BMW');",
      ].join('\n');
      const violation = checkClientPageRecomputationViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('re-filtering');
    });

    it('rejects camelCase page state owned by React state instead of the URL', () => {
      const negative = 'const [currentPage, setCurrentPage] = useState(1);';
      const violation = checkUrlOwnedCollectionStateViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('currentPage');
      expect(violation).toContain('URL');
    });

    it('rejects camelCase filters state owned by React state instead of the URL', () => {
      const negative = 'const [activeFilters, setActiveFilters] = useState({});';
      const violation = checkUrlOwnedCollectionStateViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('activeFilters');
      expect(violation).toContain('URL');
    });

    it('rejects duplicating server state into React state without an inline type argument', () => {
      const negative = 'const [vehicles, setVehicles] = useState(initialVehicles);';
      const violation = checkSecondServerStateStoreViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('Server data');
    });

    it('rejects seeding React state from a query result', () => {
      const negative = 'const [pageData, setPageData] = useState(listQuery.data);';
      const violation = checkSecondServerStateStoreViolation(negative);
      expect(violation).not.toBeNull();
      expect(violation).toContain('Server data');
    });
  });

  describe('T08 positive cases (compliant code must not be rejected)', () => {
    it('accepts frontend code that reads backend-derived aging values for display', () => {
      const positive =
        'export function AgeCell({ vehicle }: { vehicle: VehicleView }) { return <dd>{vehicle.inventoryAgeDays} days</dd>; }';
      expect(checkAgingRecomputeViolation(positive)).toBeNull();
    });

    it('accepts the declared VehicleView contract that exposes aging fields', () => {
      const positive = [
        'export interface VehicleView {',
        '  vehicleId: string;',
        '  inventoryAgeDays: number;',
        '  isAging: boolean;',
        '}',
      ].join('\n');
      expect(checkAgingRecomputeViolation(positive)).toBeNull();
    });

    it('accepts status-option filtering and manual server-driven pagination', () => {
      const positive = [
        'const activeStatuses = (statusesQuery.data ?? []).filter((status) => status.isActive);',
        'const table = useTable({ data: vehicles, manualPagination: true, rowCount });',
      ].join('\n');
      expect(checkClientPageRecomputationViolation(positive)).toBeNull();
    });

    it('accepts local UI state and TanStack Query server-state ownership', () => {
      const positive = [
        'const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);',
        "const [noteDraft, setNoteDraft] = useState('');",
        'const listQuery = useVehicleList(search);',
      ].join('\n');
      expect(checkSecondServerStateStoreViolation(positive)).toBeNull();
      expect(checkUrlOwnedCollectionStateViolation(positive)).toBeNull();
    });

    it('accepts append-only GET/POST action access with the API client boundary', () => {
      const positive = [
        'export function getVehicleActions(vehicleId: string) {',
        "  return apiClient.get<VehicleAction[]>(`/vehicles/${vehicleId}/actions`);",
        '}',
        'export function createVehicleAction(vehicleId: string, input: CreateVehicleActionInput) {',
        "  return apiClient.post<VehicleAction>(`/vehicles/${vehicleId}/actions`, input);",
        '}',
      ].join('\n');
      expect(checkMutableActionSurfaceViolation(positive)).toBeNull();
      expect(checkProductionBoundaryViolation(positive)).toBeNull();
    });

    it('accepts the production AgingIndicator that pairs a decorative dot with readable text', () => {
      const indicatorPath = path.resolve(
        srcDir,
        'features/inventory/components/aging-indicator.tsx',
      );
      const content = fs.readFileSync(indicatorPath, 'utf-8');
      expect(checkAgingColorOnlyViolation(content)).toBeNull();
      expect(checkProductionBoundaryViolation(content)).toBeNull();
      expect(content).toContain('AGING');
      expect(content).toContain('Not aging');
      expect(content).toContain('aria-hidden');
    });

    it('accepts an aging cell that delegates to the AgingIndicator from a vehicle object', () => {
      const positive = [
        'export function AgingCell({ vehicle }: { vehicle: VehicleView }) {',
        '  return (',
        '    <td>',
        '      <AgingIndicator isAging={vehicle.isAging} />',
        '    </td>',
        '  );',
        '}',
      ].join('\n');
      expect(checkAgingColorOnlyViolation(positive)).toBeNull();
    });

    it('accepts reading and mapping a query-result-derived binding without re-processing the page', () => {
      const positive = [
        'const items = listQuery.data?.data ?? [];',
        'const labels = items.map((vehicle) => vehicle.model);',
        'const total = listQuery.data?.meta.total ?? 0;',
      ].join('\n');
      expect(checkClientPageRecomputationViolation(positive)).toBeNull();
    });

    it('accepts filtering a non-page query result such as filter options', () => {
      const positive = [
        'const statuses = statusesQuery.data ?? [];',
        'const activeStatuses = statuses.filter((status) => status.isActive);',
      ].join('\n');
      expect(checkClientPageRecomputationViolation(positive)).toBeNull();
    });

    it('accepts local UI state whose name is not URL-owned collection state', () => {
      const positive = [
        'const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);',
        'const [tier, setTier] = useState(() => readViewportTier());',
      ].join('\n');
      expect(checkUrlOwnedCollectionStateViolation(positive)).toBeNull();
      expect(checkSecondServerStateStoreViolation(positive)).toBeNull();
    });
  });
});
