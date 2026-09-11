---
name: deliver-system-design
description: "Autonomously deliver this repository's approved System Design through Herdr using separated DeepSeek-backed Codex CLI roles. Lead/review/test/compliance stay read-only; Builder/Repairer/Integrator/Scribe perform scoped writes. Use when asked to implement or deliver the approved System Design end to end with minimal human intervention."
---

# Deliver System Design

Run the closed-loop delivery protocol for `docs/system-design/system-design-v1.md`.

The goal is not to make agents busy. The goal is to produce a release candidate whose MUST implementation requirements are traceable to executable or observable evidence.

## Non-Negotiable Role Boundary

The active runtime is DeepSeek-only under `docs/decisions/0002-deepseek-only-autonomous-runtime.md`.

All roles are Herdr-managed Codex CLI sessions backed by `deepseek-flash/high`, but role permissions remain separated:

- `Lead` — read-only decisions/orchestration;
- `Workflow Scribe` — exact Lead-approved workflow artifacts only;
- `Builder` — bounded implementation/tests in the assigned task worktree;
- `Repairer` — bounded fixes from findings;
- `Reviewer` — fresh read-only review session;
- `Tester` — fresh read-only verification session;
- `Integrator` — reviewed merge/integration work only;
- `Compliance` — fresh read-only final auditor.

A writer session must not review, test-approve, or perform Compliance on its own work. A Scribe records Lead decisions; it does not make them.

Runtime `danger-full-access` exists for Herdr IPC and writer execution. It does not override the role-specific mutation boundary.

## Preconditions

This skill requires Codex to be running inside Herdr.

Verify:

```bash
test "${HERDR_ENV:-}" = 1
```

If this fails, stop and tell the user to start/resume Codex inside a Herdr-managed pane. Do not control an unrelated Herdr session from outside Herdr.

Then read, in order:

1. `AGENTS.md`;
2. `docs/agents/README.md`;
3. `docs/agents/ORCHESTRATION.md`;
4. `docs/agents/BRANCHING.md`;
5. `docs/agents/QUALITY_AND_LEARNING.md`;
6. `docs/agents/TASK_CONTRACT_TEMPLATE.md`;
7. `docs/system-design/system-design-v1.md`.

Use the installed `herdr` skill for current Herdr CLI mechanics. The installed binary is authoritative for exact commands; discover with `herdr --help` and the relevant command group instead of guessing syntax.

## Phase 0 — Resume Before Bootstrap

Before creating work, determine whether a delivery run already exists.

Inspect:

```text
docs/plans/active/implementation.md
Git branch/worktree/commit state
Herdr live panes/agents
referenced task contracts/evidence
```

If an active plan exists, reconcile it with Git and Herdr before dispatching anything. A dead/missing agent does not mean its task failed or completed. Inspect commits and evidence first.

Do not duplicate an already-implemented or already-integrated task.

If no active implementation plan exists, continue to bootstrap.

## Phase 1 — Compile the Design

Read the complete System Design once as DeepSeek Lead and compile a concise delivery model.

Classify design statements into:

```text
IMPLEMENT
SIMULATE_AT_HTTP_BOUNDARY
DESIGN_ONLY
```

For this challenge, never dispatch production Fastify/Prisma/PostgreSQL/synchronization/IdP/infrastructure implementation unless the user has explicitly changed scope.

Build a requirement registry with stable IDs. Prefer behavior/contract-oriented IDs such as:

```text
ARCH-HTTP-001
ARCH-AGING-001
INV-001
ACT-001
UX-RESP-001
ERR-001
TEST-001
```

For each MUST implementation requirement capture:

```yaml
id: <REQ-ID>
design_ref: <section>
summary: <one testable statement>
risk: low|medium|high|critical
implementation_owner: <future story/task>
evidence_required: <test/check/observed behavior>
status: PLANNED
```

Do not invent business policies that the System Design intentionally leaves configurable or unspecified.

## Phase 2 — Build the Delivery DAG

Group requirements into the minimum useful capability hierarchy:

```text
System Design
  -> Requirements
  -> Epics
  -> Stories
  -> bounded Task Contracts
```

This is not Scrum. Do not create sprints, story points, velocity, standups, or backlog ceremony.

Schedule using dependency frontiers / execution waves.

A reasonable starting shape for this repository is:

```text
Wave 0: Foundation
Wave 1: Inventory vertical slice || Vehicle Action vertical slice
Wave 2: Integration/cross-feature behavior
Wave 3: Review + testing + UX/accessibility verification
Wave 4: clean release-candidate + final compliance
```

Change the graph when evidence shows different dependencies. Do not parallelize tasks with high file/seam overlap merely to increase agent count.

## Phase 3 — Persist Bootstrap State Through Workflow Scribe

