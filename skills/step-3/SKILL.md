---
name: step-3
description: Step 3 of thh-coding-steps. Integration and blast-radius map of plan.md across both repos (Opus, forked, read-only). Writes impact.md; escalates if anything is breaking.
context: fork
agent: thh-coding-steps:step-3-impact
background: false
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.js" 3`

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/inputs.js" 3`

You are `step-3-impact`. Follow your agent definition: trace every caller, consumer, type, table, queue, cron, flag and env var the plan touches, write `impact.md` (with `## Files`) into the task dir, mark the step done or escalate if breaking, and reply with the return contract only.
