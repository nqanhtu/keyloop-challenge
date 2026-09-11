import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

/**
 * T08 architecture proof helpers (TEST-005 / ARCH-SCOPE-001).
 *
 * These are the mechanical, repository-native checks that promote the accepted
 * System Design boundaries (3.4 module boundaries, 6.1 state ownership,
 * 6.8 server-side list operations, 6.11 mock backend, 7.2 production backend
 * design) into deterministic validation. Every check is a pure function so the
 * negative fixtures in the test suite can prove the check actually rejects a
 * violation, and the production tree can prove it does not reject compliant
 * code.
 */

export const PRODUCTION_ROOTS = ['app', 'api', 'features'] as const;

export function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const resolvedPath = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(resolvedPath));
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.includes('.test.') &&
      !entry.name.includes('.spec.')
    ) {
      files.push(resolvedPath);
    }
  }
  return files;
}

/** Every production frontend source file: src/app, src/api, and src/features. */
export function listProductionSourceFiles(srcDir: string): string[] {
  return PRODUCTION_ROOTS.flatMap((root) => collectSourceFiles(path.join(srcDir, root)));
}

/**
 * Every non-test source file under src/, not only the three production
 * frontend roots. A future design-only infrastructure root (for example
 * src/workers/sync-worker.ts) must still be scanned by the scope checks, so the
 * design-only proof runs over this wider set instead of the frontend roots.
 */
export function listScannedSourceFiles(srcDir: string): string[] {
  return collectSourceFiles(srcDir).filter((file) => {
    const relative = path.relative(srcDir, file);
    return !relative.startsWith(`test${path.sep}`) && !relative.startsWith('..');
  });
}

function parse(sourceCode: string): ts.SourceFile {
  return ts.createSourceFile('check.tsx', sourceCode, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

interface ModuleReference {
  readonly specifier: string;
  readonly node: ts.Node;
}

/** Static imports, re-exports, require(), and dynamic import() specifiers. */
function collectModuleReferences(sourceFile: ts.SourceFile): ModuleReference[] {
  const references: ModuleReference[] = [];

  walk(sourceFile, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({ specifier: node.moduleSpecifier.text, node });
      return;
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      references.push({ specifier: node.moduleSpecifier.text, node });
      return;
    }
    if (ts.isCallExpression(node)) {
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const [firstArgument] = node.arguments;
      if ((isRequire || isDynamicImport) && firstArgument && ts.isStringLiteral(firstArgument)) {
        references.push({ specifier: firstArgument.text, node });
      }
    }
  });

  return references;
}

// ---------------------------------------------------------------------------
// Boundary seam: mock internals and browser storage must not reach production
// frontend code in any root.
// ---------------------------------------------------------------------------

const MOCK_MODULE_PATTERN = /(^|\/)mocks($|\/)|mock-repository/;
/**
 * Composed rather than written as a single token: the repository's own
 * storage-ownership assertion scans every non-test file under src/, and this
 * test-only helper must not look like a browser-storage access itself.
 */
const STORAGE_GLOBAL_SUFFIX = 'Storage';
const BROWSER_STORAGE_GLOBALS = new Set([
  `local${STORAGE_GLOBAL_SUFFIX}`,
  `session${STORAGE_GLOBAL_SUFFIX}`,
]);

export function findBrowserStorageAccess(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);
  let violation: string | null = null;

  walk(sourceFile, (node) => {
    if (violation) {
      return;
    }
    if (ts.isIdentifier(node) && BROWSER_STORAGE_GLOBALS.has(node.text)) {
      violation = `Browser storage "${node.text}" is accessed outside the mock persistence layer: "${node.getText(sourceFile)}"`;
      return;
    }
    if (ts.isStringLiteral(node) && BROWSER_STORAGE_GLOBALS.has(node.text)) {
      violation = `Browser storage "${node.text}" is accessed by key outside the mock persistence layer: "${node.getText(sourceFile)}"`;
    }
  });

  return violation;
}

