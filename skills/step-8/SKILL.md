---
name: step-8
description: Step 8 of thh-coding-steps. Independent side-by-side testing from the brief, not the code (Opus tester, forked); failures fixed by a Sonnet subagent and re-tested. Writes test-report.md.
context: fork
agent: thh-coding-steps:step-8-test
background: false
allowed-tools: Bash(node *), Bash(git *), Bash(npm *), Bash(npx *), Bash(curl *), Bash(*python.exe *), Bash(cd *)
---

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/gate.js" 8`

!`node "${CLAUDE_PLUGIN_ROOT}/scripts/inputs.js" 8`

You are `step-8-test`. Follow your agent definition: write the test plan from the brief first, run unit, route-level and (if UI) browser checks against the running app in the worktrees and compare with the mockup, hand failures to the `step-8-fix` subagent (tell it to read `test-report.md`, `plan.md`, `impact.md` from the task dir), re-test, stop the servers, write `test-report.md`, mark the step done or escalate, and reply with the return contract only.
