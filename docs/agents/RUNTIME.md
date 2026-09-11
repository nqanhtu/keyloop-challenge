# Agent Runtime Policy

This file pins the active autonomous runtime policy. The accepted authority for the current provider/role mode is `docs/decisions/0002-deepseek-only-autonomous-runtime.md`.

## Active Mode

The workflow is **DeepSeek-only** until explicitly superseded.

All roles run as Herdr-managed Codex CLI sessions backed by:

```text
model = deepseek-flash
model_reasoning_effort = high
```

Herdr remains the only multi-agent orchestrator. Codex internal `multi_agent` must remain disabled.

## Role Runtime Policy

| Role | Model | Reasoning | Runtime sandbox | Repository behavior |
|---|---|---|---|---|
| Lead | `deepseek-flash` | `high` | `danger-full-access` | logically read-only |
| Builder | `deepseek-flash` | `high` | `danger-full-access` | bounded task-worktree writer |
| Repairer | `deepseek-flash` | `high` | `danger-full-access` | bounded repair writer |
| Reviewer | `deepseek-flash` | `high` | `danger-full-access` | read-only, fresh session |
| Tester | `deepseek-flash` | `high` | `danger-full-access` | read-only, fresh session |
| Integrator | `deepseek-flash` | `high` | `danger-full-access` | serialized coordination-branch writer |
| Workflow Scribe | `deepseek-flash` | `high` | `danger-full-access` | workflow-artifact-only writer |
| Compliance | `deepseek-flash` | `high` | `danger-full-access` | read-only, fresh session |

`danger-full-access` is required in the current macOS/Herdr environment because narrower Codex sandbox modes block Herdr's local Unix control socket. Runtime filesystem permission does not grant role permission: each session must obey the mutation boundary in the table and its Task Contract.

A session that implemented or repaired code must not review, test-approve, integrate-approve, or perform final Compliance on its own work. Start fresh sessions for independent gates.

## Launch

The local Codex configuration is expected to use the official DeepSeek Responses API provider and model catalog.

Normal launch arguments inside a Herdr-managed pane:

```text
-m deepseek-flash
-c model_reasoning_effort="high"
-s danger-full-access
-a never
--disable multi_agent
```

Do not put the DeepSeek API key in this repository, prompts, task contracts, evidence, or logs.

## Writer Boundaries

- Builder writes only implementation/tests within the current Task Contract.
- Repairer writes only the smallest repair surface authorized by findings.
- Integrator writes only reviewed integration/merge work and is serialized with Workflow Scribe on the coordination branch.
- Workflow Scribe writes only exact Lead-approved project workflow artifacts.
- Lead/Reviewer/Tester/Compliance remain repository-mutation read-only even though their runtime sandbox is broad.

No role may change System Design, accepted product semantics, Harness-managed/core files, or unrelated scope without separate authority.

## Runtime Verification

A newly started role is trusted only after its effective runtime is observable.

Verify at minimum:

- startup reports `deepseek-flash`;
- reasoning is `high`;
- the session is in the intended repository/worktree;
- Herdr IPC works when the role needs orchestration;
- writer/read-only behavior matches the assigned role.

The environment has already demonstrated:

```text
DEEPSEEK_HERDR_RUNTIME_OK
```

Provider choice does not weaken task acceptance, review, test, clean release-candidate, or final Compliance evidence requirements.
