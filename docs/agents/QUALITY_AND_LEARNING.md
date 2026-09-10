# Quality Gates and Workflow Learning

This document defines how work becomes trustworthy and how workflow failures improve future tasks without inflating prompts or rules.

## Quality Principle

Nothing advances because an agent says it succeeded.

Only repository state plus executable or observable evidence can advance the workflow.

## Definition of Done — Task

A task is DONE only when:

- implementation is committed;
- required targeted validation passes;
- fresh Codex review passes;
- required tests pass;
- architecture/scope findings are resolved;
- evidence capsule is complete;
- no unresolved critical/high finding remains for the task.

## Definition of Done — Epic

An epic is DONE only when:

- all required stories/tasks are DONE;
- the capability works end to end at the epic boundary;
- integration evidence covers cross-story behavior;
- no unresolved requirement in the epic remains `UNVERIFIED`.

## Release Gates

The final release candidate must pass all applicable gates.

### Gate A — Static Repository Proof

Run the repository-owned equivalents of:

```text
typecheck
lint
build
```

### Gate B — Business-Rule Unit Proof

At minimum, aging behavior covers:

```text
89 days -> not aging
90 days -> not aging
91 days -> aging
```

Also cover dealership-local timezone/calendar-day boundaries and inactive action-status rejection when those implementations exist in the mock backend.

### Gate C — Frontend Integration Proof

React Testing Library + MSW should verify the System Design behaviors including:

- filter state generates the correct HTTP query;
- filtering/sorting/pagination semantics live behind the HTTP boundary;
- aging vehicles are visibly identified;
- vehicle detail opens and renders current action/history;
- dynamic statuses load;
- optimistic action mutation reconciles on success;
- failed mutation rolls back;
- action history appends newest-first;
- stale sync warning appears while previous inventory remains usable;
- stable `ApiError.code` drives business-error behavior.

### Gate D — Browser E2E Proof

Validate the primary flow:

```text
open dashboard
-> filter inventory
-> select aging vehicle
-> open detail
-> create action
-> verify current action
-> verify history
-> reload
-> verify persistence
```

Run representative desktop, tablet, and mobile viewports.

### Gate E — Architecture Compliance Proof

Where practical, use mechanical checks/tests to prove boundaries such as:

- frontend features do not import/read the mock repository directly;
- browser storage is owned by the mock persistence layer, not arbitrary feature components;
- frontend feature code does not independently recompute `inventoryAgeDays` / `isAging`;
- filtering, sorting, and pagination are not applied only to an already-returned page in React;
- no action update/delete behavior is introduced;
- no production Fastify/Prisma/PostgreSQL/sync-worker implementation is introduced for this challenge;
- URL state owns filters/sort/page;
- changing filters resets page to 1;
- aging communication is not color-only.

Prefer a deterministic architecture check or automated test over a textual reminder when the rule is mechanically enforceable.

## Clean Release-Candidate Verification

After all reviewed work is integrated, verify from a fresh clean checkout/worktree at the release-candidate commit.

The clean verification must not depend on a Builder's running dev server, uncommitted files, or local transient state.

Sequence:

```text
fresh checkout/worktree
-> install from committed lockfile
-> required environment validation
-> typecheck/lint/build
-> unit tests
-> integration tests
-> E2E desktop/tablet/mobile
-> architecture checks
-> final Codex compliance audit
```

## Final Compliance Matrix

Codex Compliance reads the complete System Design and final repository, then records every MUST implementation requirement as:

```text
PASS
FAIL
UNVERIFIED
NOT_APPLICABLE
```

`FAIL` and `UNVERIFIED` prevent release PASS.

Each PASS should reference evidence such as code paths, tests, commands, or observed browser behavior.

Only Codex Compliance may issue:

```text
RELEASE: PASS
```

## Risk-Based Verification

Verification depth should match change risk.