export function checkProductionBoundaryViolation(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);

  for (const { specifier, node } of collectModuleReferences(sourceFile)) {
    if (MOCK_MODULE_PATTERN.test(specifier)) {
      return `Production code imports the mock layer through "${specifier}": "${node.getText(sourceFile)}"`;
    }
  }

  return findBrowserStorageAccess(sourceCode);
}

// ---------------------------------------------------------------------------
// Aging seam: inventoryAgeDays / isAging are backend-derived and must not be
// recomputed or assigned by frontend code.
// ---------------------------------------------------------------------------

const AGING_DERIVED_FIELDS = new Set(['inventoryAgeDays', 'isAging']);
const COMPARISON_OPERATORS = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

function propertyNameText(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

export function checkAgingRecomputeViolation(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);
  let violation: string | null = null;

  walk(sourceFile, (node) => {
    if (violation) {
      return;
    }

    if (ts.isPropertyAssignment(node)) {
      const name = propertyNameText(node.name);
      if (name && AGING_DERIVED_FIELDS.has(name)) {
        violation = `Frontend code assigns derived aging field "${name}": "${node.getText(sourceFile)}"`;
      }
      return;
    }

    if (ts.isPropertyDeclaration(node)) {
      const name = propertyNameText(node.name);
      if (name && AGING_DERIVED_FIELDS.has(name)) {
        violation = `Frontend class declares derived aging field "${name}": "${node.getText(sourceFile)}"`;
      }
      return;
    }

    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && AGING_DERIVED_FIELDS.has(node.name.text)) {
      violation = `Frontend code computes derived aging value in "${node.getText(sourceFile)}"`;
      return;
    }

    if (ts.isBinaryExpression(node)) {
      const leftText = node.left.getText(sourceFile);
      const rightText = node.right.getText(sourceFile);
      const mentionsAgeDays = /\binventoryAgeDays\b/.test(leftText) || /\binventoryAgeDays\b/.test(rightText);
      const mentionsAging = /\bisAging\b/.test(leftText) || /\bisAging\b/.test(rightText);

      if (node.operatorToken.kind === ts.SyntaxKind.EqualsToken && (mentionsAgeDays || mentionsAging)) {
        violation = `Frontend code assigns a derived aging value: "${node.getText(sourceFile)}"`;
        return;
      }

      const comparesAgainstThreshold =
        (ts.isNumericLiteral(node.left) || ts.isNumericLiteral(node.right)) &&
        COMPARISON_OPERATORS.has(node.operatorToken.kind);
      if (comparesAgainstThreshold && mentionsAgeDays) {
        violation = `Frontend code recomputes the aging threshold: "${node.getText(sourceFile)}"`;
      }
    }
  });

  return violation;
}

// ---------------------------------------------------------------------------
// List-operations seam: filters/sort/page are server + URL owned and must not
// be recomputed on the client from a returned page.
// ---------------------------------------------------------------------------

const CLIENT_LIST_DOMAIN_MARKERS = [
  /\binventoryAgeDays\b/,
  /\bisAging\b/,
  /\bagingOnly\b/,
  /\bupstreamStatus\b/,
  /\bactionStatusId\b/,
  /\bVehicleView\b/,
  /\bvehicles\b/,
  /\bpageData\b/,
];
const CLIENT_LIST_PROCESSING_METHODS = new Set(['filter', 'sort', 'toSorted', 'toReversed']);
const CLIENT_PAGINATION_METHODS = new Set(['slice', 'splice', 'reverse']);
const CLIENT_ROW_MODEL_FEATURES = new Set([
  'rowSortingFeature',
  'columnSortingFeature',
  'sortingFeature',
  'columnFilteringFeature',
  'globalFilteringFeature',
  'filteringFeature',
  'getSortedRowModel',
  'getFilteredRowModel',
]);
const LIST_RECEIVER_PATTERN = /\b(vehicles|rows|pageData)\b/;
/**
 * A binding is treated as the returned page when its initializer nests two
 * query `.data` accesses (`listQuery.data?.data`) or dereferences `.data` off a
 * list/page/vehicle/inventory-named query (`listQuery.data`). Filter-option
 * queries such as `statusesQuery.data` are deliberately excluded so re-filtering
 * filter options stays allowed.
 */
