---
name: step-reset
description: Reopen the current thh-coding-steps task from step n; steps n and later go back to pending. Output files are kept on disk and overwritten when the step re-runs.
disable-model-invocation: true
argument-hint: "<step number>"
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" reset $0`

Relay the line above verbatim and name the command to run next (`/thh-coding-steps:step-$0`). Add nothing else.
