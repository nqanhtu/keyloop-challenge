# Agent Workflow Map

This directory defines the project-specific operating contract for autonomous implementation.

## Authority

`docs/system-design/system-design-v1.md` is the architecture and product-design authority for this challenge unless a later committed, explicitly approved decision supersedes it.

The implementation scope is intentionally narrower than the system-design scope:

- implement the React frontend fully;
- preserve the designed REST boundary;
- simulate backend behavior through MSW and a mock repository;
- persist mocked manager actions across browser reloads;
- do **not** implement the production Fastify/Prisma/PostgreSQL backend, synchronization worker, identity provider, or production infrastructure.

Repository state and executable evidence outrank agent claims or session memory.

## Role Map

- **Herdr** — orchestration and lifecycle only: workspaces, worktrees, panes, agents, waiting, prompting, and process execution.
- **Codex Lead** — read-only architecture audit, requirement decomposition, dependency DAG, task contracts, routing, and acceptance ownership.
- **Antigravity Workflow Scribe** — writes exact Codex-approved durable workflow artifacts because Codex remains repository-mutation read-only.
- **Antigravity Builder** — implementation and repair. Builders are the normal source/test writers.
- **Codex Reviewer** — fresh read-only review against the task contract and relevant design requirements.
- **Codex Tester** — verification owner; runs or orchestrates repository test commands without repairing source code.
- **Antigravity Integrator** — integrates reviewed work and resolves implementation-level merge/integration issues.
- **Codex Compliance** — fresh final audit of the complete product against the System Design. It is the only agent role allowed to decide release PASS.

See [ORCHESTRATION.md](ORCHESTRATION.md).

## Progressive Disclosure

Agents load the smallest authoritative context needed for the current responsibility.

### Level 0 — Entry Map

Read repository agent instructions and this file to learn authority, roles, and where to look next.

### Level 1 — Task Contract

A worker receives one bounded task contract containing:

- objective;
- design requirement references;
- dependencies;
- allowed scope;
- acceptance criteria;
- pre-agreed `test_seams`;
- relevant promoted rules;
- forbidden changes;
- required evidence.

### Level 2 — Relevant Design Fragments

Read only the System Design sections named by the task contract. A Builder does not reread the entire System Design by default.

### Level 3 — Relevant Code and Tests

Inspect affected modules, their direct dependencies, existing patterns, and relevant tests. Expand outward only when evidence requires it.

### Drill-down Rule

Summaries and evidence capsules are read first. Full diffs, logs, transcripts, or broader design context are loaded only when a failure, ambiguity, or compliance question cannot be resolved from the smaller surface.

Old incidents and candidate lessons are not normal worker context.

## Durable State

Durable workflow state belongs in the repository, not in a Codex or Antigravity conversation.

Codex decides durable state but does not write it. A dedicated Antigravity Workflow Scribe persists exact Codex-approved content.

Canonical paths:

```text
docs/plans/active/implementation.md
docs/agents/tasks/<TASK-ID>.md
docs/agents/evidence/<TASK-ID>.md
docs/agents/evidence/release-compliance.md
docs/agents/learning/incidents/<INC-ID>.md
docs/agents/learning/candidates.md
docs/agents/rules/*.md
```

A fresh Codex Lead must be able to resume from committed repository state plus current Git/Herdr state without requiring a previous chat transcript.

Use a single active implementation plan for cross-session progress. Do not create parallel task databases unless an external tracker is explicitly adopted.

## Work Decomposition

Use the following conceptual hierarchy when useful:

```text
System Design
  -> Requirements
  -> Epics
  -> Stories
  -> bounded Task Contracts
```

Epics and Stories describe behavior and traceability; they are not a Scrum process. Scheduling is dependency-driven through execution waves/DAG frontiers rather than sprints, story points, or velocity.

## Project-Specific Non-Negotiables

The following System Design boundaries must remain visible when work is decomposed:

1. Frontend application data access crosses the HTTP/API abstraction.
2. MSW simulates the backend at the HTTP boundary; React feature code must not access the mock repository directly.
3. `inventoryAgeDays` and `isAging` are backend-derived semantics and must not be independently recomputed by frontend feature code.
4. Filtering, sorting, and pagination are server-side semantics, simulated by the mock backend.
5. Manager actions are immutable and append-only; the latest action is the current action.
6. Frontend behavior uses stable `ApiError.code` values rather than message parsing.
7. Filters, sort, and page are URL state; changing filters resets page to 1.
8. TanStack Query owns server state; avoid duplicating server data into independent application state.
9. Aging status must not be communicated by color alone.
10. Production backend/database/synchronization infrastructure is design-only and outside this implementation scope.

Where practical, promote these boundaries to mechanical checks or tests instead of relying only on prompts.

## Generic Skill Adapters

Project authority overrides generic skill assumptions when they conflict.

- **TDD:** Task Contract `test_seams` are the pre-agreed seams; no human reconfirmation is needed unless authority is genuinely missing.
- **Code review:** Task Contract `base_commit` is the fixed point; Task Contract + `design_refs` are the spec. See [issue-tracker.md](issue-tracker.md); GitHub Issues are optional and are not workflow state.
- **Harness learning:** project learning may evolve project-owned `docs/agents/**` rules/templates/evidence and project-native checks through an Antigravity writer. Harness core itself is not self-modified; `$improve-harness` still requires explicit user authorization.

## Entry Skill

For end-to-end autonomous implementation, Codex Lead uses the project-local `$deliver-system-design` skill in `.agents/skills/deliver-system-design/SKILL.md`.

That skill is the control loop. The generic Herdr skill only supplies Herdr mechanics.

## Supporting Documents

- [ORCHESTRATION.md](ORCHESTRATION.md) — execution lifecycle, role separation, recovery, retries, and integration.
- [TASK_CONTRACT_TEMPLATE.md](TASK_CONTRACT_TEMPLATE.md) — bounded handoff contract from Codex Lead to Antigravity.
- [QUALITY_AND_LEARNING.md](QUALITY_AND_LEARNING.md) — readiness/done gates, review/testing/compliance, incidents, and workflow learning.
- [issue-tracker.md](issue-tracker.md) — adapter for generic review skills without adding an issue-based control plane.