function derivesFromReturnedPage(initializerText: string): boolean {
  const dataAccesses = initializerText.match(/\.data\b/g)?.length ?? 0;
  if (dataAccesses >= 2) {
    return true;
  }
  return /\b(list|page|vehicle|vehicles|row|rows|inventory)[A-Za-z0-9_]*\s*\??\.\s*data\b/i.test(
    initializerText,
  );
}

/**
 * Collect local bindings whose initializer dereferences a query result. A
 * client sort/filter on one of these bindings re-processes the server-owned
 * page regardless of the local variable name, which the receiver-name
 * allowlist used to miss.
 */
function collectQueryResultDerivedBindings(sourceFile: ts.SourceFile): Set<string> {
  const bindings = new Set<string>();

  walk(sourceFile, (node) => {
    if (!ts.isVariableDeclaration(node) || !node.initializer) {
      return;
    }
    if (!derivesFromReturnedPage(node.initializer.getText(sourceFile))) {
      return;
    }
    const bindingName = node.name;
    if (ts.isIdentifier(bindingName)) {
      bindings.add(bindingName.text);
    } else if (ts.isArrayBindingPattern(bindingName)) {
      for (const element of bindingName.elements) {
        if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
          bindings.add(element.name.text);
        }
      }
    }
  });

  return bindings;
}

export function checkClientPageRecomputationViolation(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);
  const queryResultDerivedBindings = collectQueryResultDerivedBindings(sourceFile);
  let violation: string | null = null;

  const receiverIsQueryResultPage = (receiverText: string): boolean =>
    queryResultDerivedBindings.has(receiverText.trim());

  walk(sourceFile, (node) => {
    if (violation) {
      return;
    }

    if (ts.isIdentifier(node) && CLIENT_ROW_MODEL_FEATURES.has(node.text)) {
      violation = `Client-side list ${node.text} is registered instead of relying on the server page: "${node.getText(sourceFile)}"`;
      return;
    }

    if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
      const delegatesToClient =
        (node.name.text === 'manualSorting' || node.name.text === 'manualFiltering') &&
        node.initializer.kind === ts.SyntaxKind.FalseKeyword;
      if (delegatesToClient) {
        violation = `Table option "${node.name.text}: false" recomputes the server page on the client: "${node.getText(sourceFile)}"`;
      }
      return;
    }

    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
      return;
    }

    const method = node.expression.name.text;
    const callText = node.getText(sourceFile);
    const receiverText = node.expression.expression.getText(sourceFile);
    const receiverIsReturnedList =
      LIST_RECEIVER_PATTERN.test(receiverText) ||
      /\.data$/.test(receiverText.trim()) ||
      receiverIsQueryResultPage(receiverText);
    const mentionsInventoryDomain = CLIENT_LIST_DOMAIN_MARKERS.some((pattern) => pattern.test(callText));

    if (CLIENT_LIST_PROCESSING_METHODS.has(method) && (mentionsInventoryDomain || receiverIsReturnedList)) {
      const kind = method === 'filter' ? 're-filtering' : 're-sorting';
      violation = `Client-side ${kind} of a returned inventory page: "${callText}"`;
      return;
    }

    if (
      CLIENT_PAGINATION_METHODS.has(method) &&
      (LIST_RECEIVER_PATTERN.test(receiverText) || receiverIsQueryResultPage(receiverText))
    ) {
      violation = `Client-side pagination of a returned inventory list: "${callText}"`;
    }
  });

  return violation;
}

const URL_OWNED_COLLECTION_STATE =
  /\b(make|model|sort|page|agingOnly|inventoryStatus|actionStatusId|ageMinDays|ageMaxDays|vehicleId|filters|search)\b/;
