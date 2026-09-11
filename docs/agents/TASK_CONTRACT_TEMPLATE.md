# Task Contract Template

Codex Lead compiles one bounded task contract before dispatching implementation to DeepSeek Builder.

A task contract is an execution handoff, not a replacement for the System Design. It contains only the context required for this task.

## Template

```yaml
task_id: <EPIC/STORY/TASK identifier>
title: <short behavior-oriented title>
role: deepseek-builder|deepseek-repairer|deepseek-integrator|deepseek-scribe

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

# Public/observable seams that TDD and verification are allowed to target.
# These are considered pre-agreed by Codex Lead for autonomous execution.
test_seams:
  - <HTTP/API/UI/domain boundary>

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
  - coherent commit when the role writes code or durable artifacts
  - concise evidence capsule
  - changed paths
  - validation results
  - design deviations, if any
  - unresolved risks/blockers
```

## Autonomous TDD Seam Rule

For this repository, `test_seams` in a Codex-approved Task Contract are the pre-agreed testing seams required by the installed `tdd` skill. DeepSeek Builder must not stop to ask the user to reconfirm those seams.

Escalate to Codex Lead only when the declared seam conflicts with repository authority or a materially different seam would change architecture, product semantics, or verification validity. Codex escalates to the human only when the System Design and repository authority genuinely cannot resolve that choice.

## Review Fixed Point and Spec Source

For autonomous review:

- `base_commit` is the review fixed point;
- the completed Task Contract is the work-item spec;
- its `design_refs` point to the authoritative product/architecture source;
- `docs/agents/issue-tracker.md` is an adapter for the installed review skill, not a requirement to create GitHub Issues.

A Reviewer should not ask the user for a fixed point or spec source when these fields are present.

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

DeepSeek Builder may autonomously choose local implementation details such as component decomposition, helper names, fixture organization, CSS implementation, test helper structure, and storage key naming when those choices do not alter an explicit contract.

It must escalate through Codex Lead when multiple interpretations would materially change:

- externally observable behavior;
- API semantics;
- business rules;
- ownership or module boundaries;
- implementation scope;
- required responsive/accessibility behavior.

## Workflow Scribe Contract

When Codex is running with a read-only sandbox, durable workflow state is written by a dedicated DeepSeek Workflow Scribe.

A Scribe task must contain the exact destination path and Codex-approved content or patch intent. The Scribe may write only project-owned workflow artifacts such as:

```text
docs/plans/active/implementation.md
docs/agents/tasks/**
docs/agents/evidence/**
docs/agents/learning/**
docs/agents/rules/**
```

The Scribe must not modify source implementation, System Design, the Harness-managed block, `.harness-core/`, or generic Harness-owned files unless a separate authorized task explicitly permits it.

## Evidence Capsule Template

At completion, DeepSeek Builder returns:

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
4. the final diff/commit against `base_commit`;
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
