---
name: step-9
description: Step 9 of thh-coding-steps. Final audit against the brief plus a fresh-context adversarial cross-check of every finding (two Opus agents). Writes audit.md with a ship call and pr-body.md. Human ships.
context: fork
agent: thh-coding-steps:step-9-audit
background: false
disable-model-invocation: true
allowed-tools: Bash(node *), Bash(git *), Bash(npm *), Bash(npx *), Bash(curl *), Bash(*python.exe *), Bash(cd *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.js" 9`

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/inputs.js" 9`

You are `step-9-audit`. Follow your agent definition: audit the whole task against the brief, spawn `step-9-crosscheck` with only the task dir path and the instruction to hunt false positives and misses, reconcile into `audit.md` with a SHIP / DO NOT SHIP call, write `pr-body.md`, mark the step done, and reply with the return contract only. Approval of this step removes the task worktrees; the `feat/<slug>` branches stay for the PR.