/**
 * camelCase collection state (`currentPage`, `activeFilters`) is not caught by
 * the word-boundary allowlist above, so match the trailing URL-owned token
 * case-insensitively as well.
 */
const URL_OWNED_COLLECTION_STATE_SUFFIX =
  /(page|pages|filter|filters|sort|sorts|sorting|sortorder|query|search)$/i;

export function checkUrlOwnedCollectionStateViolation(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);
  let violation: string | null = null;

  walk(sourceFile, (node) => {
    if (violation || !ts.isVariableDeclaration(node)) {
      return;
    }
    if (!ts.isArrayBindingPattern(node.name) || !node.initializer || !ts.isCallExpression(node.initializer)) {
      return;
    }

    const callee = node.initializer.expression;
    const hookName = ts.isIdentifier(callee) ? callee.text : undefined;
    if (hookName !== 'useState' && hookName !== 'useReducer') {
      return;
    }

    const [firstBinding] = node.name.elements;
    if (firstBinding && ts.isBindingElement(firstBinding) && ts.isIdentifier(firstBinding.name)) {
      const localName = firstBinding.name.text;
      if (URL_OWNED_COLLECTION_STATE.test(localName) || URL_OWNED_COLLECTION_STATE_SUFFIX.test(localName)) {
        violation = `Collection state "${localName}" is owned by React state instead of the URL: "${node.getText(sourceFile)}"`;
      }
    }
  });

  return violation;
}

// ---------------------------------------------------------------------------
// State seam: TanStack Query owns server state; no second store and no server
// data duplicated into React state.
// ---------------------------------------------------------------------------

const SECOND_STORE_MODULES = [
  'zustand',
  'redux',
  '@reduxjs/toolkit',
  'jotai',
  'valtio',
  'mobx',
  'mobx-react',
  'mobx-react-lite',
  'recoil',
  '@tanstack/store',
  'effector',
  'xstate',
  '@xstate/react',
];
const STORE_FACTORY_CALLS = new Set([
  'createStore',
  'configureStore',
  'createSlice',
  'createReducer',
  'createSignal',
  'createMachine',
]);
const SERVER_STATE_TYPES =
  /\b(VehicleListResponse|VehicleView|VehicleAction|VehicleActionStatus|VehicleActionSummary|InventorySummary|VehicleListQuery|VehicleListMeta)\b/;
/**
 * Local React state names that only make sense for the server-owned inventory
 * page. `useState(initialVehicles)` with an inferred type previously slipped
 * through because the duplication branch only inspected inline type arguments.
 */
const SERVER_DATA_BINDING_NAME =
  /(vehicles|vehiclelist|inventorylist|vehiclepage|vehiclerows|pagerows|tablerows|pagedata|listdata|serverdata|responsedata|listresponse|rows)$/i;
/** An initializer that already carries a query result into React state. */
const QUERY_RESULT_INITIALIZER =
  /\.data\b|\buseVehicleList\b|\buseInventorySummary\b|\buseActionStatuses\b|\buseQuery\b/;

