# Autonomous Orchestration Contract

> Delivery runtime note: `docs/decisions/0002-deepseek-only-autonomous-runtime.md` records the provider configuration used during autonomous delivery. Lead/Reviewer/Tester/Compliance remain read-only roles; Builder/Repairer/Integrator/Scribe are distinct scoped writer roles. Fresh sessions preserve gate independence.

This document defines how Herdr and role-separated DeepSeek-backed Codex CLI sessions collaborate on this repository.

## Core Separation of Duties

### Herdr

Herdr is the runtime/orchestration layer. It may:

- create or resume workspaces and worktrees;
- start role-specific DeepSeek-backed Codex CLI agents;
- send bounded prompts;
- wait for agent state changes;
- collect concise results;
- run ordinary test/build processes in dedicated panes.

Herdr is not the source of product truth, architecture truth, task truth, or release truth.

### Codex Lead

Codex Lead is repository-mutation read-only. It owns decisions and orchestration, not file writes. It owns:

- reading the complete System Design initially;
- classifying IMPLEMENT / SIMULATE / DESIGN-ONLY scope;
- extracting requirements and invariants;
- grouping behavior into epics/stories when useful;
- building the dependency DAG and execution waves;
- compiling bounded task contracts;
- routing applicable rules through progressive disclosure;
- collecting and judging evidence capsules;
- deciding whether work advances, repairs, or blocks;
- initiating fresh review/test/compliance sessions;
- generating exact durable workflow content for an DeepSeek Workflow Scribe to write.

Codex Lead must not silently change architecture or product semantics and must not repair source implementation.

### DeepSeek Workflow Scribe

Workflow Scribe is the controlled writer for durable orchestration state when Codex runs read-only.

It may write only Codex-approved content to project-owned workflow paths:

```text
docs/plans/active/<current-plan>.md
docs/agents/tasks/**
docs/agents/evidence/**
docs/agents/learning/**
docs/agents/rules/**
```

It must not invent requirements, architecture decisions, review verdicts, or release status. It writes exactly the state/patch intent supplied by Codex and returns the resulting commit/path evidence.

Scribe and Integrator operations that target the coordination branch are serialized; there is never more than one coordination-branch writer at a time.

### DeepSeek Builder

DeepSeek is the normal implementation writer. A Builder may:

- modify source and tests within the assigned scope;
- make reversible implementation choices that do not change externally observable product semantics or System Design boundaries;
- commit a coherent implementation;
- repair findings assigned by Codex.

A Builder must not:

- change the System Design;
- relax an invariant;
- implement design-only production backend/infrastructure;
- expand scope silently;
- declare release completion;
- rewrite workflow state outside an explicit Scribe assignment.

### Codex Reviewer

Reviewer is a fresh, read-only session. It receives only:

- task contract;
- relevant System Design fragments;
- relevant promoted rules;
- final diff/commit;
- test evidence needed for the review.

It does not receive Builder reasoning unless required to investigate a specific failure. The Task Contract `base_commit` is the fixed point; the Task Contract plus `design_refs` is the originating spec. See `docs/agents/issue-tracker.md`.

### Codex Tester

Tester validates observable behavior. It does not repair source. It may orchestrate test/build commands through ordinary Herdr panes so generated artifacts such as build outputs, Playwright reports, and caches do not require giving a review agent repository-write responsibility.

### DeepSeek Integrator

Integrator is the implementation-side owner of merging reviewed work into the coordination/integration branch and resolving implementation-level merge conflicts. A merge conflict that implies an architectural or product choice is escalated to Codex Lead instead of guessed.

### Codex Compliance

Compliance is a fresh read-only final auditor. It compares the complete release candidate against the complete System Design and evidence registry.

Only this role may decide `RELEASE: PASS`. If that verdict must be persisted, Workflow Scribe records the exact Codex verdict and evidence; Scribe does not originate it.

## Canonical Durable Artifact Paths

A fresh Codex Lead must not search the repository heuristically for workflow state. Use the current active plan named by repository authority rather than assuming a fixed filename.

The completed UI redesign record is:

```text
docs/plans/completed/ui-redesign.md
```

Use these durable paths:

```text
docs/system-design/system-design-v1.md
  authoritative product/architecture design

docs/ui-system-design/ui-system-design-v1.md
  authoritative UI presentation/interaction/accessibility design

docs/plans/active/<current-plan>.md
  single active plan for the current cross-session workflow
  requirement registry + DAG + execution state + release status

docs/agents/tasks/<TASK-ID>.md
  bounded task contracts

docs/agents/evidence/<TASK-ID>.md
  builder capsule + review findings + targeted test evidence + integration result

docs/agents/evidence/release-compliance.md
  final requirement-to-evidence compliance matrix

docs/agents/learning/incidents/<INC-ID>.md
  workflow-relevant incident records

docs/agents/learning/candidates.md
  unpromoted reusable lessons

docs/agents/rules/*.md
  promoted project-specific rules with narrow applies_when triggers
```

These paths are durable state, not default context. Progressive disclosure still applies: only read the artifact needed for the current decision.

## Work State Machine

Every bounded work item follows explicit state transitions:

```text
PLANNED
  -> READY
  -> IMPLEMENTING
  -> REVIEW
  -> TEST
  -> INTEGRATION
  -> VERIFIED
  -> DONE
```

Failures transition to `REPAIR`; unresolved material authority/environment/external-dependency failures transition to `BLOCKED`.

```text
REVIEW/TEST/INTEGRATION failure
  -> REPAIR
  -> REVIEW
  -> affected verification gates
```

No agent may skip directly from implementation to DONE. State transitions are persisted by Workflow Scribe only after Codex has evidence for the transition.

## Definition of Ready for Dispatch

