# Step contracts

Every step reads and writes `.thh/<task-slug>/`. No step relies on chat memory; any step can be re-run from disk.

| Step | Skill | Agent (model) | Reads | Writes | Gate to next |
|---|---|---|---|---|---|
| 0 | `/thh-coding-steps:step-0 "<task>"` | main thread, Fable | request, standards, CLAUDE.md | `brief.md`, `status.json` | human approves |
| 1 | `step-1` | `step-1-research` (Fable) | `brief.md`, web | `research.md` | auto |
| 2 | `step-2` | `step-2-plan` (Fable) | `brief.md`, `research.md`, repo tree, repo files (read-only), standards | `plan.md` | auto |
| 3 | `step-3` | `step-3-impact` (Opus) | `plan.md`, the files it names and their callers (read-only, whole repo) | `impact.md` | auto; escalates if any item is breaking |
| 4 | `step-4` | `step-4-gaps` (Fable) | `brief.md`, `plan.md`, `impact.md`, `research.md`, plan-listed files | `plan.md` v2, `gaps.md` | human approves plan |
| 5 | `step-5` | `step-5-mockup` (Sonnet) | `brief.md`, `plan.md`, thh-frontend design tokens and `src/components/ui` | `mockup.html`, `mockup-*.png` | human approves; skipped when brief says `ui: no` |
| 6 | `step-6` | `step-6-execute` (Sonnet) | `plan.md`, `impact.md`, `mockup.html`, standards, plan-listed files only, inside task worktrees | code in worktrees, `execution-log.md` | auto (verify must PASS) |
| 7 | `step-7` | `step-7-review` (Opus) spawns `step-7-fix` (Sonnet) | diff, `plan.md`, standards, ponytail-review | `review.md` | auto; max 3 fix loops then escalate |
| 8 | `step-8` | `step-8-test` (Opus) spawns `step-8-fix` (Sonnet) | tester: `brief.md`, `mockup.html`, running app; fixer: `test-report.md` + plan files | `test-report.md`, test files | auto; human sees report |
| 9 | `step-9` | `step-9-audit` (Opus) spawns `step-9-crosscheck` (fresh Opus) | everything in the task dir + diff | `audit.md`, `pr-body.md` | human ships |

Utility skills: `step-status`, `step-approve`, `step-change "<notes>"`, `step-stop`, `step-reset <n>`, `install`.

## status.json

```json
{
  "task": "job-board-config", "title": "...", "created": "ISO", "ui": true,
  "repos": ["thh-backend", "thh-frontend"], "branch": "feat/job-board-config",
  "worktrees": { "thh-backend": "C:/thehirehub/worktrees/job-board-config-thh-backend" },
  "current_step": 6,
  "steps": { "6": { "status": "running|done|approved|escalated|changes-requested|skipped|pending", "output": "execution-log.md",
             "started_at": "ISO", "finished_at": "ISO", "question": "...", "change_notes": "...", "tokens_approx": 12345 } }
}
```

## The file-list convention (what the scope guard reads)

`plan.md` and `impact.md` must each carry a `## Files` section. Every path in it is repo-relative with the repo name first, in backticks. A trailing `/` covers a subtree.

```
## Files
- `thh-backend/services/jobs/routes.py` touch: add PATCH /jobs/<id>/board-config
- `thh-backend/services/jobs/crud.py` touch
- `thh-backend/migrations/versions/` create: one revision
- `thh-backend/tests/jobs/` tests
- `thh-frontend/src/app/jobs/[id]/board-config/page.tsx` create
```

Steps 6 to 9 and both fixers may read and write only these paths (inside the task worktrees). A read or write of anything else is denied by the hook with a message naming this section, and logged to `scope-guard.log`.

## Return contract (every forked agent)

Full output goes to the step's file. The reply to the main thread is only:

```
## Step N: <name> — <slug>
<at most 250 words: what was produced, key decisions, counts, anything flagged>
Escalations: none | <the question recorded in status.json>
Next: /thh-coding-steps:step-approve to continue, /thh-coding-steps:step-change "<what to change>" to redo, /thh-coding-steps:step-stop to halt.
```

## Escalation

When a decision is not covered by the inputs, the agent does not guess. It runs
`node "${CLAUDE_PLUGIN_ROOT}/scripts/status.js" question <N> "<one precise question>"`, stops, and reports. The gate for the next step stays closed until a human answers (by editing the input file the question is about) and the step is re-run.

## Model routing

- Fable: steps 0, 1, 2, 4. Judgement, short high-stakes reads, never bulk code.
- Opus: steps 3, 7 (review), 8 (tester), 9 (audit and cross-check). Sustained reasoning over lots of code; all final audits.
- Sonnet: steps 5, 6, 7-fix, 8-fix. Execution only; follows the files, re-decides nothing.
- The model that wrote something is never the only model that judges it.