export function checkSecondServerStateStoreViolation(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);

  for (const { specifier, node } of collectModuleReferences(sourceFile)) {
    if (SECOND_STORE_MODULES.some((moduleName) => specifier === moduleName || specifier.startsWith(`${moduleName}/`))) {
      return `A second server-state store dependency "${specifier}" is imported: "${node.getText(sourceFile)}"`;
    }
  }

  let violation: string | null = null;
  walk(sourceFile, (node) => {
    if (violation) {
      return;
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && STORE_FACTORY_CALLS.has(node.expression.text)) {
      violation = `Independent state store created outside TanStack Query: "${node.getText(sourceFile)}"`;
      return;
    }

    if (!ts.isVariableDeclaration(node) || !node.initializer || !ts.isCallExpression(node.initializer)) {
      return;
    }
    const callee = node.initializer.expression;
    const hookName = ts.isIdentifier(callee) ? callee.text : undefined;
    if (hookName !== 'useState' && hookName !== 'useReducer') {
      return;
    }
    const typeArguments = node.initializer.typeArguments ?? [];
    const annotatedType = typeArguments.map((typeNode) => typeNode.getText(sourceFile)).join(' | ');
    const [firstBinding] = ts.isArrayBindingPattern(node.name) ? node.name.elements : [];
    const localName =
      firstBinding && ts.isBindingElement(firstBinding) && ts.isIdentifier(firstBinding.name)
        ? firstBinding.name.text
        : undefined;
    const derivesFromQueryResult = QUERY_RESULT_INITIALIZER.test(node.initializer.getText(sourceFile));
    if (
      SERVER_STATE_TYPES.test(annotatedType) ||
      (localName !== undefined && SERVER_DATA_BINDING_NAME.test(localName)) ||
      derivesFromQueryResult
    ) {
      violation = `Server data is duplicated into React state: "${node.getText(sourceFile)}"`;
    }
  });

  return violation;
}

// ---------------------------------------------------------------------------
// Action seam: manager actions stay append-only, with no update/delete surface.
// ---------------------------------------------------------------------------

const MUTATING_ACTION_METHODS = new Set(['delete', 'put', 'patch']);
const MUTATING_ACTION_IDENTIFIERS = new Set([
  'deleteAction',
  'updateAction',
  'removeAction',
  'clearAction',
  'clearActions',
  'archiveAction',
  'deleteVehicleAction',
  'updateVehicleAction',
]);
const RESTRICTED_ACTION_RECEIVERS = /\b(apiClient|http|api|client|actionRepository|repo)\b/;
const MUTATING_HTTP_METHODS = new Set(['DELETE', 'PUT', 'PATCH']);
const MUTATING_REPOSITORY_MEMBERS = new Set(['update', 'delete', 'clear', 'setAll', 'resetToSeed', 'remove']);

function classOrInterfaceLooksLikeActionRepository(name: string | undefined): boolean {
  return Boolean(name && /action/i.test(name) && /repository|storage|store/i.test(name));
}

export function checkMutableActionSurfaceViolation(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);
  let violation: string | null = null;

  walk(sourceFile, (node) => {
    if (violation) {
      return;
    }

    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const receiverText = node.expression.expression.getText(sourceFile);
      if (MUTATING_ACTION_METHODS.has(method) && RESTRICTED_ACTION_RECEIVERS.test(receiverText)) {
        violation = `HTTP ${method.toUpperCase()} surface for manager actions exists: "${node.getText(sourceFile)}"`;
      }
      return;
    }

    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && MUTATING_ACTION_IDENTIFIERS.has(node.expression.text)) {
      violation = `Mutable action operation "${node.expression.text}" exists: "${node.getText(sourceFile)}"`;
      return;
    }

    if (ts.isPropertyAssignment(node) && propertyNameText(node.name) === 'method' && ts.isStringLiteral(node.initializer)) {
      if (MUTATING_HTTP_METHODS.has(node.initializer.text)) {
        violation = `Mutable HTTP method "${node.initializer.text}" is used for manager actions: "${node.getText(sourceFile)}"`;
      }
      return;
    }

    if (ts.isClassDeclaration(node) && classOrInterfaceLooksLikeActionRepository(node.name?.text)) {
      for (const member of node.members) {
        const memberName = ts.isMethodDeclaration(member) || ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)
          ? propertyNameText(member.name)
          : undefined;
        if (memberName && MUTATING_REPOSITORY_MEMBERS.has(memberName)) {
          violation = `Action repository exposes mutable "${memberName}" operation: "${member.getText(sourceFile)}"`;
          return;
        }
      }
    }

    if (ts.isInterfaceDeclaration(node) && classOrInterfaceLooksLikeActionRepository(node.name.text)) {
      for (const member of node.members) {
        const memberName = ts.isMethodSignature(member) ? propertyNameText(member.name) : undefined;
        if (memberName && MUTATING_REPOSITORY_MEMBERS.has(memberName)) {
          violation = `Action repository interface exposes mutable "${memberName}" operation: "${member.getText(sourceFile)}"`;
          return;
        }
      }
    }
  });

  return violation;
}

