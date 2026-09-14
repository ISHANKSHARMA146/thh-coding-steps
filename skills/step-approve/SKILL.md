---
name: step-approve
description: Approve the step that is awaiting approval in the current thh-coding-steps task (optionally a step number). Approving step 9 removes the task worktrees.
disable-model-invocation: true
argument-hint: "[step number]"
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" approve $ARGUMENTS`

Relay the line above verbatim, including the next command to run. Add nothing else.
