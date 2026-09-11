# 0004 — URL-Owned Page Size

Date: 2026-09-11

## Status

Accepted

## Context

Inventory pagination was implemented with page size as a fixed presentation
constant: `System Design 6.8` said "Approximately 50 records are rendered per
page" and the frontend hard-coded a single page size. Filters, sort, and page
were the only URL-owned discovery state, so a manager could not choose how many
records to review at once.

The user has approved making page size a user-selectable, URL-owned value with
options 25, 50, and 100 and a default of 50. This is a product-presentation
choice that the fixed-constant policy no longer expresses, so it needs a
durable decision rather than an implementation-local default.

## Decision

Page size becomes URL-owned discovery state:

- Allowed values are 25, 50, and 100 records per page.
- The default page size is 50.
- The default value 50 is omitted from the URL; only 25 and 100 appear.
- Changing the page size resets the page to 1, because the previous page number
  is no longer meaningful after the result set is re-partitioned.
- The server remains the authority for filtering, sorting, and pagination: the
  client always sends the effective page size to the server query.

This decision supersedes the fixed-page-size clauses in:

- System Design section 5.2;
- System Design section 6.1 (the URL-state row now includes page size);
- System Design section 6.8;
- UI System Design section 11.1;
- UI System Design section 13.

## Alternatives Considered

1. Keep page size a fixed presentation constant. Rejected: the user decision
   supersedes the fixed-constant policy and the value is now user-selectable.
2. Keep page size in local React state. Rejected: discovery state is URL-owned
   (System Design 6.1), so a shareable URL must reproduce the selected size.
3. Allow arbitrary page sizes. Rejected: the approved options are exactly
   25 / 50 / 100, and an unconstrained value would send unsupported sizes to
   the server.

## Consequences

Positive:

- Managers can choose a denser or more spacious page for the task at hand.
- The selected page size is shareable and survives reload because the URL owns
  it.
- The server query, the rendered page, and the page count all agree on one
  effective page size.

Tradeoffs:

- Page size is a view control, not a filter constraint, so it is not an
  active-filter chip and Clear all must preserve it (along with sort and the
  URL-owned vehicle-detail selection).
- The page-size control must live inside the pagination region so it does not
  become an extra focusable element before the dashboard's first two tab stops
  (`#inventory-sort`, then `#inventory-aging-only`).
- A larger page size renders more rows at once; page-based pagination still
  bounds render cost, so virtualization remains unnecessary.

## Follow-Up

- None.
