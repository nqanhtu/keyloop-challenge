# Autonomous Orchestration Contract

This document defines how Herdr, Codex, and Antigravity collaborate on this repository.

## Core Separation of Duties

### Herdr

Herdr is the runtime/orchestration layer. It may:

- create or resume workspaces and worktrees;
- start Codex or Antigravity agents;
- send bounded prompts;
- wait for agent state changes;
- collect concise results;
- run ordinary test/build processes in dedicated panes.

Herdr is not the source of product truth, architecture truth, task truth, or release truth.

### Codex Lead

Codex Lead is read-only with respect to source implementation. It owns:

- reading the complete System Design initially;
- classifying IMPLEMENT / SIMULATE / DESIGN-ONLY scope;
- extracting requirements and invariants;
- grouping behavior into epics/stories when useful;
- building the dependency DAG and execution waves;
- compiling bounded task contracts;
- routing applicable rules through progressive disclosure;
- collecting evidence capsules;
- deciding whether work advances, repairs, or blocks;
- initiating fresh review/test/compliance sessions.

Codex Lead must not silently change architecture or product semantics.

### Antigravity Builder

Antigravity is the normal implementation writer. A Builder may:

- modify source and tests within the assigned scope;
- make reversible implementation choices that do not change externally observable product semantics or System Design boundaries;
- commit a coherent implementation;
- repair findings assigned by Codex.

A Builder must not:

- change the System Design;
- relax an invariant;
- implement design-only production backend/infrastructure;
- expand scope silently;
- declare release completion.

### Codex Reviewer

Reviewer is a fresh, read-only session. It receives only:

- task contract;
- relevant System Design fragments;
- relevant promoted rules;
- final diff/commit;
- test evidence needed for the review.

It does not receive Builder reasoning unless required to investigate a specific failure.

### Codex Tester

Tester validates observable behavior. It does not repair source. It may orchestrate test/build commands through ordinary Herdr panes so generated artifacts such as build outputs, Playwright reports, and caches do not require giving a review agent source-write responsibility.

### Antigravity Integrator

Integrator is the implementation-side owner of merging reviewed work into the integration branch and resolving implementation-level merge conflicts. A merge conflict that implies an architectural or product choice is escalated to Codex Lead instead of guessed.

### Codex Compliance

Compliance is a fresh read-only final auditor. It compares the complete release candidate against the complete System Design and evidence registry.

Only this role may declare `RELEASE: PASS`.

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

No agent may skip directly from implementation to DONE.

## Definition of Ready for Dispatch

Codex Lead dispatches a task only when:

- required design authority is identified;
- dependencies are complete or explicitly available;
- acceptance criteria are observable/testable;
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

- Each actively implemented branch/worktree has one Antigravity writer owner at a time.
- Record the task ID and base commit in the task contract/evidence capsule.
- Codex roles remain read-only for source implementation.
- Two Builders must not modify the same architectural seam concurrently without an explicit integration plan.
- Before retrying after a crash, inspect Git state and task evidence to avoid duplicate implementation.

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

Codex drills into full logs/diffs/transcripts only when the capsule or verification reveals a reason.

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
  -> fresh Antigravity repair session

workflow/systemic defect
  -> repair product if needed
  -> also enter Workflow Learning Loop
```

## Bounded Repair Policy

Autonomy must not become an infinite repair loop.

Recommended escalation:

1. first local failure -> same Builder repairs;
2. repeated or architectural failure -> fresh Antigravity repair agent with original contract + finding + current state;
3. repeated failure after fresh repair -> Codex root-cause diagnosis and narrowed task/reproduction;
4. if the remaining blocker requires an unavailable external dependency, missing environment capability, or a genuinely unresolved externally observable design choice -> `BLOCKED` with concise evidence.

The exact attempt count may be tuned, but silent unlimited retries are forbidden.

## Resume and Recovery

The workflow must survive terminating Codex, Antigravity, or Herdr sessions.

Durable state is derived from:

- committed System Design and agent workflow documents;
- active implementation plan/task contracts;
- Git branches/worktrees/commits;
- review/test evidence;
- unresolved findings/incidents.

A fresh Codex Lead must inspect those sources before starting or repeating work.

## Cleanup

After integration/release or explicit abandonment:

- stop only processes owned by the workflow run;
- remove disposable worktrees only after their commits are integrated or intentionally abandoned;
- preserve evidence required for audit/recovery;
- do not delete branches, artifacts, or state whose ownership is uncertain.
