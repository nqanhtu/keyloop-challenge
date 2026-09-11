-----BEGIN EVIDENCE-----
# Pagination Page Size (URL-owned) - evidence

Status: delivered and independently verified on release candidate 5b24ec0.

## Authority

- Decision: docs/decisions/0004-pagination-page-size.md (Accepted)
- Plan: docs/plans/completed/pagination-page-size.md
- Superseded clauses: System Design sections 5.2, 6.1 and 6.8; UI System Design sections 11.1 and 13

## Change

- pageSize is URL state: allowed values 25 / 50 / 100, default 50, and the default is omitted from the URL;
- changing the page size resets the page to 1;
- the control lives inside the pagination region (accessible name "Rows per page", id inventory-page-size), so the dashboard first two tab stops stay #inventory-sort then #inventory-aging-only;
- page size is a view control, not a filter constraint: it is never an active-filter chip and Clear all preserves it along with sort and the selected vehicle;
- the server always receives the effective, normalized page size.

## Commits

- V01, branch task/v01-page-size from base 4051f55: ffe84f9 (authority: Decision 0004 and the design-doc updates), 6e8f80e (feature: URL-owned page size and the pagination control), f0900eb (tests: unit, RTL/MSW and e2e). Integrated as main 3e9c7b6.
- V03b, branch task/v03b-normalize from base 3e9c7b6: 24d2745 (fix: normalize unsupported URL discovery values, finding F-01). Integrated as main 5b24ec0.

## Verification history

- V03 fresh independent verification on 3e9c7b6: every gate passed, but the reviewer reported F-01 (high severity): unsupported collection values typed into the URL were not normalized. `?pageSize=37` sent pageSize=37 and rendered 37 rows while the control showed 25; `?pageSize=abc` rendered "Page 1 of NaN"; `?pageSize=0` rendered "Page 1 of Infinity"; `?pageSize=1000` was forwarded verbatim; the same leak affected `?page=abc` and `?sort=bogus`. Root cause: TanStack Router merges the `validateSearch` result over the raw location search instead of replacing it, so a value that `parseInventorySearch` drops survives on `useSearch()`. Report: /tmp/v03-verify/report.md
- V03b repair: normalize the search once at the route boundary (src/app/router.tsx) and make `toVehicleListQuery` defensive about the page size. Additive tests were proven red/green: with the two source files stashed, the additive integration tests fail 6/6.
- V03c fresh independent re-verification on the final candidate 5b24ec0: all nine malformed URL states normalize at all three tiers (control 50, 50 rows, finite and correct "Page 1 of 2", request pageSize=50 with page=1 and the default sort); malformed tokens never re-serialize when the user then changes sort, page size or a filter; the designed behaviour was re-confirmed (25 and 100 row counts, URL updates, reset to page 1 on a size change, reload persistence, no horizontal overflow); no preserved contract regressed. Report: /tmp/v03c-verify/report.md

## Gates on the final candidate 5b24ec0 (fresh clean worktree)

- npm ci: PASS; npm run typecheck: PASS; npm run lint: PASS; npm run test: PASS (28 files, 281 tests); npm run build: PASS; npm run test:e2e: PASS (42 tests, 14 specs across the desktop, tablet and mobile projects).

## Accepted (not a defect)

- A hand-typed unsupported value may remain visible in the address bar while the behaviour is normalized, because the app does not rewrite the URL. This matches the pre-existing behaviour for page and sort and avoids a navigation loop.

## Process note

- The plan DAG originally listed V01 to V04 without a repair step; the V03 finding added V03b. Recorded as a plan-quality observation, not a product defect. The plan file now records V03b in its Current State.
-----END EVIDENCE-----
