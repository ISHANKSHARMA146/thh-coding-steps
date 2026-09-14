---
name: step-stop
description: Stop the current thh-coding-steps task. Nothing is deleted; /thh-coding-steps:step-reset <n> reopens it.
disable-model-invocation: true
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" stop`

Relay the line above verbatim. Mention that worktrees, if any, are still on disk under `worktrees/` and can be removed with `node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree.js" remove`. Add nothing else.
