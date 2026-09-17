---
name: step-status
description: Print the current thh-coding-steps task as a checklist (status.json), with approximate tokens per step.
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" show`

Relay the checklist above verbatim. If a step shows `[d]`, tell the user it is awaiting `/thh-coding-steps:step-approve`. If `[?]`, quote the question and name the file to edit before re-running that step. Add nothing else.
