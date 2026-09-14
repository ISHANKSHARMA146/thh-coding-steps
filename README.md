# thh-coding-steps

One installable Claude Code plugin that turns any TheHireHub coding task into a fixed sequence of numbered steps, `/step-0` to `/step-9`. Each step has its own job, its own model, its own scoped context, its own inputs and outputs, and a hard gate before the next step can run. A junior engineer runs the steps in order and gets CTO-grade output without retyping context, re-checking by hand, or switching models.

| Step | Command | Model | Job | Output | Gate |
|---|---|---|---|---|---|
| 0 | `/thh-coding-steps:step-0 "<task>"` | Fable (main thread) | Grill the request, one question at a time | `brief.md` | human |
| 1 | `/thh-coding-steps:step-1` | Fable | Research the approach, cite sources | `research.md` | auto |
| 2 | `/thh-coding-steps:step-2` | Fable | Tracer-bullet plan with a file list | `plan.md` | auto |
| 3 | `/thh-coding-steps:step-3` | Opus | Blast radius across both repos | `impact.md` | auto, escalates if breaking |
| 4 | `/thh-coding-steps:step-4` | Fable | Gap audit; plan v2 | `plan.md` v2, `gaps.md` | human |
| 5 | `/thh-coding-steps:step-5` | Sonnet | HTML mockup with the real design tokens, four states | `mockup.html` | human; skipped when `ui: no` |
| 6 | `/thh-coding-steps:step-6` | Sonnet | Execute in fresh worktrees, ponytail on, verify | code, `execution-log.md` | auto |
| 7 | `/thh-coding-steps:step-7` | Opus, Sonnet fixer | Standards + spec + ponytail review, max 3 loops | `review.md` | auto |
| 8 | `/thh-coding-steps:step-8` | Opus, Sonnet fixer | Independent test plan from the brief, run side by side | `test-report.md` | auto |
| 9 | `/thh-coding-steps:step-9` | Opus, fresh Opus | Final audit + adversarial false-positive check | `audit.md`, `pr-body.md` | human ships |

Utilities: `step-status`, `step-approve [n]`, `step-change "<notes>"`, `step-stop`, `step-reset <n>`, `install`.

All state lives in `<workspace>/.thh/<task-slug>/`. No step relies on chat memory. Any step can be re-run from disk.

## Install

Public repo, doubles as a one-plugin marketplace named `thh`. From any terminal:

```bash
claude plugin marketplace add ishanksharma146/thh-coding-steps
```

```bash
claude plugin install thh-coding-steps@thh
```

Then, once, from the workspace root that holds `thh-backend` and `thh-frontend` (on this machine `C:\thehirehub`):

```
/thh-coding-steps:install
```

That drops a one-line pointer to the single standards copy into each repo's `CLAUDE.md`, gitignores `.thh/` and `worktrees/` in both repos, and creates the folders. Launch Claude Code from the workspace root; the scripts resolve the workspace from `CLAUDE_PROJECT_DIR` (override with `THH_WORKSPACE`).

Local development: `claude --plugin-dir C:\thehirehub\claude-skills\thh-coding-steps`, then `/reload-plugins` after edits.

Requirements: Node 20+ and git. Verified 2026-09-14: marketplace add, install (scope: user) and a headless run of the installed copy. Backend checks use `C:\thhvenv\Scripts\python.exe` (override with `THH_PYTHON`).

## Use

```
/thh-coding-steps:step-0 "Add a job-board config screen after screening questions"
```

Answer one question at a time until the brief is written, then `/thh-coding-steps:step-approve`. Run `/thh-coding-steps:step-1`, `step-2`, `step-3`, `step-4`; approve plan v2; `step-5` (if UI); approve; `step-6` through `step-9`; approve the ship call. Every step ends with a summary under 300 words and one question: approve, change, or stop. Details are in the files, not the chat.

`/thh-coding-steps:step-status` prints the checklist with approximate tokens per step. A step that hit a decision the plan does not cover writes its question into `status.json` and stops; the next gate stays closed until you answer (edit the input file it names) and re-run that step.

## How the rules are enforced

