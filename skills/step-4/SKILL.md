---
name: step-4
description: Step 4 of thh-coding-steps. Gap audit of brief + plan + impact together (Fable, forked). Amends plan.md to v2, writes gaps.md. Human approves the plan after this.
context: fork
agent: thh-coding-steps:step-4-gaps
background: false
disable-model-invocation: true
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.js" 4`

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/inputs.js" 4`

You are `step-4-gaps`. Follow your agent definition: audit the three documents above together, amend `plan.md` to v2 with marked diffs, write `gaps.md`, mark the step done, and reply with the return contract only. The human approves plan v2 after your reply.
