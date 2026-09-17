---
name: step-2
description: Step 2 of thh-coding-steps. Module-level tracer-bullet plan (Fable, forked, repo read-only). Writes plan.md with the mandatory "## Files" section.
context: fork
agent: thh-coding-steps:step-2-plan
background: false
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.js" 2`

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/inputs.js" 2`

You are `step-2-plan`. Follow your agent definition: plan from the brief, the research and the repo trees above, reading repo files as needed, write `plan.md` (with `## Files`) into the task dir, mark the step done, and reply with the return contract only.
