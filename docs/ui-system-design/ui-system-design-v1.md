# UI System Design — Intelligent Inventory Dashboard

> Product: Keyloop Intelligent Inventory Dashboard  
> Authority: UI information architecture, visual system, responsive presentation, interaction behavior, and accessibility  
> Business/system authority: docs/system-design/system-design-v1.md  
> Version: 1.0  
> Status: Approved for implementation

---

## 1. Purpose

This document defines the UI system for the Intelligent Inventory Dashboard.

The dashboard is an operational decision surface for dealership managers. It must make aging inventory, current manager action coverage, data freshness, and the next useful action understandable within seconds.

This is not a marketing page and should not look like a generic form-and-table admin template.

Visual direction:

    calm enterprise
    + dense operational clarity
    + automotive inventory context
    + deliberate visual hierarchy

The interface should feel polished and confident without becoming decorative or visually noisy.

---

## 2. UI Goals

The interface must optimize for:

1. Immediate scanability — aging inventory and missing manager actions are visible quickly.
2. Actionability — a manager can move from overview to vehicle-specific action with minimal navigation.
3. Information density without clutter — desktop uses space efficiently while mobile prioritizes essential information.
4. Semantic clarity — lifecycle, aging condition, and manager action are visually distinct concepts.
5. Responsive continuity — mobile/tablet are task-prioritized layouts, not compressed desktop layouts.
6. Accessible operation — the complete primary flow works with keyboard and assistive technology and does not rely on color alone.
7. Stable feedback — loading, stale, error, optimistic, and empty states preserve context instead of replacing the whole application.

---

## 3. Non-Goals

The redesign must not introduce new business capabilities that are not already authorized.

Do not add:

- global search unless separately authorized;
- analytics/trend data that the API does not provide;
- pricing recommendations;
- new lifecycle states;
- new manager-action semantics;
- production backend behavior;
- decorative charts with invented metrics;
- hidden client-side filtering/sorting that bypasses the HTTP contract.

Visual polish must not alter business rules from the System Design.

---

## 4. Design Principles

### 4.1 Operational first

The page answers these questions in order:

    Is the inventory data trustworthy/fresh?
    What needs attention?
    Which vehicles are affected?
    What action has already been taken?
    What can I do next?

### 4.2 Exceptions receive emphasis

Normal inventory should remain calm. Aging inventory and stale-data conditions receive stronger semantic emphasis.

### 4.3 Meaning is layered

These concepts must never collapse into one ambiguous badge:

    Inventory lifecycle  -> AVAILABLE / RESERVED / SOLD / UNAVAILABLE
    Inventory condition  -> AGING / Not aging
    Manager action       -> action status / No current action

### 4.4 Visual emphasis is never the only meaning

Color, border, icon, or background may reinforce a state, but readable text must communicate the state independently.

### 4.5 Density changes by viewport

Desktop may be information-dense. Mobile progressively discloses secondary information rather than shrinking every desktop field.

---

## 5. Information Architecture

Dashboard hierarchy:

    1. Page identity + freshness
    2. Inventory health summary
    3. Quick operational controls
    4. Detailed filtering
    5. Inventory results
    6. Vehicle-specific detail/action workflow

A user should not need to open detail to know:

- whether a vehicle is aging;
- its inventory age;
- its inventory lifecycle;
- whether a current manager action exists.

---

## 6. Dashboard Anatomy

### 6.1 Desktop reference composition

    ┌──────────────────────────────────────────────────────────────────┐
    │ Inventory Command Center                         Freshness state │
    │ Short operational subtitle                       Last updated …  │
    ├──────────────────────────────────────────────────────────────────┤
    │ Total Inventory │ Aging Vehicles │ Aging With Action             │
    ├──────────────────────────────────────────────────────────────────┤
    │ Quick controls: Aging only · Sort                               │
    ├──────────────────────────────────────────────────────────────────┤
    │ Make · Model · Age range · Inventory status · Action status      │
    │ Active filter chips                                    Clear all │
    ├──────────────────────────────────────────────────────────────────┤
    │ Inventory results                                          count │
    │ table/card results + current action + detail affordance         │
    ├──────────────────────────────────────────────────────────────────┤
    │                                                pagination        │
    └──────────────────────────────────────────────────────────────────┘

### 6.2 Content container

- Center the operational surface on large displays.
- Use a readable maximum content width; do not let the table become visually unbounded on ultra-wide displays.
- Preserve enough width for a desktop detail drawer without collapsing inventory context.

### 6.3 Header

Header contains:

- product/page title;
- one-line purpose statement;
- last successful sync timestamp;
- freshness state.

The stale-data warning belongs to the operational header, not as an unrelated floating message.

---

## 7. Visual Direction