DeepSeek Lead must not write the plan itself; delegate the exact content to a Workflow Scribe session.

Generate the exact initial content for:

```text
docs/plans/active/implementation.md
```

It must include at minimum:

```text
System Design authority/ref
current run status
requirement registry
epic/story map
dependency DAG / ready frontier
active/completed/blocked tasks
integration state
release-gate state
unresolved risks/decisions
```

Start or reuse one DeepSeek Workflow Scribe through Herdr and give it the exact destination and Codex-approved content. The Scribe may create needed project-owned directories/files but must not modify source implementation, System Design, or Harness core.

Verify the resulting Git diff/commit before trusting the persisted state.

## Phase 4 — Dispatch a Bounded Task

Dispatch only a READY task.

For each implementation task, follow `docs/agents/BRANCHING.md` exactly:

1. capture `B = current coordination-branch HEAD` **before** persisting the Task Contract;
2. compile the Task Contract with `base_commit: B`;
3. persist the contract through Workflow Scribe on the coordination branch;
4. create the Builder worktree/branch explicitly from `B`, not from the later Scribe commit;
5. send the Task Contract to the Builder in the Herdr context package because its branch may intentionally not contain the persisted contract file.

This keeps workflow-record commits out of the implementation diff and makes `base_commit` a truthful review fixed point.

Compile each contract using `docs/agents/TASK_CONTRACT_TEMPLATE.md`.

Every Builder contract must include:

```text
task_id
objective
base_commit
worktree/branch
design_refs
requirement IDs
applicable rules only
dependencies
allowed_scope / out_of_scope
test_seams
acceptance
required_validation
forbidden changes
output/evidence requirements
```

`test_seams` are the pre-agreed testing seams for the installed TDD skill. The Builder must not ask the user to reconfirm them.

Persist the contract through Workflow Scribe at:

```text
docs/agents/tasks/<TASK-ID>.md
```

Then create/reuse the task worktree from the recorded `base_commit` and start an DeepSeek Builder with Herdr.

The Builder receives only:

1. its Task Contract;
2. referenced System Design fragments;
3. matching promoted project rules;
4. relevant source/tests.

Do not send the entire prior role-session transcript or all historical incidents.

## Phase 5 — Builder Result and Evidence Capsule

DeepSeek Builder implements using the declared task seams and returns a concise evidence capsule.

Do not accept `done`, prose confidence, or a green-looking terminal as proof.

DeepSeek Lead checks:

```text
commit exists
diff from base_commit is within scope
required validation actually ran
capsule maps requirements to implementation
no undeclared design deviation
```

If acceptable, have Workflow Scribe persist the accepted concise capsule to:

```text
docs/agents/evidence/<TASK-ID>.md
```

Long logs remain process output unless a failure requires preserving a targeted excerpt/reference.

## Phase 6 — Fresh Codex Review

Start a fresh DeepSeek Reviewer session through Herdr.

Provide only:

```text
completed Task Contract
relevant System Design fragments
matching promoted rules
base_commit and task commit/diff
accepted Builder capsule
relevant test output
```

For the installed `code-review` skill:

- `base_commit` is the fixed point;
- Task Contract + `design_refs` are the originating spec;
- `docs/agents/issue-tracker.md` is the repository adapter;
- do not ask the human for an issue/spec when these are available.

Reviewer is read-only and returns structured findings using the template in `TASK_CONTRACT_TEMPLATE.md`.

A review failure never authorizes the Reviewer session to patch source; route the finding to a Builder/Repairer.

## Phase 7 — Testing

After review passes, use a fresh/read-only DeepSeek Tester or the Lead acting strictly as tester when a separate fresh context adds no material value.

Run/orchestrate commands in ordinary Herdr panes. Test processes may create their normal build/cache/report outputs; Reviewer/Tester/Lead sessions still do not edit source.

Verification depth follows risk in `QUALITY_AND_LEARNING.md`.

Required behavior eventually includes:

```text
typecheck/lint/build
aging boundary unit proof
RTL + MSW integration proof
optimistic success + rollback
action history/persistence
stale/error behavior
Playwright desktop/tablet/mobile
architecture compliance checks
```

Never repeatedly retry a failing test until green and call that success. Suspected flakiness enters diagnosis.

When source structure is stable enough to encode a project invariant mechanically, prefer a repository-native check/test over another textual reminder. Codex may use the `encode-invariant` guidance to design the proof, but an DeepSeek writer role performs the repository mutation.

## Phase 8 — Failure Diagnosis and Repair

Classify every failure before repair:

```text
implementation
task-contract
context
architecture
verification
orchestration
```

Route:

```text
first local implementation defect
  -> same DeepSeek Builder/Repairer when context remains trustworthy

repeated or architecture-boundary violation
  -> fresh DeepSeek Repairer

workflow/systemic failure
  -> repair current work
  -> also capture learning candidate
```

Codex provides the Repairer:

```text
original contract
specific finding/failing evidence
smallest repair scope
current commit/state
```

Codex does not provide a speculative rewrite unless required to clarify the contract.

Use bounded retries. If repeated repair cannot progress, Codex performs root-cause diagnosis and narrows the reproduction. Only a genuinely unresolved authority choice, unavailable required external dependency, or unrecoverable environment limitation becomes `BLOCKED` for the human.

## Phase 9 — Workflow Learning

For workflow-relevant failures, Codex decides whether an incident/candidate is warranted.

Persist through Workflow Scribe:

```text
docs/agents/learning/incidents/<INC-ID>.md
docs/agents/learning/candidates.md
```

Do not promote every mistake to a rule.

Promotion is justified only when the lesson directly encodes existing authority, repeats, or is independently shown to prevent recurrence.

Promoted project rules live under:

```text
docs/agents/rules/*.md
```

Prefer:

```text
mechanical check
> automated behavior test
> task-contract/template improvement
> narrow project rule
> prompt reminder
```

Project learning must never autonomously modify the Harness-managed block, `.harness-core/`, generic Harness core skills, or generic Harness workflow files. Harness-core improvement requires explicit user authorization for `$improve-harness`.

## Phase 10 — Integration

Only reviewed and sufficiently tested work may be integrated.

Use an DeepSeek Integrator for repository writes/merge conflict resolution. Scribe and Integrator writes to the coordination branch are serialized.

If a conflict is purely mechanical, Integrator resolves and reports evidence. If resolution would choose product semantics, API behavior, ownership, or architecture, stop that integration attempt and escalate to DeepSeek Lead.

After each meaningful integration, run affected validation and update the implementation plan through Workflow Scribe.

Dependent tasks must capture a new `base_commit` only after required dependencies have been integrated and verified.

## Phase 11 — Clean Release Candidate

When all required work is integrated, pin:

```text
release_candidate_commit = current coordination-branch HEAD
```

Create a fresh clean checkout/worktree at that exact commit.

Do not rely on Builder-local uncommitted files, dev servers, caches, or browser storage state.

Run the clean sequence defined in `QUALITY_AND_LEARNING.md`:

```text
install from committed lockfile
environment validation
typecheck/lint/build
unit
integration
E2E desktop/tablet/mobile
architecture checks
```

A required flaky/unreliable proof blocks release until resolved or explicitly re-authorized by the user.

Do not advance `release_candidate_commit` after clean verification without rerunning the affected release gates.

## Phase 12 — Final DeepSeek Compliance

Start a fresh DeepSeek Compliance session pinned to `release_candidate_commit`.

It reads:

```text
complete System Design
release_candidate_commit repository state
single active implementation plan
requirement registry
relevant evidence files
clean RC test results
```

For every MUST implementation requirement, produce:

```text
PASS
FAIL
UNVERIFIED
NOT_APPLICABLE
```

Every PASS must cite executable/observable evidence.

`FAIL` or `UNVERIFIED` prevents release.

Only DeepSeek Compliance may decide:

```text
RELEASE: PASS
```

If compliance fails, route findings back through the bounded DeepSeek repair loop, integrate the repair, pin a new release candidate, and rerun affected gates plus final compliance.

If compliance passes, keep the audited candidate SHA immutable as the product release identity.

Then have Workflow Scribe perform only the post-pass record writes:

```text
docs/agents/evidence/release-compliance.md
move docs/plans/active/implementation.md -> docs/plans/completed/<implementation-plan-name>.md
```

Those writes create a later `workflow_record_commit`. They do **not** replace the audited `release_candidate_commit`.

After the Scribe commit, Codex performs one final read-only provenance check:

```text
git diff --name-only <release_candidate_commit>..<workflow_record_commit>
```

The post-pass diff must be limited to the authorized compliance evidence and plan archival paths above. Any source, test, package, lockfile, System Design, Harness-core, or unrelated change invalidates the record step and requires investigation; do not silently transfer RELEASE PASS to a modified product state.

## Completion Report

Return to the user only after release PASS plus the post-pass provenance check, or after a genuine BLOCKED condition.

For PASS, report concisely:

```text
release_candidate_commit (the audited product)
workflow_record_commit (post-pass records only)
implemented capability summary
quality gates executed
System Design compliance result
remaining explicit risks, if any
```

Do not dump agent transcripts.

For BLOCKED, report only the blocker, evidence, attempts already made, and the smallest human decision/input required.

## Core Rule

Never advance workflow state because an agent says it is done.

Advance only when repository state plus executable or observable evidence supports the transition.
