# 0003 — UI System Design Authority and Autonomous Redesign

Date: 2026-09-11

## Status

Accepted

## Context

The initial implementation completed the approved functional System Design and reached RELEASE: PASS, but the resulting dashboard remains visually minimal. It does not yet express the level of visual hierarchy, operational scanability, responsive polish, and accessibility maturity expected from a strong production-facing frontend submission.

The existing System Design remains authoritative for product semantics, business rules, API behavior, data ownership, and implementation scope. UI presentation now needs its own durable authority so implementation agents do not invent visual or interaction decisions ad hoc.

## Decision

Create and maintain a separate UI authority:

    docs/ui-system-design/ui-system-design-v1.md

Authority precedence:

    Business semantics / API / data ownership
      -> docs/system-design/system-design-v1.md

    UI hierarchy / responsive presentation / interaction / visual system / accessibility
      -> docs/ui-system-design/ui-system-design-v1.md

    Explicit accepted decisions
      -> docs/decisions/*.md

If the UI System Design conflicts with business semantics or implementation scope in the System Design, the System Design wins unless a later accepted decision explicitly changes that authority.

## Autonomous UI Delivery

UI redesign work follows the existing Herdr + DeepSeek role-separated workflow using the project-local deliver-ui-redesign skill.

Required external skills are installed project-locally according to:

    docs/agents/UI_SKILL_BOOTSTRAP.md

Approved specialized skills:

- design-systems-frontend-architecture — UI system/component/layout architecture;
- frontend-design — production-grade visual execution;
- check-fix-accessibility — independent WCAG-oriented audit and repair guidance;
- webapp-testing — real-browser/local-web-app exploratory verification support.

These skills provide procedural guidance only. Repository authority remains the System Design, UI System Design, accepted decisions, task contracts, and executable evidence.

## Runtime Pane Lifecycle

Autonomous child agents must not leave completed Herdr panes behind.

Every Lead-created child pane is temporary unless explicitly designated persistent. Once its role has finished and its final output/evidence has been captured, the orchestrator must gracefully terminate the child agent and close the pane according to:

    docs/agents/PANE_LIFECYCLE.md

The user/Lead pane, blocked panes requiring input, panes with unresolved uncommitted writer state, and explicitly persistent dev-server/browser panes must not be closed prematurely.

## Consequences

Positive:

- UI decisions become explicit and reviewable instead of emerging from CSS implementation.
- Responsive behavior and accessibility become design requirements, not cleanup tasks.
- Visual redesign can be automated without weakening existing business/system architecture.
- Fresh design, implementation, visual-QA, accessibility, and compliance sessions remain independently reviewable.
- Herdr stays clean because completed child panes are closed automatically.

Trade-offs:

- The repository gains a second design document and an additional delivery skill.
- UI changes that intentionally alter interaction semantics must update UI authority first rather than silently changing source.
- Visual quality still requires observable browser review; unit tests alone are not sufficient.