### 7.1 Character

Use a restrained operational aesthetic:

- neutral/slate surfaces;
- crisp borders;
- strong typography hierarchy;
- limited radius scale;
- semantic amber for aging attention;
- blue/indigo interactive emphasis;
- green only for explicitly healthy/success states;
- red only for errors/destructive meaning.

Avoid:

- purple-gradient SaaS styling;
- excessive glassmorphism;
- uniformly oversized rounded cards;
- decorative charts without business meaning;
- gratuitous animation;
- giant whitespace that reduces data density.

### 7.2 Surface hierarchy

Use no more than four primary surface levels:

    canvas
    panel
    raised/interactive surface
    semantic status surface

KPI cards, filters, results, and detail surfaces must be visually related but not indistinguishable.

### 7.3 Borders and elevation

Prefer border/contrast separation over heavy shadows.

Elevation is reserved for:

- detail drawer/sheet;
- filter sheet;
- menus/popovers;
- transient overlays.

---

## 8. Semantic Design Tokens

Implementation should expose semantic CSS variables/tokens rather than scattering literal values.

Reference palette:

    --ui-canvas:            #F6F8FB
    --ui-surface:           #FFFFFF
    --ui-surface-muted:     #F1F5F9
    --ui-text-primary:      #0F172A
    --ui-text-secondary:    #475569
    --ui-border:            #D8E0EA

    --ui-interactive:       #1D4ED8
    --ui-interactive-hover: #1E40AF
    --ui-focus:             #2563EB

    --ui-aging-text:        #9A3412
    --ui-aging-bg:          #FFF7ED
    --ui-aging-border:      #FDBA74

    --ui-success-text:      #166534
    --ui-success-bg:        #F0FDF4

    --ui-error-text:        #B42318
    --ui-error-bg:          #FEF3F2

Exact implementation values may be adjusted only if contrast and semantic relationships are preserved.

Spacing reference scale:

    4 / 8 / 12 / 16 / 24 / 32 / 48

Radius reference:

    small controls: 6-8px
    cards/panels: 10-12px
    pills/status chips: pill radius

Touch-oriented interactive controls must target at least 44 × 44 CSS px unless a dense desktop-only table uses an equivalent accessible target.

---

## 9. Typography

Typography must create clear operational hierarchy.

| Role | Intent |
|---|---|
| Page title | Strong identity, compact line height |
| Section title | Separates operational regions |
| KPI value | Highest numeric emphasis |
| KPI label | Secondary uppercase/compact label |
| Body | High readability at dense dashboard scale |
| Metadata | Lower-emphasis timestamps/IDs |
| Status label | Medium/semibold semantic text |

Avoid using size alone for hierarchy. Weight, spacing, case, and color may reinforce structure.

A distinctive but highly readable sans-serif may be chosen by implementation. Do not add a remote font dependency unless reliable for the challenge environment; maintain a strong local/system fallback.

---

## 10. KPI System

Required KPIs remain:

    Total Inventory
    Aging Vehicles
    Aging With Action

Rules:

- Aging Vehicles receives the strongest attention treatment when non-zero.
- Aging With Action communicates operational coverage, not success by color alone.
- KPI values use large readable numerals.
- Supporting microcopy may explain meaning but must not invent data.

Allowed example:

    AGING VEHICLES
    3
    Require manager attention

Do not invent trends, percentages, or comparisons unless backed by API data.

---

## 11. Responsive Layout Contract

Reference presentation tiers:

    mobile:  width < 768px
    tablet:  768px <= width < 1024px
    desktop: width >= 1024px

Breakpoints are semantic presentation tiers, not device detection.

### 11.1 Desktop

- Full inventory table.
- High-frequency filters visible inline.
- Secondary filters remain directly reachable without leaving context.
- Detail opens as a right-side drawer.
- Inventory context remains visible behind/beside detail.
- Pagination remains visible beneath results and includes the page-size control.

### 11.2 Tablet

- Compact inventory table.
- Lower-priority fields are hidden or condensed.
- Filters use an adaptive sheet when horizontal space is insufficient.
- Detail opens as a wide sheet with visible page context.
- Touch targets follow the 44px minimum.

### 11.3 Mobile

- Inventory renders as cards/list, not a horizontally scrolling desktop table.
- Filter controls live in a dedicated full-width sheet.
- Detail becomes full-screen.
- Cards prioritize:
  1. make/model;
  2. age + aging condition;
  3. inventory lifecycle;
  4. current manager action;
  5. detail/action affordance.
- VIN and stocked date may move to secondary/card detail content.
- No horizontal page overflow is permitted.

---

## 12. Inventory Result Contract

### 12.1 Field priority

