---
name: step-5
description: Step 5 of thh-coding-steps. Static HTML mockup with THH's real tokens, all four states, screenshots (Sonnet, forked). Skipped automatically when the brief says ui: no.
context: fork
agent: thh-coding-steps:step-5-mockup
background: false
disable-model-invocation: true
allowed-tools: Bash(node *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.js" 5`

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/inputs.js" 5`

You are `step-5-mockup`. Follow your agent definition: build `mockup.html` in the task dir from the brief and plan above using the real design tokens and `src/components/ui` primitives, cover empty/loading/error/populated, screenshot if browser tools exist, mark the step done, and reply with the return contract only.
