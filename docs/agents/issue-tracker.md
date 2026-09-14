# Issue Tracker Adapter

This repository does not use an issue tracker as the autonomous delivery control plane.

This file exists so generic review skills can resolve the repository's actual work/spec sources without introducing a second task database.

## Canonical Work Sources

For autonomous delivery, use these sources in order:

1. `docs/system-design/system-design-v1.md` — authoritative product and architecture design.
2. `docs/plans/completed/implementation-intelligent-inventory-dashboard.md` — completed requirement registry, dependency DAG, execution state, and release record.
3. `docs/agents/tasks/<TASK-ID>.md` — bounded work-item specification produced by the Lead and persisted by the Workflow Scribe.
4. `docs/agents/evidence/<TASK-ID>.md` — builder/reviewer/test evidence and resolved findings.

GitHub Issues may be used for human collaboration if explicitly requested, but they are not required for autonomous execution and must not become a parallel source of workflow truth.

## Code Review Adapter

When the installed `code-review` skill needs an originating spec:

- use the Task Contract as the work-item spec;
- follow its `design_refs` to the relevant System Design authority;
- use Task Contract `base_commit` as the fixed review point;
- inspect `git diff <base_commit>...HEAD` or the equivalent task commit diff;
- do not ask the user for an issue or spec path when the Task Contract already supplies them.

If no Task Contract exists for a change, Codex Lead must reconstruct or create the bounded contract before formal autonomous review rather than inventing an issue-tracker record.

## No Scrum State

Do not create sprints, story points, velocity records, backlog-grooming state, or issue-tracker mirrors merely to satisfy a generic skill. Work scheduling is dependency-driven through the repository plan and Herdr execution waves.