// ---------------------------------------------------------------------------
// Aging-communication seam: aging must not be communicated by color alone.
// ---------------------------------------------------------------------------

function isDecorativeJsxElement(element: ts.JsxOpeningLikeElement): boolean {
  return element.attributes.properties.some((attribute) => {
    if (!ts.isJsxAttribute(attribute) || !ts.isIdentifier(attribute.name) || attribute.name.text !== 'aria-hidden') {
      return false;
    }
    const initializer = attribute.initializer;
    if (!initializer) {
      return true;
    }
    if (ts.isStringLiteral(initializer)) {
      return initializer.text === 'true';
    }
    return ts.isJsxExpression(initializer) && initializer.expression?.kind === ts.SyntaxKind.TrueKeyword;
  });
}

function jsxChildrenContainText(children: ts.NodeArray<ts.JsxChild>): boolean {
  for (const child of children) {
    if (ts.isJsxText(child) && /[A-Za-z]/.test(child.text)) {
      return true;
    }
    if (ts.isJsxExpression(child) && child.expression) {
      return true;
    }
    if ((ts.isJsxElement(child) || ts.isJsxFragment(child)) && jsxNodeContainsText(child)) {
      return true;
    }
  }
  return false;
}

function jsxNodeContainsText(node: ts.Node): boolean {
  if (ts.isJsxElement(node)) {
    return !isDecorativeJsxElement(node.openingElement) && jsxChildrenContainText(node.children);
  }
  if (ts.isJsxFragment(node)) {
    return jsxChildrenContainText(node.children);
  }
  return false;
}

function containsJsx(node: ts.Node): boolean {
  if (ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node)) {
    return true;
  }
  let found = false;
  walk(node, (child) => {
    if (found || child === node) {
      return;
    }
    if (ts.isJsxElement(child) || ts.isJsxFragment(child) || ts.isJsxSelfClosingElement(child)) {
      found = true;
    }
  });
  return found;
}

function jsxExpressionContainsText(expression: ts.Node): boolean {
  if (ts.isJsxElement(expression) || ts.isJsxFragment(expression) || ts.isJsxSelfClosingElement(expression)) {
    return jsxNodeContainsText(expression);
  }
  let found = false;
  walk(expression, (node) => {
    if (found || node === expression) {
      return;
    }
    if (ts.isJsxElement(node) || ts.isJsxFragment(node) || ts.isJsxSelfClosingElement(node)) {
      if (jsxNodeContainsText(node)) {
        found = true;
      }
    }
  });
  return found;
}

function jsxExpressionDelegatesAging(expression: ts.Node): boolean {
  let found = false;
  walk(expression, (node) => {
    if (found) {
      return;
    }
    if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && node.name.text === 'isAging') {
      found = true;
    }
  });
  return found;
}

/**
 * Whether a function-like node mentions an identifier anywhere: JSX attribute
 * names, property access names, and destructured parameters all count. This
 * replaces the parameter-list check, which only recognised a literal `isAging`
 * prop and missed aging read off a vehicle or row object.
 */
function referencesIdentifier(node: ts.Node, name: string): boolean {
  let found = false;
  walk(node, (candidate) => {
    if (!found && ts.isIdentifier(candidate) && candidate.text === name) {
      found = true;
    }
  });
  return found;
}

function collectReturnedExpressions(declaration: ts.FunctionLikeDeclaration): ts.Expression[] {
  const expressions: ts.Expression[] = [];
  const body = declaration.body;
  if (!body) {
    return expressions;
  }
  if (!ts.isBlock(body)) {
    return [body];
  }

  walk(body, (node) => {
    if (node !== body && ts.isFunctionLike(node)) {
      return;
    }
    if (ts.isReturnStatement(node) && node.expression) {
      expressions.push(node.expression);
    }
  });
  return expressions;
}