| Information | Desktop | Tablet | Mobile |
|---|---|---|---|
| Make / Model | primary | primary | primary |
| VIN | visible | condensed/visible | secondary |
| Stocked date | visible | optional | detail/secondary |
| Inventory age | primary numeric | primary | primary |
| Aging condition | prominent | prominent | prominent |
| Lifecycle status | visible | visible | visible |
| Current action | prominent | prominent | prominent |
| Detail affordance | visible | visible | visible |

### 12.2 Aging presentation

An aging vehicle must expose both:

    AGING
    <age> days

Visual emphasis may include a semantic pill, border accent, or subtle row/card background, but readable text remains mandatory.

### 12.3 Row behavior

- Hover/focus must make the active row/trigger obvious.
- Avoid using every cell as a competing visual badge.
- Current action may use a semantic chip plus supporting text.
- No current action must remain easy to scan because it is operationally important.
- The detail trigger must have an accessible name with enough vehicle context when needed.

---

## 13. Filter System

Filters remain:

    make
    model
    minimum age
    maximum age
    inventory lifecycle status
    manager action status
    aging only
    sort

### 13.1 Grouping

Quick controls:

- Aging only
- Sort

Inventory filters:

- Make
- Model
- Age range
- Inventory status
- Action status

Result controls (rendered with the pagination region):

- Page size (25 / 50 / 100, default 50)

### 13.2 Behavior

    filter change
      -> update URL
      -> reset page to 1
      -> request server-filtered results
      -> preserve dashboard shell

    page size change
      -> update URL
      -> reset page to 1
      -> request the server page

Make/model dependency:

    make changes
      -> request valid models for make
      -> invalid selected model is removed

### 13.3 Active-filter visibility

Applied filters appear as removable chips. Clear all removes collection filters and returns to the default collection state without destroying unrelated vehicle-detail context unless the interaction explicitly closes detail.

Page size is a view control, not a filter constraint, so it never appears as an
active-filter chip and Clear all preserves the selected page size.

### 13.4 Mobile/tablet sheet

- Sheet has a clear accessible title.
- Current selections are visible.
- Close/cancel behavior is predictable.
- Focus is trapped only while modal behavior is active.
- Closing restores focus to the filter trigger.

---

## 14. Vehicle Detail Surface

Content order is fixed:

    Vehicle summary
    Current action
    Create action
    Action history

### 14.1 Vehicle summary

Visually distinguish:

- make/model;
- VIN;
- lifecycle;
- stocked date;
- inventory age;
- aging condition.

### 14.2 Current action

Current action must be recognizable without reading the full history.

Show:

- status;
- actor display name;
- timestamp;
- note when present.

If no current action exists, show an explicit neutral empty state.

### 14.3 Create action

- Active status options come from the API.
- Note remains optional.
- Submit is visually primary within the form, not globally dominant over the dashboard.
- Pending state prevents duplicate submission.
- Validation is programmatically associated with the relevant control.
- Business rejection remains local to the form/detail region.

### 14.4 History

History is newest-first and visually chronological.

Each item exposes:

- status;
- actor;
- timestamp;
- note if present.

Do not visually imply historical actions are editable.

---

## 15. Interaction and Mutation States

Action creation state:

    idle
      -> submitting
      -> optimistic current action
           -> success -> reconcile authoritative response
           -> failure -> rollback previous current action + local error

Rules:

- Do not blank the list/detail during mutation.
- Do not lose user context on failure.
- Do not promote expected business rejection to a full-page error.
- Success should not require a modal confirmation if the updated current action/history already proves completion.

Motion must be subtle and respect prefers-reduced-motion.

---

## 16. Loading, Empty, Error, and Stale States

| Region | Loading | Empty | Error | Stale |
|---|---|---|---|---|
| Header/freshness | timestamp skeleton or previous value | N/A | non-blocking state | warning |
| KPI | local skeleton | legitimate zero | regional retry/message | previous values |
| Inventory results | row/card skeleton | inventory/no-match copy | regional retry | retain previous rows |
| Detail | local skeleton | N/A | detail-local retry | previous safe content |
| Action form | disabled pending state | N/A | inline/regional message | N/A |
| History | local skeleton | explicit no-history copy | local retry | previous data |

Required empty copy remains:

    No vehicles in inventory.
    No vehicles match the current filters.

Stale inventory remains visible. The UI warns that displayed data is the last successfully synchronized inventory.

---

## 17. Accessibility Contract

Target: WCAG 2.2 Level A/AA behavior for the implemented dashboard.

Requirements:

1. Every interactive control has an accessible name.
2. Desktop/tablet table presentation uses real table semantics.
3. Mobile cards use appropriate list/article/group semantics instead of fake table semantics.
4. Keyboard users can complete the primary manager journey.
5. Visible focus is always present for keyboard navigation.
6. Opening detail moves focus into a sensible location in the detail surface.
7. Closing detail restores focus to the originating vehicle trigger when available, with a deterministic fallback.
8. Modal/sheet focus behavior does not strand focus on body.
9. Validation messages are programmatically associated with relevant fields.
10. Aging condition, stale status, lifecycle, and action status do not rely on color alone.
11. Text/background and interactive-state contrast meet WCAG AA.
12. Touch-oriented controls meet the 44 × 44 CSS px target.
13. Reduced-motion preference is respected.
14. Important status changes use an appropriate live-region strategy without excessive screen-reader noise.

Accessibility fixes must preserve product semantics and visual hierarchy.

---

## 18. Focus and Keyboard Model

Primary keyboard path:

    page controls
    -> filters
    -> inventory results
    -> vehicle detail trigger
    -> detail heading/content
    -> action status
    -> optional note
    -> submit
    -> updated current action/history
    -> close detail
    -> originating vehicle trigger

Do not require pointer hover to reveal a required control.

Escape may close modal/sheet/detail surfaces when doing so does not unexpectedly lose required unsaved information.

---

## 19. Motion and Feedback

Motion is functional:

- sheet/drawer entrance;
- subtle optimistic-state transition;
- focus/hover feedback.

Reference duration:

    120-220ms

Avoid long easing, parallax, decorative looping animation, or movement that competes with inventory scanning.

Under prefers-reduced-motion: reduce, non-essential transitions are removed or shortened substantially.

---

## 20. Component Architecture

Reference component families:

    DashboardShell
      Header / FreshnessStatus
      KpiGrid / KpiCard
      QuickControls
      FilterPanel
      ActiveFilterChips
      InventoryResults
        DesktopInventoryTable
        TabletInventoryTable
        MobileVehicleCards
      Pagination
      VehicleDetailSurface
        VehicleSummary
        CurrentAction
        ActionForm
        ActionHistory

Components should share semantic tokens and primitives instead of unrelated one-off visual rules.

Prefer composable primitives over a large speculative component library.

---

## 21. Browser and Responsive Verification

Visual/responsive verification must use real browser rendering.

Reference viewports:

    desktop: 1280 × 800
    tablet:   834 × 1112
    mobile:   390 × 844

At minimum verify:

- no unintended horizontal overflow;
- dashboard hierarchy is immediately understandable;
- aging vehicles are identifiable without hunting;
- filters are usable and not visually overwhelming;
- table/card information priority matches this document;
- drawer/sheet/fullscreen geometry matches its tier;
- current action and no-action states are easy to distinguish;
- focus and hover are visible;
- touch targets satisfy the contract;
- text remains readable at browser zoom;
- stale/error/loading states preserve surrounding context.

Browser inspection is exploratory evidence. The repository Playwright suite remains the deterministic E2E release gate.

---

## 22. Visual Quality Review

A UI change is not complete merely because tests pass.

Fresh visual review explicitly evaluates:

    hierarchy
    spacing rhythm
    alignment
    density
    typography
    semantic color use
    component consistency
    responsive composition
    empty/loading/error polish
    focus/hover/pressed states

Reject:

- generic default-browser form appearance;
- visually flat page regions with no hierarchy;
- arbitrary one-off spacing;
- excessive badges;
- inconsistent radii/borders;
- desktop layouts that collapse awkwardly on tablet;
- mobile layouts that merely hide data without preserving task priority.

---

## 23. Implementation Constraints

- Preserve the HTTP boundary.
- Preserve TanStack Query server-state ownership.
- Preserve URL-owned filters/sort/page.
- Do not recompute aging in frontend code.
- Do not introduce client-side re-filtering/re-sorting of server pages.
- Do not access mock persistence directly from feature code.
- Do not change manager-action business semantics.
- Do not implement production backend/infrastructure.
- Prefer CSS/design-system improvements over new runtime dependencies.
- Any new dependency requires explicit justification in task evidence.

---

## 24. Acceptance Summary

The redesigned UI is acceptable only when all are true:

- visual hierarchy clearly prioritizes freshness, aging inventory, and manager-action coverage;
- desktop/tablet/mobile each use the intended presentation model;
- aging condition is prominent and non-color-only;
- filters are grouped, readable, URL-owned, and responsive;
- inventory results are materially easier to scan than the original implementation;
- detail/action/history preserve required content order and semantics;
- loading/empty/error/stale states are polished and contextual;
- keyboard and focus behavior satisfy the accessibility contract;
- fresh accessibility audit reports no unresolved high/critical WCAG A/AA defects;
- real-browser visual QA passes at reference viewports;
- existing unit/integration/architecture/E2E gates remain green;
- no business/system architecture authority is violated.
