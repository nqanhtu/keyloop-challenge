# Documentation Map

This directory contains the design, delivery, and verification record for the
Keyloop Scenario B submission.

## Start Here

- [System Design](system-design/system-design-v1.md) — final product and
  end-to-end architecture authority.
- [UI System Design](ui-system-design/ui-system-design-v1.md) — responsive UI,
  interaction, visual-system, and accessibility authority.
- [Decisions](decisions/README.md) — accepted decisions that refine the design.
- [Completed plans](plans/completed/) — implementation and UI delivery history.
- [Agent workflow](agents/README.md) — multi-agent orchestration, role separation,
  task contracts, and verification evidence.

## Implementation Evidence

- `agents/evidence/` contains task, browser, accessibility, compliance, and
  follow-up verification records.
- `../src/test/` contains architecture checks that mechanically enforce key
  boundaries.
- `../e2e/` contains the Playwright user-journey and responsive browser tests.

## Workflow Infrastructure

- `WORKFLOW.md`, `patterns/`, and `templates/` are workflow support retained
  for reproducibility.
- `.agents/` and `.harness-core/` at the repository root support the
  multi-agent workflow and are not application runtime dependencies.
- Provider/model-specific runtime records are historical AI-workflow provenance;
  the final application does not depend on them.

For build, run, test, deployment, and the concise AI Collaboration Narrative,
start from the root [README](../README.md).
