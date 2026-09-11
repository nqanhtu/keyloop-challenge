-----BEGIN PLAN-----
# Execution Plan: URL-Owned Page Size

Date: 2026-09-11

## Status

Active

## Outcome

Add a user-selectable, URL-owned page size (25 / 50 / 100, default 50) to the inventory pagination, replacing the fixed 50-record presentation constant.

## Authority

- User decision (this session): page size is URL-owned with options 25 / 50 / 100 and default 50.
- New decision record: docs/decisions/0004-pagination-page-size.md
- Supersedes the fixed page-size clauses in docs/system-design/system-design-v1.md sections 5.2, 6.1 and 6.8 and docs/ui-system-design/ui-system-design-v1.md sections 11.1 and 13.

## Invariants

Must not change:

- server-side filtering, sorting and pagination semantics (page size is still applied by the server);
- aging calculation authority;
- manager-action append-only semantics;
- TanStack Query server-state ownership;
- design-only production backend scope;
- the first two tab stops of the dashboard (#inventory-sort, then #inventory-aging-only);
- every preserved observable contract listed in docs/agents/tasks/U03.md Appendix A.

## Delivery DAG

    V01 Authority + Implementation (bounded writer)
          |
          v
    V02 Integration onto main
          |
          v
    V03 Fresh regression + 3-tier browser and accessibility verification
          |
          v
    V04 Evidence + plan completion

## V01 — Authority + Implementation

Goal: update the design authority and implement the URL-owned page size.

Acceptance:

- docs/decisions/0004-pagination-page-size.md records the decision and supersedes the fixed-page-size clauses;
- System Design sections 5.2, 6.1 and 6.8 and UI System Design sections 11.1 and 13 describe the URL-owned page size;
- pageSize is URL state with allowed values 25, 50 and 100 and default 50; a value of 50 is omitted from the URL;
- changing the page size resets the page to 1;
- the server query sends the selected page size and the page count is derived from it;
- the control lives with the pagination region so the documented tab order is unchanged;
- the control has an accessible name and meets the target-size contract;
- additive tests cover the URL state, the request query, the reset behaviour and the rendered page.

## V02 — Integration

Integrate the reviewed writer branch onto main without squashing task commits.

## V03 — Verification

- Full gates: npm ci, typecheck, lint, test, build, test:e2e.
- Fresh browser verification at 1280x800, 834x1112 and 390x844: selecting 25 / 50 / 100 changes the rendered row count, updates the URL, resets to page 1, survives reload, and causes no horizontal overflow.
- Accessibility of the new control: accessible name, keyboard operation, visible focus, target size, contrast.

## V04 — Completion

- Evidence recorded under docs/agents/evidence/pagination-page-size.md;
- plan moved to docs/plans/completed/.

## Current State

- [ ] V01 Authority + Implementation
- [ ] V02 Integration
- [ ] V03 Verification
- [ ] V04 Evidence + plan completion
-----END PLAN-----