export function checkAgingColorOnlyViolation(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);
  let violation: string | null = null;

  walk(sourceFile, (node) => {
    if (violation || !ts.isFunctionLike(node)) {
      return;
    }
    const declaration = node as ts.FunctionLikeDeclaration;
    if (!referencesIdentifier(declaration, 'isAging')) {
      return;
    }

    const returnedExpressions = collectReturnedExpressions(declaration);
    const jsxReturns = returnedExpressions.filter((expression) => containsJsx(expression));
    if (jsxReturns.length === 0) {
      return;
    }

    const delegatesAging = jsxReturns.some((expression) => jsxExpressionDelegatesAging(expression));
    if (delegatesAging) {
      return;
    }

    const communicatesWithText = jsxReturns.some((expression) => jsxExpressionContainsText(expression));
    if (!communicatesWithText) {
      const snippet = node.getText(sourceFile).replace(/\s+/g, ' ').slice(0, 140);
      violation = `Aging status is communicated without any non-decorative text (color-only): "${snippet}"`;
    }
  });

  return violation;
}

// ---------------------------------------------------------------------------
// Scope seam: the production backend and infrastructure stay design-only
// (System Design 7.2); only the mock backend exists in this challenge.
// ---------------------------------------------------------------------------

interface DesignOnlyBackendRule {
  readonly label: string;
  readonly matches: (specifier: string) => boolean;
}

export const DESIGN_ONLY_BACKEND_RULES: readonly DesignOnlyBackendRule[] = [
  {
    label: 'Fastify',
    matches: (specifier) => specifier === 'fastify' || specifier.startsWith('@fastify/'),
  },
  {
    label: 'Prisma',
    matches: (specifier) =>
      specifier === 'prisma' ||
      specifier.startsWith('prisma/') ||
      specifier === '@prisma/client' ||
      specifier.startsWith('@prisma/'),
  },
  {
    label: 'PostgreSQL',
    matches: (specifier) =>
      specifier === 'pg' ||
      specifier === 'pg-pool' ||
      specifier === 'postgres' ||
      specifier === 'postgresql' ||
      specifier === '@neondatabase/serverless' ||
      specifier === 'drizzle-orm' ||
      specifier.startsWith('drizzle-orm/'),
  },
  {
    label: 'synchronization worker',
    matches: (specifier) =>
      specifier === 'bullmq' ||
      specifier === 'bull' ||
      specifier === 'kafkajs' ||
      specifier === 'agenda' ||
      specifier === 'pg-boss' ||
      specifier.startsWith('@temporalio/'),
  },
  {
    label: 'synchronization scheduler or worker thread',
    matches: (specifier) =>
      specifier === 'node-cron' ||
      specifier === 'cron' ||
      specifier === 'node-schedule' ||
      specifier === 'croner' ||
      specifier === 'bree' ||
      specifier === 'node:worker_threads' ||
      specifier === 'worker_threads',
  },
  {
    label: 'identity provider',
    matches: (specifier) =>
      specifier === 'passport' ||
      specifier === 'express-openid-connect' ||
      specifier === 'openid-client' ||
      specifier === 'jsonwebtoken' ||
      specifier === 'keycloak-connect' ||
      specifier.startsWith('@auth0/') ||
      specifier.startsWith('@okta/'),
  },
  {
    label: 'observability backend',
    matches: (specifier) =>
      specifier.startsWith('@opentelemetry/') ||
      specifier.startsWith('@sentry/') ||
      specifier === 'dd-trace' ||
      specifier === 'newrelic' ||
      specifier === 'prom-client',
  },
  {
    label: 'backend HTTP framework',
    matches: (specifier) =>
      specifier === 'express' ||
      specifier === 'koa' ||
      specifier === 'hapi' ||
      specifier === '@hapi/hapi' ||
      specifier === '@nestjs/core',
  },
];

