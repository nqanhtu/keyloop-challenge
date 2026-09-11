# Agent Instructions

<!-- HARNESS:BEGIN -->
## Harness

Start with the requested outcome and use the repository as the system of record.
Read `docs/WORKFLOW.md` and only relevant product, design, plan, code, and
validation material.

- Answers, explanations, reviews, diagnoses, plans, and status reports are
  read-only. Inspect only what is needed; change nothing.
- For a bounded change, inspect affected behavior and proof, implement, and
  validate. No control-plane operation is required.
- Use one `docs/plans/active/` file when work spans sessions, coordinates
  contributors, has dependencies, or needs recovery. Move it to
  `docs/plans/completed/` only after validation.
- Before editing, identify repository authority for each new externally
  observable policy. If materially different choices remain open, stop before
  edits; configurable defaults are not authority.
- For architecture, reliability, security, or quality invariant work, read
  `docs/patterns/encoding-invariants.md` and enforce only accepted rules.
- Report reusable agent friction. Change guidance, tools, runbooks, or validation
  for that purpose only when explicitly asked to use `$improve-harness`.
- Also pause when product intent remains ambiguous, recovery is difficult,
  validation is weakened, or authority is insufficient.
- Claim completion only with executable or observable evidence. Report outcome,
  changes, validation, and unresolved risks.

Harness has no task database or orchestration lifecycle. Use repository plans
and behavior-level proof; do not create parallel control-plane state.
<!-- HARNESS:END -->

## Keyloop Challenge Autonomous Workflow

For this repository, `docs/system-design/system-design-v1.md` is the authoritative
system and product design for the challenge unless explicitly superseded by an
accepted decision in `docs/decisions/`.

Before orchestrating implementation, read `docs/agents/README.md` and `docs/agents/RUNTIME.md`.
Before creating or reviewing task worktrees, also read `docs/agents/BRANCHING.md`.

Execution responsibilities:
- Herdr is orchestration/lifecycle only.
- The active runtime is DeepSeek-only under `docs/decisions/0002-deepseek-only-autonomous-runtime.md`.
- All roles run as fresh or role-appropriate Codex CLI sessions backed by `deepseek-flash`; provider identity does not collapse role boundaries.
- Lead/Auditor/Reviewer/Tester/Compliance are repository-mutation read-only.
- Builder/Repairer/Integrator are bounded implementation writers; Workflow Scribe is a workflow-artifact-only writer.
- A session that wrote implementation must not review, test-approve, or perform Compliance on its own work.
- Writer roles must not change System Design or silently expand implementation scope.
- Workflow Scribe writes only the exact Lead-approved workflow artifact content and paths; it does not invent product or architecture decisions.

Use progressive disclosure:
- Codex Lead reads the complete System Design and accepted decisions initially.
- Builders receive bounded task contracts and only relevant design/decision/rule/code context.
- Reviewers receive task contract + relevant authority + diff + evidence.
- Historical incidents and transcripts are loaded only when diagnosis requires them.

Project overrides for installed generic skills:
- A Task Contract `test_seams` section is the pre-agreed seam authority for autonomous TDD. Do not ask the human to reconfirm those seams unless repository authority genuinely lacks the necessary decision.
- For code review, `base_commit` is the fixed point and the Task Contract + referenced System Design/Decision sections are the originating spec. `docs/agents/issue-tracker.md` defines the local adapter; GitHub Issues are not the delivery control plane.
- Project workflow learning may update only project-owned workflow artifacts under `docs/agents/` and repository-native project tests/checks through an authorized DeepSeek writer role. Do not modify the Harness-managed block, `.harness-core/`, Harness-owned core skills, or generic Harness workflow files unless the user explicitly authorizes `$improve-harness`.

Task/release provenance rules:
- Capture a task `base_commit` before persisting its Task Contract, then create the Builder worktree from that captured commit so workflow-record commits do not pollute the implementation diff. Follow `docs/agents/BRANCHING.md`.
- Final Compliance audits a pinned `release_candidate_commit`. Any later Scribe commit that records compliance or archives the plan is a workflow-record commit, not the audited candidate. Codex must verify that the post-pass diff changes only authorized workflow-record paths and report the candidate and record commit separately.

Release completion requires executable/observable evidence and final Codex
System Design compliance PASS. Agent claims alone are not evidence.

See:
- `docs/agents/ORCHESTRATION.md`
- `docs/agents/RUNTIME.md`
- `docs/agents/BRANCHING.md`
- `docs/agents/TASK_CONTRACT_TEMPLATE.md`
- `docs/agents/QUALITY_AND_LEARNING.md`
- `docs/decisions/README.md`
- `.agents/skills/deliver-system-design/SKILL.md`
