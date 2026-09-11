---
name: deliver-ui-redesign
description: "Autonomously deliver the approved UI System Design through Herdr using role-separated DeepSeek sessions, specialized project-local UI skills, fresh browser/accessibility review, deterministic regression gates, and automatic child-pane cleanup."
---

# Deliver UI Redesign

Use this skill when asked to autonomously redesign, polish, or deliver the approved UI System Design for this repository.

## Preconditions

Verify:

    test "${HERDR_ENV:-}" = 1

If not running inside Herdr, stop. Do not orchestrate a different session from outside Herdr.

The installed Herdr CLI and the project-local herdr skill are syntax/mechanics authority.

## Read Order

Lead reads:

1. AGENTS.md
2. docs/agents/README.md
3. docs/agents/RUNTIME.md
4. docs/agents/ORCHESTRATION.md
5. docs/agents/PANE_LIFECYCLE.md
6. docs/agents/UI_SKILL_BOOTSTRAP.md
7. docs/system-design/system-design-v1.md
8. docs/ui-system-design/ui-system-design-v1.md
9. docs/decisions/0003-ui-system-design-authority.md
10. docs/plans/active/ui-redesign.md

Do not re-open the completed implementation plan as current workflow state.

## Phase 0 — Reconcile

Before dispatch:

- inspect current main HEAD;
- inspect working tree/worktrees;
- inspect existing Herdr panes/agents;
- inspect the active UI-redesign plan;
- close only proven-safe orphan child panes according to PANE_LIFECYCLE.md;
- never close the user/Lead pane.

Repository/Git/evidence outrank process badges.

## Phase 1 — Skill Bootstrap

Follow docs/agents/UI_SKILL_BOOTSTRAP.md.

Install only missing required skills project-locally.

Do not manually edit skills-lock.json hashes.

Use a bounded writer role for bootstrap changes, review the diff, commit it independently, then capture result and close that child pane.

## Phase 2 — UI Architecture Planning

Start a fresh read-only UI Architect/Lead role.

Load design-systems-frontend-architecture only for this phase.

Audit current source and current rendered UI against the approved UI System Design.

Produce bounded UI task contracts with:

- objective;
- UI design refs;
- System Design refs where semantics are involved;
- allowed paths/scope;
- forbidden changes;
- responsive seams;
- visual acceptance;
- accessibility-sensitive seams;
- required browser evidence;
- required regression commands;
- base commit.

Persist through a Workflow Scribe.

Do not change UI design authority merely because implementation is inconvenient.

## Phase 3 — Visual Implementation

For each READY implementation task:

- create/reuse a task worktree from its captured base commit;
- start a DeepSeek Builder;
- load frontend-design;
- provide only the bounded contract + relevant design fragments + relevant code;
- implement real working UI, not static mockups;
- preserve all system/business invariants;
- run targeted tests;
- commit coherent work;
- return a concise evidence capsule.

After capturing the capsule and confirming safe writer state, close the Builder child pane.

## Phase 4 — Fresh Visual / Responsive Review

After integrated visual work, start a fresh read-only Browser QA role.

Load webapp-testing.

Use native Browser Use/Chrome control when available; otherwise use browser automation/Playwright.

Inspect at least:

- 1280x800
- 834x1112
- 390x844

The reviewer must interact with the application, not only inspect source.

Report only reproducible findings with severity and affected UI-design requirement.

Close the QA child pane after findings are captured.

## Phase 5 — Fresh Accessibility Audit

Start a separate fresh read-only accessibility role.

Load check-fix-accessibility.

Audit keyboard, focus, semantics, validation, contrast, non-color status, touch targets, reduced motion, and responsive modal/sheet behavior.

Do not allow the implementation session to certify its own accessibility.

Close the audit child pane after findings are captured.

## Phase 6 — Repair Loop

Reconcile visual + accessibility findings.

For accepted defects:

- start a bounded Repairer;
- provide exact finding/reproduction/scope;
- implement the smallest compliant fix;
- rerun affected checks;
- re-review only the affected gate with a fresh session when material.

No unrelated cleanup.

Close completed Repairer/re-review panes as soon as evidence is captured.

## Phase 7 — Full Verification

Pin an integrated candidate and run:

    npm ci
    npm run typecheck
    npm run lint
    npm run test
    npm run build
    npm run test:e2e

Also run repository architecture suites and targeted browser visual checks.

A test may not be skipped, weakened, or rewritten only to make the redesign pass.

## Phase 8 — Fresh UI Compliance

Start a fresh read-only Compliance role.

Audit:

- full ui-system-design-v1.md;
- relevant System Design constraints;
- final candidate;
- task evidence;
- browser QA;
- accessibility audit;
- regression results.

Only this fresh Compliance role may decide:

    UI REDESIGN: PASS

FAIL/UNVERIFIED routes back to bounded repair.

## Pane Lifecycle — Mandatory

Every Lead-created child pane is temporary by default.

After each role:

1. capture complete output/evidence;
2. reconcile repository state;
3. verify not blocked;
4. gracefully exit/release the agent using current Herdr CLI capabilities;
5. close the child pane;
6. verify it disappeared from pane inventory.

Never auto-close:

- user pane;
- Lead pane;
- blocked agent;
- unresolved writer;
- required persistent server/browser pane.

At every wave boundary and final completion, run a pane reconciliation. Completed orphan panes are a workflow defect and must be cleaned before starting unnecessary new panes.

Use docs/agents/PANE_LIFECYCLE.md as the full policy.

## Terminal Conditions

Continue autonomously until exactly one terminal outcome:

    UI REDESIGN: PASS

or:

    BLOCKED: <genuine authority/environment/external blocker>

Do not stop for decisions already resolved by repository authority.

Do not dump transcripts. Report candidate identity, major UI changes, visual/browser evidence, accessibility result, regression gates, and explicit residual risks.
