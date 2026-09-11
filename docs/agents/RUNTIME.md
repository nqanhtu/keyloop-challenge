# Agent Runtime Policy

This file pins the normal runtime model/effort policy for autonomous delivery. Repository workflow/evidence provides most of the reliability; stronger models are escalation tools rather than the default for every step.

## Herdr

Herdr is the only multi-agent orchestrator for this repository.

Codex internal `multi_agent` must remain disabled for Lead/Reviewer/Tester/Compliance sessions so agent lifecycle stays visible in Herdr.

## Codex

Normal policy:

| Role | Model | Reasoning effort | Runtime sandbox | Repository behavior |
|---|---|---|---|---|
| Lead | `gpt-5.6-sol` | `medium` | `danger-full-access` | logically read-only |
| Reviewer | `gpt-5.6-sol` | `medium` | `danger-full-access` | read-only |
| Tester | `gpt-5.6-terra` | `medium` | `danger-full-access` | read-only |
| Root-cause escalation | `gpt-5.6-sol` | `high` | `danger-full-access` | read-only |
| Final Compliance | `gpt-5.6-sol` | `high` | `danger-full-access` | read-only |

`danger-full-access` is required in the current macOS/Herdr environment because Codex sandbox modes block access to Herdr's local Unix control socket. This is runtime permission only; it does not change the repository role contract. Codex must not create, edit, delete, stage, commit, or otherwise mutate repository files during this workflow.

Always launch Codex with explicit model and effort. Do not inherit global defaults.

Example Lead native arguments:

```text
-m gpt-5.6-sol
-c model_reasoning_effort="medium"
-s danger-full-access
-a never
--disable multi_agent
```

Escalation policy:

```text
normal reasoning -> Sol / medium
material review or diagnosis difficulty -> Sol / high
still unresolved -> explicitly choose a stronger model only for that bounded problem
```

Do not run a stronger/maximum-effort model continuously merely as a precaution.


## Temporary DeepSeek Fallback

When the normal OpenAI Codex model quota is unavailable, Codex CLI may temporarily use the officially supported DeepSeek provider with **only** `deepseek-v4-flash`.

Fallback policy:

| Role | Model | Reasoning effort | Runtime sandbox | Repository behavior |
|---|---|---|---|---|
| Lead | `deepseek-v4-flash` | `high` | `danger-full-access` | logically read-only |
| Reviewer | `deepseek-v4-flash` | `high` | `danger-full-access` | read-only |
| Tester | `deepseek-v4-flash` | `high` | `danger-full-access` | read-only |
| Root-cause diagnosis | `deepseek-v4-flash` | `high` | `danger-full-access` | read-only |

Rules:

- This is a quota-availability fallback, not the normal runtime policy.
- Use the official DeepSeek Codex/Responses API integration and exact model identifier `deepseek-v4-flash`.
- Do not store a DeepSeek API key in this repository, task contracts, evidence, logs, or prompts.
- Keep Codex internal `multi_agent` disabled; Herdr remains the only multi-agent orchestrator.
- The broader runtime sandbox remains only for Herdr IPC. The repository role remains read-only.
- Existing repository plans, task contracts, Git provenance, review independence, and evidence gates remain unchanged when the provider changes.
- A DeepSeek fallback session may continue normal Lead/Reviewer/Tester work, but it must not silently rewrite runtime authority or product/design authority.
- Final release Compliance remains pinned to the normal `gpt-5.6-sol` / `high` policy. If that model is quota-unavailable, release waits at the final Compliance gate rather than substituting DeepSeek.
- When OpenAI quota becomes available again, prefer the normal policy for newly started Codex roles. Do not interrupt an in-flight bounded fallback task solely to switch providers.

Before trusting a fallback session, verify its startup/runtime reports the exact DeepSeek model and that Herdr IPC works. Record provider/model in task evidence when the fallback materially participates in review or testing.

## Antigravity / AGY

The available AGY 1.2.0 model identifiers have been verified in the execution environment.

| Role | Model |
|---|---|
| Workflow Scribe | `gemini-3.8-flash-medium` |
| Builder | `gemini-3.8-flash-high` |
| Repairer | `gemini-3.8-flash-high` |
| Integrator | `gemini-3.8-flash-high` |

Use exact model identifiers when starting each AGY agent. Do not depend on its saved/default model.

Workflow Scribe receives exact Codex-approved content and paths. Builder/Repairer/Integrator receive bounded Task Contracts and relevant context only.

## Runtime Verification

A launch is trusted only after its effective runtime configuration is observable. At minimum verify model/effort for Codex and exact resolved model for AGY.

The current environment has already demonstrated that a Codex Lead launched with `gpt-5.6-sol`, medium effort, and `danger-full-access` can access Herdr IPC and report `HERDR_RUNTIME_OK`.

If a later CLI/Herdr/macOS version allows scoped Unix-socket access while preserving a read-only filesystem sandbox, prefer that narrower runtime permission after verifying it works. The logical Codex read-only role remains unchanged either way.