- **Low:** copy/layout/local styling with no contract change -> targeted review/check.
- **Medium:** URL/query/state behavior -> review + targeted integration proof.
- **High:** HTTP boundary, persistence, optimistic mutation, business errors -> fresh review + integration/E2E proof.
- **Critical:** architecture/data ownership/business invariant -> independent review + mechanical proof where possible + final compliance coverage.

Do not apply expensive full-release ceremony to every trivial edit; do not weaken proof for high-risk behavior.

## Flaky-Test Policy

A failing test must not be retried repeatedly until green and then silently accepted.

When retry behavior suggests nondeterminism:

1. record the original failure;
2. classify it as deterministic or suspected flaky;
3. investigate the source of nondeterminism;
4. repair or quarantine only with explicit evidence and rationale;
5. keep release blocked when a required proof is unreliable.

## Environment and Permission Boundaries

The repository should eventually pin or document the runtime/package-manager/lockfile/test-command contract once application scaffolding exists.

Agent permissions follow least privilege:

- Codex Lead/Reviewer/Compliance: source read-only;
- Antigravity Builder/Integrator: write only as required by assigned repository work;
- no role changes production infrastructure, external secrets, branch protection, or unrelated external systems unless separately authorized.

## Workflow Learning Loop

Product defects and workflow defects are different.

```text
failure
-> capture incident
-> classify root cause
-> repair current work
-> decide whether lesson is reusable
-> candidate improvement
-> validate
-> promote to narrow rule/test/check/template when justified
```

### Failure Taxonomy

Use one primary workflow category:

- `implementation` — Builder made a local implementation mistake;
- `task-contract` — Codex handoff omitted required behavior/scope/proof;
- `context` — progressive disclosure omitted needed authority/context;
- `architecture` — design violation or unresolved architecture authority;
- `verification` — tests/gates failed to cover a required behavior;
- `orchestration` — DAG/worktree/lifecycle/integration/resume problem.

### Incident Record

Capture workflow-relevant failures concisely:

```yaml
incident_id: INC-001
task: <TASK-ID>
symptom: <observable failure>
root_cause: <why it occurred>
classification: <taxonomy value>
repair: <what fixed current work>
candidate_learning: <reusable lesson or none>
evidence: <finding/test/path>
```

Old incidents are audit material, not default context for future Builders.

### Candidate vs Promoted Rule

Do not immediately put every incident into global instructions.

A non-authoritative one-off mistake normally remains an incident/candidate first.

A candidate may be promoted when one or more of the following is true:

- it directly encodes an existing System Design invariant;
- the same workflow root cause repeats;
- a fresh rerun demonstrates that the proposed intervention prevents the failure;
- the rule is narrow, testable, and cheaper than repeated rediscovery.

Every promoted rule should define:

```yaml
id: RULE-...
applies_when: <narrow trigger>
rule: <specific behavior>
source: <design/incident evidence>
verification: <mechanical check/test/review method>
removal_condition: <when rule is obsolete>
```

Codex Lead loads only promoted rules whose `applies_when` matches the current task.

### Preferred Improvement Order

When learning from a reusable failure, prefer the strongest repository-owned intervention available:

```text
1. mechanical architecture/invariant check
2. automated behavior test
3. task-contract/template improvement
4. concise scoped documentation rule
5. prompt reminder
```

The goal is for experience to produce stronger automation and **less** repeated prompt context, not an ever-growing `AGENTS.md`.

## Periodic Consolidation

After a meaningful batch of work, Codex may audit workflow-learning records to:

- deduplicate candidate lessons;
- detect repeated root causes;
- promote proven improvements;
- remove obsolete candidates/rules;
- replace textual rules with mechanical enforcement where possible.

Useful metrics include first-pass success rate, repair count, repeated failure classes, flaky-test incidents, and rules/checks that prevented recurrence. Metrics are diagnostic; they are not Scrum velocity or performance targets.
