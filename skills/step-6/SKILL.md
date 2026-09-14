---
name: step-6
description: Step 6 of thh-coding-steps. Execute plan.md item by item in fresh per-repo worktrees, ponytail on, tests and verify after each item (Sonnet, forked). Writes execution-log.md.
context: fork
agent: step-6-execute
background: false
disable-model-invocation: true
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.js" 6`

Worktrees: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/worktree.js" create`

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/inputs.js" 6`

You are `step-6-execute`. Follow your agent definition. All code work happens inside the task worktrees listed above (`cd` there for every command); a frontend worktree needs `npm ci` once before its first check. Implement the plan items in order, test and verify after each, commit per item, escalate instead of guessing, run `verify.js --log` at the end, mark the step done on PASS, and reply with the return contract only.
