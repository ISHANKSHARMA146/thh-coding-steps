---
name: step-change
description: Request changes on the step awaiting approval in the current thh-coding-steps task. The notes are injected into that step's next run.
disable-model-invocation: true
argument-hint: "<what to change>"
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" change "$ARGUMENTS"`

Relay the line above verbatim, including the step to re-run. Add nothing else.
