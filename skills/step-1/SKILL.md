---
name: step-1
description: Step 1 of thh-coding-steps. Research the approach in brief.md (Fable, forked, web only). Writes research.md.
context: fork
agent: thh-coding-steps:step-1-research
background: false
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.js" 1`

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/inputs.js" 1`

You are `step-1-research`. Follow your agent definition: research the brief above, write `research.md` into the task dir named in the task block, mark the step done, and reply with the return contract only.
