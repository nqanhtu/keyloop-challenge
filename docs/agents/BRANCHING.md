# Task Branching and Commit Provenance

This protocol prevents workflow-record commits from contaminating implementation diffs and keeps review fixed points deterministic.

## Coordination Branch

The branch on which the autonomous delivery run starts is the coordination branch; for this challenge it is normally `main`.

Only one DeepSeek writer may mutate the coordination branch at a time. Workflow Scribe and Integrator writes are serialized.

## Dispatch Sequence

For every implementation task:

1. **Capture the implementation base**

   ```text
   B = current coordination-branch HEAD
   ```

   Codex places `B` in Task Contract `base_commit`.

2. **Compile the complete Task Contract**

   The contract references `B`, design requirements, applicable rules, test seams, scope, acceptance, and validation.

3. **Persist the contract through Workflow Scribe**

   Scribe writes `docs/agents/tasks/<TASK-ID>.md` on the coordination branch and commits it. This advances the coordination branch to a workflow-record commit `S`.

4. **Create the Builder worktree from `B`, not from `S`**

   The Builder branch/worktree starts at the exact `base_commit` recorded in the contract. Therefore the task implementation diff does not include the Task Contract persistence commit.

5. **Send the Task Contract to the Builder explicitly**

   Because the Builder starts from `B`, its branch may not contain the newly persisted Task Contract file. Pass the bounded contract in the Herdr prompt/context package. Do not advance the Builder base merely so it can read the workflow file.

6. **Review against `B`**

   Codex Reviewer uses `base_commit = B` as the fixed point. The resulting diff contains only task implementation/test changes made on the Builder branch.

7. **Integrate onto the current coordination branch**

   After review and required targeted verification pass, DeepSeek Integrator merges/applies the reviewed task commit onto the current coordination branch, which already contains workflow records such as `S`.

8. **Persist post-integration state**

   After Codex verifies the integration result, Workflow Scribe updates evidence and the active plan in a separate serialized workflow-record commit.

## Why the Builder Does Not Start from the Contract Commit

A Git commit cannot contain its own SHA. If a Task Contract were committed first and that same commit were used as a self-recorded review fixed point, the contract could not truthfully embed the value before the commit existed.

Starting the Builder from the pre-contract implementation base avoids that circularity and keeps generic review tooling deterministic.

## Parallel Wave Rule

Parallel tasks may have different `base_commit` values because Workflow Scribe can add workflow-only commits between dispatches. That is acceptable if their source-code dependency state is equivalent and the DAG marks them independent.

Codex must not infer independence from SHA inequality/equality alone. Verify source dependencies and overlapping seams before dispatch.

## Dependent Task Rule

A task that depends on integrated implementation must use a new base captured **after** that dependency has been integrated and verified on the coordination branch.

## Crash/Retry Rule

Before recreating a worktree or redispatching a task, inspect:

```text
Task Contract base_commit
existing task branch/worktree
commits reachable from that branch
current coordination HEAD
persisted task evidence
```

Never create a second implementation for the same task merely because an agent or pane disappeared.