- **Model per step** is on the agent file in `agents/` (`model: fable | opus | sonnet`), never chosen by the user. Step 0 is the one exception: it runs in the main thread (subagents cannot ask questions) with `model: fable` on the skill.
- **Fresh context by construction**: every step from 1 to 9 is `context: fork` under its own agent; the agent sees only its `agents/step-N.md` prompt plus what `scripts/inputs.js` injects.
- **Inject exactly the inputs**: `scripts/inputs.js <n>` prints the files that step may see; big things (repo trees, diffs) are written to the task dir and summarised.
- **Scope guard**: `hooks/hooks.json` runs `scripts/scope-guard.js` on every Read, Edit, Write, Glob and Grep. It applies only to this plugin's step agents (matched on the hook's `agent_type`), allows the task dir, the plugin dir, `CLAUDE.md`, and the paths listed under `## Files` in `plan.md` and `impact.md`; everything else is denied with a message telling the agent to add the file to the plan and re-run. Writes from steps 6 and the fixers must land inside the task worktrees. Reviewers and planners can write only their report. Secrets dirs are always denied. Every decision is logged to `.thh/<slug>/scope-guard.log`.
- **Hard gates**: `scripts/gate.js <n>` runs by `!` injection at the top of every step skill before the model reads the instructions. It exits 2 (which aborts the skill) if the previous output file is missing, the previous step is not `done` or `approved`, a human gate is not approved, or an escalation is unanswered.
- **Worktrees**: step 6 creates `<workspace>/worktrees/<slug>-<repo>` on `feat/<slug>` for every repo the task touches (base: local `dev` if present). Approving step 9 removes the worktrees; the branches stay for the PR.
- **Verify before review**: step 6 cannot finish until `scripts/verify.js` reports PASS (frontend typecheck, lint, test; backend pytest for the areas the plan touches).
- **Tokens**: `scripts/tokens.js` runs on `SubagentStop` and adds an approximate count per step to `status.json` from the transcript. Record `/cost` by hand at the end of a full run for the exact total.

## Layout

```
.claude-plugin/plugin.json, marketplace.json
agents/step-1-research.md ... step-9-crosscheck.md   model, tools, effort, maxTurns per agent
skills/step-0 ... step-9, step-status, step-approve, step-change, step-stop, step-reset, install
hooks/hooks.json            PreToolUse scope guard, SubagentStop token logger
scripts/                    lib, gate, status, scope-guard, tokens, worktree, verify, inputs, install, selftest
references/THH-CODE-STANDARDS.md      the constitution; every step inherits it by path
references/STANDARDS-MERGE-NOTES.md   conflicts and gaps from the merge, for human rulings
references/step-contracts.md          inputs, outputs, file-list convention, return contract
vendor/                     pinned MIT sources (see vendor/PINS.md)
```

`node scripts/selftest.js` exercises the gate, status and scope guard against a throwaway workspace.

## Deviations from the brief, and why

- Agent-frontmatter hooks are not allowed in plugins (sub-agents docs), so all hooks live in `hooks/hooks.json` and branch on `agent_type`.
- `isolation: worktree` is not used: the workspace root is not a git repo and tasks span two repos. `scripts/worktree.js` creates one worktree per repo instead, and the scope guard confines writes to them.
- Reviewers keep the Write tool (they must write their report); the hook, not `disallowedTools`, restricts them to the task dir. Bash is not path-gated by the hook.
- Steps 2 and 3 may read the whole repo (read-only). A plan or blast-radius map written from a file listing alone would be guesswork. From step 4 on, reads are limited to the listed files.
- Step 0 asks one question per turn as the brief requires; the vendored `grilling` skill asks a whole frontier per round. The vendored text is injected for its method, the THH variant overrides the cadence.
- `token-budget-tracker` from matthews-wong turned out to be a SessionStart nudge, not a counter; nothing to borrow. `verify-before-review` supplied the pattern; `scripts/verify.js` is the THH-specific rewrite.

## Known gaps

- The `agent:` field on a forked plugin skill is written as the bare agent name. If Claude Code requires `thh-coding-steps:step-N-name`, change the nine skills.
- Browser tools (`mcp__Claude_Browser__*`) inside subagents are untested; steps 5 and 8 report honestly when they are unavailable.
- Token counts are approximate and depend on the `SubagentStop` hook input naming a transcript.

## Third-party

`vendor/` carries MIT-licensed files from mattpocock/skills, dietrichgebert/ponytail and matthews-wong/claude-code-plugins at pinned commits; see `vendor/PINS.md` and the LICENSE files beside them.