export function checkDesignOnlyBackendImportViolation(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);
  for (const { specifier, node } of collectModuleReferences(sourceFile)) {
    const rule = DESIGN_ONLY_BACKEND_RULES.find((candidate) => candidate.matches(specifier));
    if (rule) {
      return `Design-only production ${rule.label} is imported as "${specifier}": "${node.getText(sourceFile)}"`;
    }
  }
  return null;
}

/**
 * Registration of a design-only synchronization scheduler or worker thread
 * that carries no import of its own: `cron.schedule(...)`,
 * `setInterval(() => syncInventory(), 60000)`, or `new Worker(...)`.
 */
const DESIGN_ONLY_TIMER_CALLEES = new Set(['setInterval', 'setTimeout', 'setImmediate']);
const DESIGN_ONLY_SYNC_CALLBACK = /\b(sync|synchroni[sz]e|reconcil|ingest|backfill|poll)\w*/i;
const DESIGN_ONLY_SCHEDULER_RECEIVER = /\b(cron|schedul\w*|agenda|bree|bull\w*|queue|worker)\b/i;

export function checkDesignOnlySyncSchedulerViolation(sourceCode: string): string | null {
  const sourceFile = parse(sourceCode);
  let violation: string | null = null;

  walk(sourceFile, (node) => {
    if (violation) {
      return;
    }

    if (
      ts.isNewExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'Worker'
    ) {
      violation = `Design-only production worker thread is constructed: "${node.getText(sourceFile)}"`;
      return;
    }

    if (!ts.isCallExpression(node)) {
      return;
    }

    const callee = node.expression;
    if (ts.isPropertyAccessExpression(callee)) {
      const receiverText = callee.expression.getText(sourceFile);
      if (callee.name.text === 'schedule' && DESIGN_ONLY_SCHEDULER_RECEIVER.test(receiverText)) {
        violation = `Design-only synchronization scheduler registration: "${node.getText(sourceFile)}"`;
      }
      return;
    }

    if (ts.isIdentifier(callee) && DESIGN_ONLY_TIMER_CALLEES.has(callee.text)) {
      const argumentText = node.arguments.map((argument) => argument.getText(sourceFile)).join(', ');
      if (DESIGN_ONLY_SYNC_CALLBACK.test(argumentText)) {
        violation = `Design-only synchronization scheduler registration: "${node.getText(sourceFile)}"`;
      }
    }
  });

  return violation;
}

export function checkDesignOnlyBackendDependencyViolation(
  dependencies: Record<string, string>,
): string | null {
  for (const dependency of Object.keys(dependencies)) {
    const rule = DESIGN_ONLY_BACKEND_RULES.find((candidate) => candidate.matches(dependency));
    if (rule) {
      return `Design-only production ${rule.label} is declared as a dependency: "${dependency}"`;
    }
  }
  return null;
}

const DESIGN_ONLY_INFRASTRUCTURE_PATHS = [
  'prisma',
  'prisma/schema.prisma',
  'server',
  'src/server',
  'worker',
  'workers',
  'src/worker',
  'src/workers',
  'jobs',
  'src/jobs',
  'schedulers',
  'src/schedulers',
  'sync',
  'src/sync',
  'infra',
  'infrastructure',
  'terraform',
  'k8s',
  'helm',
  'docker-compose.yml',
  'docker-compose.yaml',
  'Dockerfile',
  'drizzle.config.ts',
];

export function checkDesignOnlyInfrastructurePaths(repositoryRoot: string): string | null {
  for (const relativePath of DESIGN_ONLY_INFRASTRUCTURE_PATHS) {
    if (fs.existsSync(path.join(repositoryRoot, relativePath))) {
      return `Design-only production infrastructure exists at "${relativePath}"`;
    }
  }
  return null;
}
