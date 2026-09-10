# Task Contract Template

Codex Lead compiles one bounded task contract before dispatching implementation to Antigravity.

A task contract is an execution handoff, not a replacement for the System Design. It contains only the context required for this task.

## Template

```yaml
task_id: <EPIC/STORY/TASK identifier>
title: <short behavior-oriented title>
role: antigravity-builder

objective: >
  <one concrete outcome observable from the product or repository>

base_commit: <sha>
worktree: <assigned worktree/branch>

# Trace back to architecture/product authority.
design_refs:
  - docs/system-design/system-design-v1.md#<section>

requirements:
  - <REQ-ID or concise requirement>

# Load only these project rules because they apply to this work.
rules_to_load:
  - <path#section>

# Work that must already exist before this task is READY.
dependencies:
  - <task/commit/interface>

# Expected source/test surface. Expansion is not implicit authorization.
allowed_scope:
  - <path or module>

# Explicitly excluded adjacent concerns.
out_of_scope:
  - <concern/path>

acceptance:
  - <observable/testable criterion>
  - <observable/testable criterion>

required_validation:
  - <targeted command or behavior>

forbidden:
  - change System Design or product semantics
  - relax architecture invariants
  - silently expand scope

output:
  - coherent commit
  - concise evidence capsule
  - changed paths
  - validation results
  - design deviations, if any
  - unresolved risks/blockers
```

## Project-Specific Contract Rules

For this challenge, Codex Lead must preserve the distinction between three design categories.

### IMPLEMENT

Examples:

- responsive React inventory dashboard;
- URL-backed filters/sort/page;
- vehicle detail;
- current manager action and action history;
- optimistic action creation and rollback;
- loading/empty/error/stale states;
- accessibility behavior;
- browser-reload persistence for mocked actions.

### SIMULATE AT HTTP BOUNDARY

Examples:

- REST endpoints;
- server-side filtering/sorting/pagination;
- backend-derived aging semantics;
- summary/filter-option/status endpoints;
- action eligibility/validation and stable error codes;
- action append-only persistence/history;
- freshness metadata.

These behaviors belong behind MSW/API boundaries rather than directly inside React feature code.

### DESIGN ONLY

Do not dispatch implementation tasks for:

- production Fastify backend;
- Prisma/PostgreSQL persistence;
- production synchronization worker;
- production identity provider integration;
- production observability infrastructure;
- distributed cache or microservices.

They remain architectural design material unless the user explicitly changes implementation scope.

## Reversible Implementation Decisions

Antigravity may autonomously choose local implementation details such as component decomposition, helper names, fixture organization, CSS implementation, test helper structure, and storage key naming when those choices do not alter an explicit contract.

It must escalate through Codex Lead when multiple interpretations would materially change:

- externally observable behavior;
- API semantics;
- business rules;
- ownership or module boundaries;
- implementation scope;
- required responsive/accessibility behavior.

## Evidence Capsule Template

At completion, Antigravity returns:

```yaml
task: <TASK-ID>
status: complete|blocked
base_commit: <sha>
commit: <sha-or-none>

requirements:
  <REQ-ID>: implemented|blocked

changed:
  - <path>

validation:
  typecheck: PASS|FAIL|NOT_RUN
  unit: PASS|FAIL|NOT_RUN
  integration: PASS|FAIL|NOT_RUN
  e2e: PASS|FAIL|NOT_RUN

scope_expansion: []
design_deviations: []
risks: []
blockers: []
```

Do not paste long logs into this capsule. Preserve full logs as normal tool/process output and reference them only when investigation needs them.

## Reviewer Input Package

A fresh Codex Reviewer should normally receive only:

1. this completed task contract;
2. the referenced System Design fragments;
3. applicable promoted rules;
4. the final diff/commit;
5. the Builder evidence capsule and relevant test output.

Builder reasoning/history is not review input by default.

## Structured Review Finding

Reviewer failures use a machine-routable format:

```yaml
finding_id: FIND-001
severity: critical|high|medium|low
category: implementation|scope|architecture|verification|accessibility
requirement: <REQ-ID/design reference>
observation: <specific repository/behavior fact>
evidence: <path:test:command:behavior>
expected: <required behavior>
repair_scope: <smallest likely repair surface>
```

A finding is evidence for repair; it does not authorize Codex to repair source code.
