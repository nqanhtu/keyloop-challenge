-----BEGIN EVIDENCE-----
# App Root Redirect to the Canonical Inventory Dashboard - evidence

Status: delivered and independently verified on candidate 87aa5b2.

## Approval basis

- User decision: opening the app root must show the inventory dashboard.
- Approved approach: the index route redirects to /inventory, which stays the single canonical dashboard URL, and the incoming query string is carried through the redirect.
- Treated as a bounded change under AGENTS.md ("For a bounded change, inspect affected behavior and proof, implement, and validate. No control-plane operation is required"), so this note is the durable record instead of a plan file.

## Change

- src/app/router.tsx: the index route no longer renders the "Foundation ready." placeholder page. It redirects to /inventory with the incoming search carried through, so a shared link still works and /inventory keeps sole ownership of search normalization. The placeholder component and its unused import were deleted. The /inventory route keeps its path, validateSearch, component and normalization unchanged.
- src/app/App.test.tsx: the obsolete placeholder assertion was replaced by an equivalent-or-stronger assertion that entering at the root resolves to the dashboard ("Inventory results" region). No other assertion in that file changed.
- Additive tests: src/app/router.test.tsx and e2e/routing.spec.ts.

## Commit and integration

- Commit e703254 "feat(routing): redirect the app root to the canonical /inventory dashboard" on branch task/v05-root-redirect, based on fbc21cd.
- Integrated on main as 87aa5b2 "merge: integrate V05 root-to-inventory redirect".

## Verification (fresh read-only session, candidate 87aa5b2)

- Gates in a clean worktree: npm ci, npm run typecheck, npm run lint, npm run test (29 files, 283 tests), npm run build and npm run test:e2e (48 tests) - all passed.
- Real browser at 1280x800, 834x1112 and 390x844: "/" settles on /inventory with the level-1 heading and the "Inventory results" region; "/inventory" is unchanged; "/?agingOnly=true" lands at /inventory?agingOnly=true with the filter applied; "/?make=BMW&pageSize=37" applies make=BMW, keeps the page-size control at 50 and sends pageSize=50 to the server; no redirect loop and no console or page errors; filters, page size, detail open/close and the absence of horizontal overflow all verified.
- Preserved contracts: the first two tab stops remain #inventory-sort then #inventory-aging-only, and the "Inventory results" region plus the pagination navigation are present.
- Report: /tmp/v05-verify/report.md

## Accepted / residual

- The address bar may keep a hand-typed raw collection value (for example pageSize=37) while behaviour normalizes to the designed default. Accepted and consistent with the earlier accepted behaviour for page and sort.
- The redirect is client-side; a direct server request to "/" depends on the existing SPA fallback, which this change did not alter.

## Process note

- Independent verification recorded V05-INFO-01 (low, provenance): the bounded change had no persisted plan or task contract. This evidence note closes that gap.
-----END EVIDENCE-----
