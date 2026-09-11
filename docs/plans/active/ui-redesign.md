# Execution Plan: UI System Redesign

Date: 2026-09-11

## Status

Active

## Outcome

Redesign the Intelligent Inventory Dashboard into a polished, production-grade operational interface while preserving all approved business/system behavior and existing release-quality engineering boundaries.

UI authority:

- docs/ui-system-design/ui-system-design-v1.md
- docs/system-design/system-design-v1.md
- docs/decisions/0003-ui-system-design-authority.md

## Runtime

Use the existing DeepSeek-only role separation through Herdr.

Entry skill:

    deliver-ui-redesign

Required specialized skill bootstrap:

    docs/agents/UI_SKILL_BOOTSTRAP.md

Child-pane lifecycle:

    docs/agents/PANE_LIFECYCLE.md

## Invariants

The redesign must not change:

- backend/API semantics;
- aging calculation authority;
- server-side filtering/sorting/pagination semantics;
- manager-action append-only semantics;
- URL-owned collection state;
- TanStack Query server-state ownership;
- design-only production backend scope.

## Delivery DAG

    U01 Skill Bootstrap
            |
            v
    U02 UI Architecture / Implementation Plan
            |
            v
    U03 Visual Redesign Implementation
            |
            v
    U04 Fresh Visual + Responsive Browser Review
            |
            v
    U05 Fresh Accessibility Audit
            |
            v
    U06 Bounded Repairs (only if findings)
            |
            v
    U07 Full Regression + Browser/E2E Verification
            |
            v
    U08 Fresh UI Compliance
            |
            v
    UI REDESIGN: PASS

U04 and U05 may run in parallel only after U03 is integrated and both remain read-only. Repairs are serialized after findings are reconciled.

## U01 — Skill Bootstrap

Goal:

Install the four approved project-local UI skills exactly as defined in docs/agents/UI_SKILL_BOOTSTRAP.md.

Acceptance:

- required skills are present project-locally;
- skills-lock.json is updated by the skills CLI, not manually;
- bootstrap diff contains no product source change;
- install commit is separate and reviewable.

## U02 — UI Architecture / Implementation Plan

Goal:

Audit current implementation against the approved UI System Design and create bounded implementation tasks.

Use:

    design-systems-frontend-architecture

Must identify:

- semantic token/CSS architecture changes;
- component-level redesign targets;
- desktop/tablet/mobile layout work;
- current UI states requiring polish;
- accessibility-sensitive interaction seams;
- browser verification seams;
- paths likely to overlap.

Do not rewrite the approved UI System Design unless a genuine authority gap is found. A gap becomes decision/blocker work rather than an implementation guess.

## U03 — Visual Redesign Implementation

Use:

    frontend-design

Implement the approved UI design.

Focus:

- visual hierarchy;
- semantic tokens;
- dashboard/header/freshness treatment;
- KPI hierarchy;
- filter grouping;
- inventory scanability;
- status/action semantics;
- responsive composition;
- detail surface polish;
- loading/empty/error/stale polish;
- hover/focus/pressed states;
- reduced-motion support.

Do not add unsupported product features or invented data.

## U04 — Fresh Visual + Responsive Browser Review

Fresh read-only session.

Use browser tooling plus:

    webapp-testing

Reference viewports:

- 1280x800
- 834x1112
- 390x844

Review must report concrete findings for:

- hierarchy;
- alignment/spacing;
- overflow;
- density;
- typography;
- table/card scanability;
- filter usability;
- drawer/sheet/fullscreen geometry;
- status semantics;
- hover/focus;
- loading/empty/error/stale presentation.

Screenshots may support findings, but DOM/geometry/interaction evidence is preferred for reproducibility.

## U05 — Fresh Accessibility Audit

Fresh read-only session using:

    check-fix-accessibility

Audit against the UI System Design accessibility contract and WCAG 2.2 A/AA-oriented guidance.

Must cover:

- keyboard-only primary journey;
- visible focus;
- focus entry/return;
- form labels and validation association;
- table/card semantics;
- non-color-only state communication;
- contrast;
- touch target sizing;
- reduced motion;
- modal/sheet focus behavior.

## U06 — Bounded Repair

Create repairs only from concrete U04/U05 findings.

Repairer receives:

- finding;
- reproduction/evidence;
- smallest allowed path scope;
- affected UI requirement;
- required re-verification.

Do not opportunistically redesign unrelated surfaces.

## U07 — Full Regression

Run from a clean state:

    npm ci
    npm run typecheck
    npm run lint
    npm run test
    npm run build
    npm run test:e2e

Additionally rerun relevant browser visual checks and architecture checks.

Existing functional/e2e tests must not be weakened to accommodate redesign.

## U08 — Fresh UI Compliance

Fresh read-only Compliance session audits the final candidate against the complete UI System Design plus relevant System Design boundaries.

Every MUST-level UI requirement is:

    PASS
    FAIL
    UNVERIFIED
    NOT_APPLICABLE

No FAIL/UNVERIFIED is allowed for UI REDESIGN: PASS.

## Pane Hygiene Gate

At the end of every U-task and every parallel wave:

- capture role output/evidence;
- reconcile writer state;
- close finished child panes according to docs/agents/PANE_LIFECYCLE.md;
- verify no completed orphan child pane remains.

Pane cleanup is part of orchestration completion, not optional manual housekeeping.

## Current State

- [x] U01 Skill Bootstrap
- [x] U02 UI Architecture / Implementation Plan
- [x] U03 Visual Redesign Implementation
- [x] U04 Fresh Visual + Responsive Browser Review
- [x] U05 Fresh Accessibility Audit
- [x] U06 Bounded Repairs if required
- [x] U07 Full Regression
- [ ] U08 Fresh UI Compliance
- [ ] UI REDESIGN: PASS

U01 result: e605376 installed the four approved project-local UI skills (design-systems-frontend-architecture, frontend-design, check-fix-accessibility, webapp-testing).

U02 result: UI architecture plan and the bounded U03 visual-redesign Task Contract persisted at docs/agents/tasks/U03.md; Codex Lead resolved all six architect open questions from repository authority.

U03 result: implemented in three commits (fd3ce7f, 03d1439, ab62ac2) on task/u03-ui-redesign and integrated as main 043069e; evidence at docs/agents/evidence/U03.md.

U04 result: fresh browser review at 1280x800, 834x1112 and 390x844 recorded 9 findings (1 high, 5 medium, 3 low); evidence at docs/agents/evidence/U04.md.

U05 result: fresh accessibility audit recorded 5 findings (2 high, 2 medium, 1 low); focus containment and muted-token contrast are the release-blocking items; evidence at docs/agents/evidence/U05.md.

U06 status: repair task dispatched from the reconciled U04 and U05 finding set; U03/U04/U05 checkboxes stay marked as reviewed, not as released.

U06 result: 11 reconciled findings repaired in two commits and integrated as main 1f9b73e; a fresh independent verification session confirmed RP-1 .. RP-11 FIXED; evidence at docs/agents/evidence/U06.md.

U06b result: the remaining modal background-scroll residual (R-01) repaired in dbb908c and integrated as main 93a62fd; evidence at docs/agents/evidence/U06.md.

U07 result: full regression on the clean release candidate 93a62fd4e9220eb21dc0c6e2cebe0e6ba7609273 - npm ci, typecheck, lint, 253 unit tests, build and 36/36 browser e2e all PASS, architecture suites 85/85 PASS, no test weakened; evidence at docs/agents/evidence/U07.md.

U08 status: fresh read-only UI compliance audit dispatched against candidate 93a62fd4e9220eb21dc0c6e2cebe0e6ba7609273.