Codex Lead dispatches a task only when:

- required design authority is identified;
- dependencies are complete or explicitly available;
- acceptance criteria are observable/testable;
- `test_seams` are explicitly declared;
- the task is small enough for one coherent Builder context;
- affected boundaries are known;
- applicable rules can be selected;
- no unresolved material architectural/product decision remains.

If these conditions are not met, do not spawn a Builder just to explore blindly.

## Dependency-Driven Execution

Do not schedule work by Scrum sprint. Compute the ready frontier from the dependency DAG.

Typical shape for this challenge:

```text
Wave 0: Foundation
  -> shared types/contracts, router/query/API/MSW/test foundation

Wave 1: Parallel vertical slices
  -> Inventory discovery/dashboard
  -> Vehicle action/detail/history

Wave 2: Integration
  -> integrate slices and cross-feature behavior

Wave 3: Verification
  -> fresh Codex review
  -> Codex tester
  -> UX/accessibility verification

Wave 4: Release compliance
  -> clean release-candidate verification
  -> full System Design compliance audit
```

Parallelize only when tasks have meaningful independence and low file/seam overlap. Do not create an agent merely because a task can be named.

## Worktree and Single-Writer Rules

- Each actively implemented branch/worktree has one DeepSeek writer owner at a time.
- Record the task ID and base commit in the task contract/evidence capsule.
- Codex roles remain read-only for all repository mutations.
- Two Builders must not modify the same architectural seam concurrently without an explicit integration plan.
- Before retrying after a crash, inspect Git state and task evidence to avoid duplicate implementation.
- Workflow Scribe and Integrator writes to the coordination branch are serialized.

## Change Budget

A task contract must define expected scope. Changes outside it are treated as `SCOPE_EXPANSION` and require Codex Lead evaluation.

Small local refactors are allowed only when necessary for the assigned behavior and when they preserve contracts. Broad cleanup, architecture replacement, unrelated dependency changes, and opportunistic rewrites are not part of a task by default.

## Builder Completion Capsule

Builders return a concise evidence capsule rather than a long transcript:

```yaml
task: TASK-ID
status: complete
base_commit: <sha>
commit: <sha>
requirements:
  REQ-X: implemented
changed:
  - path/to/file
validation:
  typecheck: PASS|FAIL|NOT_RUN
  unit: PASS|FAIL|NOT_RUN
  integration: PASS|FAIL|NOT_RUN
design_deviations: []
risks: []
```

Codex drills into full logs/diffs/transcripts only when the capsule or verification reveals a reason. If the capsule is accepted, Workflow Scribe persists the concise evidence under `docs/agents/evidence/`.

## Failure Routing

Classify before repairing:

- **implementation** — local code/test defect;
- **task-contract** — required behavior was not handed to the Builder;
- **context** — required authority/context was omitted by progressive disclosure;
- **architecture** — implementation conflicts with design or design authority is ambiguous;
- **verification** — existing proof failed to detect or express required behavior;
- **orchestration** — dependency, worktree, lifecycle, integration, or resume failure.

Routing:

```text
local implementation defect
  -> same Builder when context is still trustworthy

architecture/boundary violation
  -> fresh DeepSeek repair session

workflow/systemic defect
  -> repair product if needed
  -> also enter Workflow Learning Loop
```

## Bounded Repair Policy

Autonomy must not become an infinite repair loop.

Recommended escalation:

1. first local failure -> same Builder repairs;
2. repeated or architectural failure -> fresh DeepSeek Repairer with original contract + finding + current state;
3. repeated failure after fresh repair -> Codex root-cause diagnosis and narrowed task/reproduction;
4. if the remaining blocker requires an unavailable external dependency, missing environment capability, or a genuinely unresolved externally observable design choice -> `BLOCKED` with concise evidence.

The exact attempt count may be tuned, but silent unlimited retries are forbidden.

## Resume and Recovery

The workflow must survive terminating Codex, DeepSeek, or Herdr sessions.

A fresh Codex Lead resumes in this order:

1. read `AGENTS.md` and `docs/agents/README.md`;
2. inspect `docs/plans/active/` and read the single current plan if present;
3. inspect Git branch/worktree/commit state and Herdr live-agent state;
4. read only evidence/task files referenced by the current plan state;
5. reconcile discrepancies before dispatching new work.

Do not infer completion from a dead session, stale pane, or missing agent. Repository/Git/evidence state decides what can be resumed or retried.

## Child Pane Lifecycle

Completed autonomous roles must not leave idle/dead child panes behind.

Follow `docs/agents/PANE_LIFECYCLE.md` for the full safety contract.

At minimum, after every Lead-created child role:

1. capture its complete result/evidence;
2. reconcile repository state;
3. ensure it is not blocked and has no unresolved writer state;
4. gracefully exit/release the agent using the installed Herdr CLI;
5. close the child pane;
6. verify the pane disappeared from workspace inventory.

Never auto-close the user pane, Lead pane, blocked agent, unresolved writer, or a persistent server/browser pane still required by active work.

At every dependency-wave boundary, reconcile live panes before spawning new ones.

An orphan writer/process that may continue mutating repository state is a workflow-integrity blocker until reconciled.

## Cleanup

After integration/release or explicit abandonment:

- apply the child-pane lifecycle above;
- stop only processes owned by the workflow run;
- close auxiliary dev-server/test/browser panes created solely for the workflow when no longer needed;
- remove disposable worktrees only after their commits are integrated or intentionally abandoned;
- preserve evidence required for audit/recovery;
- do not delete branches, artifacts, or state whose ownership is uncertain;
- after release PASS, have Workflow Scribe move the single active plan from `docs/plans/active/` to `docs/plans/completed/` with the final release evidence reference.
