# 0002 DeepSeek-Only Autonomous Runtime

Date: 2026-09-11

## Status

Accepted

## Context

The autonomous workflow was originally configured with OpenAI-backed Codex for read-only decision/review roles and Antigravity (AGY) for repository-writing roles.

The available OpenAI five-hour model quota and AGY usage are currently exhausted. The user has explicitly authorized handing the autonomous delivery workflow over entirely to the DeepSeek provider through Codex CLI.

The official DeepSeek Codex integration has been installed and runtime-verified in Herdr with:

```text
model: deepseek-flash
reasoning: high
DEEPSEEK_HERDR_RUNTIME_OK
```

This decision changes runtime role ownership only. It does not change the System Design, product behavior, task DAG, acceptance criteria, evidence requirements, branching protocol, or release requirements.

## Decision

Until explicitly superseded, the active autonomous runtime is DeepSeek-only.

All agent roles use fresh Herdr-managed Codex CLI sessions backed by:

```text
model = deepseek-flash
model_reasoning_effort = high
```

Role permissions remain separated:

| Role | Repository mutation |
|---|---|
| Lead | read-only |
| Builder | bounded task worktree writer |
| Repairer | bounded repair worktree writer |
| Reviewer | read-only, fresh session |
| Tester | read-only, fresh session |
| Integrator | serialized coordination-branch writer |
| Workflow Scribe | workflow-artifact-only writer |
| Compliance | read-only, fresh session |

A single session must not implement and then review or approve its own work. Independence is preserved by fresh sessions with bounded context even though the provider/model is the same.

Herdr remains the only multi-agent orchestrator. Codex internal multi-agent mode remains disabled.

## Writer Rules

DeepSeek writer roles are authorized only within their assigned role scope:

- Builder: implementation/tests explicitly allowed by the current Task Contract.
- Repairer: the smallest repair surface authorized by review/test findings.
- Integrator: reviewed integration/merge work only.
- Workflow Scribe: exact Lead-approved durable workflow state only.

Writer roles must not change System Design, accepted product semantics, Harness-managed/core files, or unrelated scope.

## Review And Release Rules

Fresh DeepSeek Reviewer and Tester sessions may satisfy the repository's independent review/test gates while this decision is active.

Fresh DeepSeek Compliance may perform the final complete System Design compliance audit and is the only role allowed to decide:

```text
RELEASE: PASS
```

No role may lower evidence requirements because the provider changed.

## Existing Task Contracts

Existing contracts created before this decision remain valid.

Role labels such as `antigravity-builder` are interpreted by capability, not provider. For active/future dispatch, Lead should prefer the new DeepSeek role labels:

```text
deepseek-builder
deepseek-repairer
deepseek-integrator
deepseek-scribe
```

Do not recreate an existing task or change its `base_commit` merely to rename its provider role.

## Consequences

Positive:

- Delivery can continue without OpenAI or AGY quota availability.
- Repository-native state and evidence remain the durable control plane.
- The existing T01-T08 decomposition and T03 contract remain usable.
- No provider switch requires re-planning completed tasks.

Tradeoffs:

- Reviewer/tester diversity is reduced because all roles use the same provider/model.
- Fresh-session independence and executable evidence therefore become more important.
- Hard problems may require more bounded retries or stronger repository-native mechanical proof rather than model escalation.

## Runtime Verification

Before trusting any newly spawned role, verify:

- exact model is `deepseek-flash`;
- reasoning effort is `high`;
- Herdr IPC is available when orchestration is required;
- writer/read-only behavior matches the assigned role;
- the session starts from the correct repository/worktree.
