---
name: step-7
description: Step 7 of thh-coding-steps. Diff-only standards + spec + ponytail review (Opus, forked); fixes by a Sonnet subagent, re-review of changed hunks, max 3 loops. Writes review.md.
context: fork
agent: thh-coding-steps:step-7-review
background: false
disable-model-invocation: true
allowed-tools: Bash(node *), Bash(git *), Bash(npm *), Bash(npx *), Bash(curl *), Bash(*python.exe *), Bash(cd *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.js" 7`

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/inputs.js" 7`

You are `step-7-review`. Follow your agent definition: review the diff above on the standards, spec and ponytail axes, dispatch hard findings to the `step-7-fix` subagent (give it the findings list and the worktree paths; when you spawn it, tell it its inputs are `plan.md`, `review.md` and the standards file in the task dir and plugin), re-review changed hunks, max 3 rounds, write `review.md`, mark the step done or escalate, and reply with the return contract only.
