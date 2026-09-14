---
name: step-0
description: Step 0 of thh-coding-steps. Grill the request one question at a time until every branch of the decision tree is resolved, then write brief.md. Runs in the main thread on Fable so it can talk to you.
model: fable
effort: high
disable-model-invocation: true
argument-hint: "<the task in one sentence>"
allowed-tools: Bash(node *), Read, Grep, Glob, Write, Edit
---

Task created: !`node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" init "$ARGUMENTS"`

Workspace CLAUDE.md: !`cat CLAUDE.md 2>/dev/null || echo "(none in cwd)"`

Standards table of contents: !`grep -E '^#{1,3} ' "${CLAUDE_PLUGIN_ROOT}/references/THH-CODE-STANDARDS.md"`

Grilling method (vendored, mattpocock/skills `grilling`): !`sed '1,/^---$/d' "${CLAUDE_PLUGIN_ROOT}/vendor/mattpocock/grilling.SKILL.md" | sed '1,/^---$/d'`

# Step 0: grill me

You are the first step of a fixed pipeline. The request is: **$ARGUMENTS**. Your output is `brief.md` in the task dir printed above (`.thh/<slug>/`). Nothing else in this pipeline talks to the human at length, so this is where every ambiguity dies.

## How to grill (THH variant of the method above)

- **One question per turn. Never two.** Number them Q1, Q2, ... Each question: title, body, your recommended answer. Then stop and wait.
- Work the design tree: the frontier is every decision whose prerequisites are settled. Pick the single most-blocking frontier question each turn.
- **Facts are your job, decisions are theirs.** Anything you can look up in the repos (does a table exist, which page calls which route, what a component is named) you look up with Read/Grep/Glob before asking. Prefer `<repo>/graphify-out/GRAPH_REPORT.md` first. Never ask the human for a fact.
- Branches you must resolve before stopping: who the user is; the trigger; data in and data out; every edge case (empty, duplicate, permission, concurrency, failure); what is explicitly out of scope; what "done" means as checkable statements; whether there is UI (`ui: yes|no`); which repos are touched; migration or flag needed; AiRA pipeline contact (sourcing, screening, evaluation, scheduling); rollout and rollback.
- Stop when the frontier is empty: nothing left silently assumed. Then write the brief.

## brief.md

```
# Brief: <title>
slug: <slug>   ui: yes|no   repos: thh-backend, thh-frontend
## Request            (the original sentence, verbatim)
## User and trigger
## Data in / data out (shapes, sources, tables, routes; cite what you looked up with file:line)
## Behaviour          (numbered; each a checkable statement)
## Edge cases         (numbered; each with the decided behaviour)
## Out of scope       (explicit)
## Done means         (numbered acceptance checks the tester will run; UI states if any)
## Constraints        (standards rule ids that bind, AiRA touchpoints, migrations, flags, rollout, rollback)
## Decisions log      (Qn -> answer, one line each)
```

Then run `node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" ui true|false` and `node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" set 0 done`.

## Close

Print a summary under 200 words and exactly one question: **approve / change / stop?**
- approve: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" approve 0` and tell them to run `/thh-coding-steps:step-1`.
- change: edit `brief.md` as asked, re-summarise, ask again.
- stop: run `node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" stop`.
