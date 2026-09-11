# Herdr Child Pane Lifecycle

This policy prevents completed autonomous agents from leaving dead or idle panes behind.

It applies to panes created by the autonomous Lead/orchestrator for Builder, Repairer, Reviewer, Tester, Integrator, Scribe, browser-QA, accessibility, or auxiliary command roles.

## Core Rule

A Lead-created child pane is temporary by default.

Once the child role has completed and its required output/evidence has been captured, the orchestrator must terminate the child process gracefully and close the pane.

Do not keep completed child panes open "just in case."

## Never Auto-Close

Do not automatically close:

- the user's original pane;
- the active Lead/orchestrator pane;
- a pane the user explicitly asked to keep;
- an agent in blocked state waiting for required input/approval;
- a writer pane with unresolved uncommitted or unreported repository changes;
- an unknown pane until its process/state has been inspected;
- a dev server/browser/test process explicitly required by another active task.

## Completion Cleanup Sequence

For every child role:

1. Wait for a settled Herdr state.
2. Read and capture the final result through the agent/pane surface.
3. If the role is a writer:
   - confirm the intended commit exists;
   - inspect git status --short;
   - confirm no required change exists only as uncommitted state.
4. If the role is read-only:
   - capture findings/verdict/evidence;
   - confirm it did not mutate repository state unexpectedly.
5. Confirm the role is not blocked.
6. Gracefully end/release the agent using operations supported by the installed Herdr CLI.
7. Confirm the pane has returned to a shell or the agent has exited.
8. Close the child pane.
9. Verify the pane no longer appears in workspace pane inventory.

The installed Herdr binary is syntax authority. Before using lifecycle commands in a new environment, inspect:

    herdr agent
    herdr pane

Do not guess an unsupported stop/release/close command.

If the installed CLI exposes herdr pane close <pane-id>, use it only after the safety checks above.

If no dedicated graceful agent-release operation exists, send the appropriate normal exit/interrupt to the child agent, verify that its process ended and repository state is safe, then close the pane.

## Automatic Cleanup Timing

### After Builder / Repairer

Close after:

    implementation commit exists
    + capsule/result captured
    + working tree is safe

Do not keep the writer pane open through independent review.

If repair is later required, spawn a new Repairer or deliberately resume a still-authoritative writer only when the workflow explicitly chooses that path.

### After Reviewer

Close immediately after the complete review verdict/findings are captured.

### After Tester / Browser QA / Accessibility Audit

Close after command results and observable findings are captured.

If a persistent dev server was launched in a separate pane, keep that server pane only while another active task still needs it.

### After Integrator / Scribe

Close after coordination-branch commit/path evidence is captured and the Lead verifies the result.

### End of Wave

At every dependency-wave boundary, reconcile the workspace:

    active child panes == roles/processes still required

Close completed orphan panes before dispatching the next wave.

### End of Workflow

After PASS or genuine BLOCKED:

- close every Lead-created child agent pane that is safe to close;
- stop/close auxiliary dev-server/test/browser panes created solely for the workflow;
- keep the user pane and Lead pane;
- report any pane intentionally kept open and why.

## Failure Handling

Failure to close an ordinary completed pane is an orchestration hygiene issue, not a product defect.

However, an orphan writer/process that may continue mutating repository state is a workflow integrity risk. Stop advancement until its state is reconciled.

A pane-close failure should be diagnosed once using current Herdr state/help. Do not repeatedly kill processes blindly.

## Recovery

After Lead/session restart:

1. inspect current workspace panes;
2. inspect live agents;
3. compare with active task/worktree state;
4. close only panes that can be proven completed/safe;
5. never infer safety only from an idle/done badge.
